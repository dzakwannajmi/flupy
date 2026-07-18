/**
 * identity.ts — Browser credential management for the Fluppy browser SDK.
 *
 * Responsibilities:
 * - Generate a 256-bit cryptographically random ZK secret
 * - Encrypt and persist credential to IndexedDB using PBKDF2 + AES-GCM
 * - Decrypt and return the secret from IndexedDB
 * - Check credential existence
 * - Delete stored credential
 *
 * Security properties:
 * - Secret is never stored in plaintext
 * - Password is never logged or persisted
 * - AES-GCM key is non-extractable
 * - IndexedDB schema is versioned and migration-safe
 * - Iteration count is stored per credential for future migration safety
 *
 * Compatibility constraints:
 * - DB_NAME, DB_VERSION, STORE_NAME, and CRED_KEY must remain identical
 * - Credential schema fields and types must remain identical
 * - PBKDF2 and AES-GCM parameters must remain identical
 * - Secret format must remain a 64-character lowercase hex string
 *
 * This module uses native browser APIs only.
 * Do not import React, Next.js, Sentry, or UI code here.
 */

const DB_NAME = 'fluppy-identity-v1';
const DB_VERSION = 1;
const STORE_NAME = 'credentials';
const CRED_KEY = 'zk-credential';

const PBKDF2_ITERATIONS: number =
  typeof process !== 'undefined' && process.env?.['NODE_ENV'] === 'development'
    ? 100_000
    : 600_000;

interface StoredCredential {
  readonly version: 1;
  readonly kdf: 'pbkdf2';
  readonly iterations: number;
  readonly salt: string;
  readonly iv: string;
  readonly ciphertext: string;
}

export interface CreateCredentialResult {
  readonly secret: string;
}

function assertBrowserEnvironment(): void {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    throw new Error(
      '[identity] This module can only be used in a browser environment.',
    );
  }
}

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = parseInt(hex.slice(index, index + 2), 16);
  }

  return bytes;
}

function openDb(): Promise<IDBDatabase> {
  assertBrowserEnvironment();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGet(
  db: IDBDatabase,
  key: string,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME)
      .get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbSet(
  db: IDBDatabase,
  key: string,
  value: unknown,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, 'readwrite')
      .objectStore(STORE_NAME)
      .put(value, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function dbDelete(
  db: IDBDatabase,
  key: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, 'readwrite')
      .objectStore(STORE_NAME)
      .delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return toHex(bytes);
}

export async function credentialExists(): Promise<boolean> {
  const db = await openDb();
  const stored = await dbGet(db, CRED_KEY);

  return !!stored;
}

export async function createCredential(
  password: string,
): Promise<CreateCredentialResult> {
  assertBrowserEnvironment();

  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const secret = generateSecret();
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(password, new Uint8Array(salt));
  const encoded = new TextEncoder().encode(secret);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv),
      tagLength: 128,
    },
    key,
    encoded,
  );

  const stored: StoredCredential = {
    version: 1,
    kdf: 'pbkdf2',
    iterations: PBKDF2_ITERATIONS,
    salt: toHex(salt),
    iv: toHex(iv),
    ciphertext: toHex(ciphertext),
  };

  const db = await openDb();

  await dbSet(db, CRED_KEY, stored);

  console.info('[identity] Credential created and stored in IndexedDB.');

  return { secret };
}

export async function unlockCredential(
  password: string,
): Promise<string> {
  assertBrowserEnvironment();

  const db = await openDb();
  const raw = await dbGet(db, CRED_KEY);

  if (raw === undefined || raw === null) {
    throw new Error('No credential found. Please create one first.');
  }

  // This cast intentionally preserves legacy credential compatibility.
  // Some older credentials may contain fields that are validated at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stored = raw as any;

  if (stored['version'] !== 1) {
    throw new Error(
      `Unknown credential version: ${stored['version']}. ` +
      'Delete the existing credential and create a new one.',
    );
  }

  const salt = new Uint8Array(fromHex(stored['salt'] as string));
  const iv = new Uint8Array(fromHex(stored['iv'] as string));
  const ciphertext = new Uint8Array(
    fromHex(stored['ciphertext'] as string),
  ).buffer;

  const iterations =
    (stored['iterations'] as number | undefined) ?? PBKDF2_ITERATIONS;

  const key = await deriveKey(password, salt, iterations);

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128,
      },
      key,
      ciphertext,
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error(
      'Wrong password or corrupted credential. ' +
      'If you forgot your password, delete the credential and create a new one.',
    );
  }
}

export async function deleteCredential(): Promise<void> {
  const db = await openDb();

  await dbDelete(db, CRED_KEY);
}
