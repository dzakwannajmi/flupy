import { NextRequest, NextResponse } from 'next/server';
import {
  Account,
  Contract,
  Keypair,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

import { getServerTree } from '../../../../lib/merkle-server/tree-cache';
import { acquireSyncLock, releaseSyncLock } from '../../../../lib/merkle-server/sync-lock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID;
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;
const OPERATOR_SECRET = process.env.FLUPY_ROOT_OPERATOR_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

function bigintToRootHex(root: bigint): string {
  return root.toString(16).padStart(64, '0');
}

/**
 * Reads the current on-chain Merkle root via simulateTransaction
 * (free -- no fee, no signature required for a read-only call).
 */
async function readOnChainRoot(server: rpc.Server): Promise<string> {
  const sourceAccount = new Account(
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    '0',
  );

  const contract = new Contract(CONTRACT_ID!);
  const operation = contract.call('get_merkle_root');

  const transaction = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE!,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const response = await server.simulateTransaction(transaction);

  if (rpc.Api.isSimulationError(response)) {
    throw new Error(response.error);
  }

  const result = response.result?.retval;

  if (!result) {
    throw new Error('Contract returned no value for get_merkle_root');
  }

  const native = scValToNative(result as xdr.ScVal);

  if (native instanceof Uint8Array || Buffer.isBuffer(native)) {
    return Buffer.from(native).toString('hex').padStart(64, '0');
  }

  throw new Error('[sync-root] Unexpected get_merkle_root return type');
}

/**
 * Submits set_merkle_root, signed by the RootOperator key
 * (FLUPY_ROOT_OPERATOR_SECRET), NOT the contract Admin key.
 *
 * Per the Tier 0 role separation (contracts/src/lib.rs), RootOperator
 * can ONLY call set_merkle_root -- a compromised operator key here
 * cannot pause payments, change fees, or move funds.
 */
async function submitSetMerkleRoot(
  server: rpc.Server,
  newRootHex: string,
): Promise<string> {
  const operatorKeypair = Keypair.fromSecret(OPERATOR_SECRET!);
  const operatorAddress = operatorKeypair.publicKey();

  const account = await server.getAccount(operatorAddress);
  const contract = new Contract(CONTRACT_ID!);

  const newRootBytes = Buffer.from(newRootHex, 'hex');

  const operation = contract.call(
    'set_merkle_root',
    nativeToScVal(operatorAddress, { type: 'address' }),
    nativeToScVal(newRootBytes, { type: 'bytes' }),
  );

  const transaction = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: NETWORK_PASSPHRASE!,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(transaction);
  prepared.sign(operatorKeypair);

  const submission = await server.sendTransaction(prepared);

  if (submission.status === 'ERROR') {
    throw new Error(
      `[sync-root] Submission failed: ${JSON.stringify(
        (submission as unknown as { errorResult?: unknown }).errorResult ?? submission,
      )}`,
    );
  }

  return submission.hash;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Guard A: only Vercel Cron (or an authorised manual call) may invoke this ──
  const authHeader = req.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!RPC_URL || !CONTRACT_ID || !NETWORK_PASSPHRASE || !OPERATOR_SECRET || !DATABASE_URL) {
    return NextResponse.json(
      { error: 'sync_endpoint_misconfigured' },
      { status: 500 },
    );
  }

  // ── Guard B: distributed lock -- skip if a sync is already in flight ──
  const acquired = await acquireSyncLock(DATABASE_URL);

  if (!acquired) {
    return NextResponse.json({ skipped: 'lock held' });
  }

  const server = new rpc.Server(RPC_URL);

  try {
    // ── Guard C: idempotency -- read on-chain root first, skip if already synced ──
    const [onChainRootHex, tree] = await Promise.all([
      readOnChainRoot(server),
      getServerTree(),
    ]);

    const cacheRootHex = bigintToRootHex(tree.root);

    if (onChainRootHex === cacheRootHex) {
      return NextResponse.json({ skipped: 'already in sync' });
    }

    const txHash = await submitSetMerkleRoot(server, cacheRootHex);

    return NextResponse.json({
      synced: true,
      txHash,
      newRoot: cacheRootHex,
    });
  } catch (err) {
    console.error('[/api/admin/sync-root] error:', err);

    return NextResponse.json(
      {
        error: 'sync_failed',
        message: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  } finally {
    await releaseSyncLock(DATABASE_URL);
  }
}
