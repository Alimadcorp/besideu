import { NextResponse } from "next/server"

export async function POST(request) {
  try {
    const { email, usnm, pwd } = await request.json();
    
    return NextResponse.json({ error: "Failed to Sign Up" }, {status: 500})
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" })
  }
}
