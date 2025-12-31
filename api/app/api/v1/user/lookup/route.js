import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getCurrentUserFromRequest } from '@/lib/authUser';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
        return NextResponse.json({ error: 'Username is required', code: 'bad_request' }, { status: 400 });
    }

    const { user: requester } = await getCurrentUserFromRequest(req);
    if (!requester) {
        return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    try {
        const { data: targetUser, error } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (error || !targetUser) {
            return NextResponse.json({ error: 'User not found', code: 'not_found' }, { status: 404 });
        }

        return NextResponse.json({ id: targetUser.id });
    } catch (err) {
        return NextResponse.json({ error: 'Internal error', code: 'internal_error' }, { status: 500 });
    }
}
