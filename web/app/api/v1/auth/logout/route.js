import { NextResponse } from "next/server"

export async function GET(request) {
  try {
    const { token } = await request.headers;
    
    return NextResponse.json({ error: "Invalid Token" }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" })
  }
}
