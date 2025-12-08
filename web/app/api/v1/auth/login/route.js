import { NextResponse } from "next/server"

export async function POST(request) {
  try {
    const { email, pwd } = await request.json();
    
    return NextResponse.json({ error: "Invalid Credentials" }, {status: 401})
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, {status: 500})
  }
}
