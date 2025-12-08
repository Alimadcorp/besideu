import { NextResponse } from "next/server"

export async function POST(request) {
  try {
    const { email, referrer } = await request.json()

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }

    // Log to external service
    const logText = `${email}, ${referrer}`
    await fetch("https://log.alimad.co/api/log?channel=besideu-subs&text=" + encodeURIComponent(logText)).catch(() => {
      // Silently fail if external service is unavailable
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Subscription error:", error)
    return NextResponse.json({ error: "Subscription failed" }, { status: 500 })
  }
}
