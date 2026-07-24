import { NextRequest, NextResponse } from 'next/server';
import { syncMerkleRoot } from '../../../../lib/merkle-server/sync-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await syncMerkleRoot();

  if ('error' in result) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}
