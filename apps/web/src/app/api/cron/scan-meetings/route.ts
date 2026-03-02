import { type NextRequest, NextResponse } from 'next/server'
import { scanMeetings } from '@/lib/scan-meetings'

/**
 * POST /api/cron/scan-meetings
 * Protected endpoint that triggers a full calendar → Recall scan.
 * Called internally by the node-cron scheduler in instrumentation.ts.
 * Can also be called manually for debugging.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get('Authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await scanMeetings()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron/scan-meetings] Unhandled error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
