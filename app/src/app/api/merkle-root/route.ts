import { NextRequest, NextResponse } from 'next/server';
import {
  Account,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID;
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;

// Dummy account used only for read-only simulateTransaction calls --
// no signature or funds required, sequence number is irrelevant.
const DUMMY_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

function bytesToHex(value: unknown): string {
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return Buffer.from(value).toString('hex').padStart(64, '0');
  }

  throw new Error('[merkle-root] Unexpected contract return type');
}

/**
 * GET /api/merkle-root
 *
 * Two modes:
 *   ?root=<hex>  -> calls is_known_root(root) on the contract. Returns
 *                   { isKnown: boolean } -- true if the given root is
 *                   any of the last 30 anchored roots (root history
 *                   ring buffer), not just the single latest one.
 *   (no query)   -> calls get_merkle_root() and returns the single
 *                   most recent root, for callers that just want "the
 *                   current root" (e.g. the sync job's idempotency
 *                   check).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!RPC_URL || !CONTRACT_ID || !NETWORK_PASSPHRASE) {
    return NextResponse.json(
      { error: 'merkle_root_endpoint_misconfigured' },
      { status: 500 },
    );
  }

  const server = new rpc.Server(RPC_URL);
  const rootParam = req.nextUrl.searchParams.get('root');

  try {
    const sourceAccount = new Account(DUMMY_ACCOUNT, '0');
    const contract = new Contract(CONTRACT_ID);

    const operation = rootParam
      ? contract.call(
          'is_known_root',
          nativeToScVal(Buffer.from(rootParam, 'hex'), { type: 'bytes' }),
        )
      : contract.call('get_merkle_root');

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
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
      throw new Error('Contract returned no value');
    }

    const native = scValToNative(result as xdr.ScVal);

    if (rootParam) {
      return NextResponse.json({ isKnown: Boolean(native) });
    }

    return NextResponse.json({ root: bytesToHex(native) });
  } catch (err) {
    console.error('[/api/merkle-root] error:', err);

    return NextResponse.json(
      {
        error: 'merkle_root_read_failed',
        message: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
}
