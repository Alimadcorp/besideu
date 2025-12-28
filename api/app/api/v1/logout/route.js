import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '../../../../lib/authUser';

export async function POST(req) {
    // Optional: Verify user exists before "logging out"
    const { user } = await getCurrentUserFromRequest(req);

    // In a JWT system, server-side logout usually involves blacklisting tokens 
    // or just returning success so the client clears its own storage.

    return NextResponse.json({ success: true, message: 'Logged out successfully' });
}
