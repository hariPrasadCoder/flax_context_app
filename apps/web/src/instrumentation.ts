/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Schedules the meeting scanner to run every 5 minutes.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run in the Node.js runtime (not Edge), and only on the server
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { default: cron } = await import('node-cron')
  const { scanMeetings } = await import('@/lib/scan-meetings')

  // Run immediately on startup (catches meetings discovered before first tick)
  scanMeetings().catch((err) =>
    console.error('[instrumentation] Initial scan failed:', err)
  )

  // Then every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    scanMeetings().catch((err) =>
      console.error('[instrumentation] Scheduled scan failed:', err)
    )
  })

  console.log('[instrumentation] Meeting scanner active (every 5 min)')
}
