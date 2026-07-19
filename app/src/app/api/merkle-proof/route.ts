import { NextResponse } from 'next/server';
import { getServerTree } from '../../../lib/merkle-server/tree-cache';

// Force this route to run on Node.js runtime (not Edge)
// circomlibjs requires Node-native crypto
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ErrorResponse {
  error:   string;
  details?: string;
}

const ERROR_CODES = {
  INTERNAL_ERROR: 'internal_server_error',
} as const;

interface LeafSetResponse {
  readonly leaves: string[];
  readonly root:   string;
}

/**
 * GET /api/merkle-proof
 *
 * Returns the ENTIRE enrolled leaf set + current root — identical response
 * for every requester, regardless of which commitment they hold.
 *
 * Privacy rationale (per Fable-assisted privacy audit): a per-commitment
 * "give me the path for leaf X" endpoint lets the server learn "this
 * session is about to pay, right now" and correlate that timing with the
 * payment tx landing seconds later — a deanonymization vector that
 * requires no wallet address ever being transmitted. Serving the full,
 * identical leaf set to everyone removes the server's ability to
 * distinguish "who is about to pay" from request patterns. The client
 * locates its own leaf and computes its own Merkle path locally.
 *
 * Publishing the full commitment list this way is safe: commitments are
 * Poseidon hashes (Poseidon(LEAF_TAG, secret)) and leak nothing about the
 * underlying secret without it.
 *
 * Response:
 *   { leaves: string[], root: string }
 *   leaves[i] is the commitment at tree index i, as a decimal-string
 *   encoded bigint. All bigints are decimal-string encoded for JSON
 *   safety.
 */
export async function GET(): Promise<NextResponse<LeafSetResponse | ErrorResponse>> {
  try {
    const tree = await getServerTree();

    // commitmentMap: hex-key -> index. Invert it into an index-ordered
    // decimal-string leaf array for the client.
    const leaves: string[] = new Array(tree.commitmentMap.size);

    for (const [hexKey, index] of tree.commitmentMap) {
      leaves[index] = BigInt('0x' + hexKey).toString();
    }

    return NextResponse.json({
      leaves,
      root: tree.root.toString(),
    });
  } catch (err) {
    console.error('[/api/merkle-proof] error:', err);
    return NextResponse.json(
      {
        error:   ERROR_CODES.INTERNAL_ERROR,
        details: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
}
