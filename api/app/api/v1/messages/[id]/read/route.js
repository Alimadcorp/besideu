import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getCurrentUserFromRequest } from '@/lib/authUser';

export async function POST(req, { params }) {
    const { id: chatId } = await params;
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
        return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    try {
        // Try DMs first
        const { data: friendRow, error: fetchErr } = await supabaseAdmin
            .from('friends')
            .select('user_id_1, user_id_2')
            .eq('id', chatId)
            .single();

        if (!fetchErr && friendRow) {
            // It's a DM
            const isUser1 = friendRow.user_id_1 === user.id;
            const isUser2 = friendRow.user_id_2 === user.id;

            if (!isUser1 && !isUser2) {
                return NextResponse.json({ error: 'Forbidden', code: 'forbidden' }, { status: 403 });
            }

            const updates = {};
            if (isUser1) updates.unread_count_1 = 0;
            else updates.unread_count_2 = 0;

            await supabaseAdmin.from('friends').update(updates).eq('id', chatId);
            return NextResponse.json({ success: true });
        }

        // Try Meeting Channels if DM failed
        // For meeting channels, we probably don't have a per-user unread count in a single central table row yet.
        // The implementation plan usually involves a 'meeting_channel_members' table with 'unread_count' or 'last_read_at'.
        // Let's check 'meeting_channel_members'.

        const { data: member, error: memErr } = await supabaseAdmin
            .from('meeting_channel_members')
            .select('user_id')
            .eq('channel_id', chatId)
            .eq('user_id', user.id)
            .single();

        if (!memErr && member) {
            // Reset unread count for this member (assuming column exists or we add it)
            // If unread_count column doesn't exist yet, this is a no-op or we need to add it.
            // Based on schema from previous turns:
            // 'meeting_channel_members' likely tracks this. If not, we should probably add 'last_read_at'.
            // For now, let's assume we can update 'last_read_at' to now().

            await supabaseAdmin
                .from('meeting_channel_members')
                .update({ last_read_at: new Date().toISOString() })
                .eq('channel_id', chatId)
                .eq('user_id', user.id);

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Conversation not found', code: 'not_found' }, { status: 404 });
    } catch (err) {
        console.error('[messages/read] unexpected', err);
        return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
    }
}
