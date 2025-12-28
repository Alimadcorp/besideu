import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../../lib/authUser';

export async function POST(req, { params }) {
    const { id: dmId } = await params;
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
        return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    try {
        // 1. Identify which unread count to reset
        const { data: friendRow, error: fetchErr } = await supabaseAdmin
            .from('friends')
            .select('user_id_1, user_id_2')
            .eq('id', dmId)
            .single();

        if (fetchErr || !friendRow) {
            return NextResponse.json({ error: 'Conversation not found', code: 'not_found' }, { status: 404 });
        }

        const isUser1 = friendRow.user_id_1 === user.id;
        const isUser2 = friendRow.user_id_2 === user.id;

        if (!isUser1 && !isUser2) {
            return NextResponse.json({ error: 'Forbidden', code: 'forbidden' }, { status: 403 });
        }

        const updates = {};
        if (isUser1) {
            updates.unread_count_1 = 0;
        } else {
            updates.unread_count_2 = 0;
        }

        const { error: updateErr } = await supabaseAdmin
            .from('friends')
            .update(updates)
            .eq('id', dmId);

        if (updateErr) {
            console.error('[messages/read] update', updateErr);
            return NextResponse.json({ error: 'Failed to reset unread count', code: 'supabase_error' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[messages/read] unexpected', err);
        return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
    }
}
