/**
 * providers.tsx — FluppyProvider wrapper for the /app route subtree.
 *
 * Reads SDK configuration from NEXT_PUBLIC_* environment variables,
 * memoizes the config object to prevent unnecessary context re-renders,
 * and wraps all /app route children with FluppyProvider.
 *
 * Why 'use client':
 *   FluppyProvider uses React.createContext internally, which requires
 *   a client component boundary. No browser-only APIs are called during
 *   render — this is safe for Next.js App Router.
 *
 * Why useMemo with empty deps []:
 *   React Context compares values with Object.is. A new config object
 *   on every render would cause ALL hook consumers to re-render.
 *   NEXT_PUBLIC_* env vars are static at runtime, so deps = [] is correct.
 *
 * Placement in tree:
 *   app/src/app/app/layout.tsx
 *     └─ FluppyAppProvider (this file)
 *          └─ page.tsx (AppPage)
 */

'use client';

import { useMemo } from 'react';
import type { ReactNode } from 'react';

import {
  FluppyProvider,
  type FluppyReactConfig,
} from '@fluppy/react';

// ─── Env var validation ───────────────────────────────────────────────────────

/**
 * Reads and validates a required NEXT_PUBLIC_* environment variable.
 *
 * Throws at render time with a clear message if the variable is missing.
 * This is intentional: a missing env var is a misconfiguration that must
 * surface immediately rather than fail silently at payment time.
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `[FluppyAppProvider] Missing required environment variable: ${name}. ` +
      `Ensure ${name} is set in app/.env.local and restart the dev server.`,
    );
  }
  return value;
}

// ─── Provider component ───────────────────────────────────────────────────────

/**
 * FluppyAppProvider
 *
 * Thin wrapper around FluppyProvider that sources SDK configuration
 * from environment variables. Used in app/src/app/app/layout.tsx to
 * provide Fluppy context to all /app route descendants.
 *
 * Required env vars:
 *   NEXT_PUBLIC_CONTRACT_ID         — deployed Soroban contract address
 *   NEXT_PUBLIC_NETWORK_PASSPHRASE  — Stellar network passphrase (chainId source)
 *
 * Optional env vars:
 *   NEXT_PUBLIC_RPC_URL             — Soroban RPC URL (defaults to Testnet)
 */
export function FluppyAppProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const config = useMemo<FluppyReactConfig>(() => {
    const contractId = requireEnv(
      'NEXT_PUBLIC_CONTRACT_ID',
      process.env.NEXT_PUBLIC_CONTRACT_ID,
    );

    const networkPassphrase = requireEnv(
      'NEXT_PUBLIC_NETWORK_PASSPHRASE',
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
    );

    const rpcUrl =
      process.env.NEXT_PUBLIC_RPC_URL ??
      'https://soroban-testnet.stellar.org:443';

    return {
      // Top-level networkPassphrase used by useFluppyPayment for chainId computation
      networkPassphrase,
      stellarConfig: {
        contractId,
        rpcUrl,
        networkPassphrase,
      },
      // merkleOptions not set — defaults to /api/merkle-proof
    };
  }, []); // deps: [] — env vars are static, config identity must never change

  return (
    <FluppyProvider config={config}>
      {children}
    </FluppyProvider>
  );
}
