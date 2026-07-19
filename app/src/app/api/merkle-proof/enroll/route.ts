import { NextRequest, NextResponse } from 'next/server';

import { getCommitmentSource } from '../../../../lib/merkle-server/commitment-source';
import { invalidateTreeCache } from '../../../../lib/merkle-server/tree-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EnrollResponse {
  enrolled: number;
  alreadyEnrolled: boolean;
}

interface ErrorResponse {
  error: string;
  message?: string;
}

function isMockEnrollmentAllowed(): boolean {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  const allowDemoEnrollment =
    process.env.FLUPY_ALLOW_DEMO_ENROLLMENT === 'true';

  const isTestnet =
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE === 'Test SDF Network ; September 2015';

  return allowDemoEnrollment && isTestnet;
}

function normalizeCommitment(input: unknown): bigint | null {
  if (typeof input !== 'string') {
    return null;
  }

  if (!/^[0-9a-fA-F]{1,64}$/.test(input)) {
    return null;
  }

  return BigInt(`0x${input}`);
}

/**
 * POST /api/merkle-proof/enroll
 *
 * Development/testnet endpoint for enrolling a commitment.
 * Production should use an authenticated admin enrollment flow.
 */
export async function POST(
  req: NextRequest,
): Promise<NextResponse<EnrollResponse | ErrorResponse>> {
  if (!isMockEnrollmentAllowed()) {
    return NextResponse.json(
      {
        error: 'enrollment_disabled_in_production',
        message:
          'Demo enrollment is disabled outside local development unless explicitly enabled for a controlled Testnet demo.',
      },
      { status: 403 },
    );
  }

  try {
    const body = await req.json() as {
      commitment?: unknown;
    };

    const commitment = normalizeCommitment(body.commitment);

    if (commitment === null) {
      return NextResponse.json(
        { error: 'invalid_commitment_format' },
        { status: 400 },
      );
    }

    const source = getCommitmentSource();
    const added = await source.add(commitment);

    if (added) {
      invalidateTreeCache();
    }

    return NextResponse.json({
      enrolled: await source.size(),
      alreadyEnrolled: !added,
    });
  } catch (err: unknown) {
    console.error('[/api/merkle-proof/enroll] error:', err);

    return NextResponse.json(
      { error: 'internal_server_error' },
      { status: 500 },
    );
  }
}
