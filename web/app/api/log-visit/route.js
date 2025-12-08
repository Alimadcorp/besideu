import { NextResponse } from "next/server"

export async function POST(request) {
  try {
    const { platform, referrer } = await request.json()

    // Log to external service
    const logText = `${platform}, ${referrer}`
    await fetch("https://log.alimad.co/api/log?channel=besideu-visit&text=" + encodeURIComponent(logText)).catch(() => {
      // Silently fail if external service is unavailable
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Visit logging error:", error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
