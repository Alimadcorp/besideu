import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';

export async function GET(req) {
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
        return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    try {
        const { data: friends, error } = await supabaseAdmin
            .from('friends')
            .select(`
        id,
        user_id_1,
        user_id_2,
        last_message,
        last_message_at,
        unread_count_1,
        unread_count_2,
        created_at,
        u1:user_id_1 ( id, username, real_name, avatar_url ),
        u2:user_id_2 ( id, username, real_name, avatar_url )
      `)
            .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
            .order('last_message_at', { ascending: false, nullsFirst: false });

        if (error) {
            console.error('[friends/list] fetch', error);
            return NextResponse.json({ error: 'Failed to fetch friends', code: 'supabase_error' }, { status: 500 });
        }

        const formatted = friends.map(f => {
            const isUser1 = f.user_id_1 === user.id;
            const otherUser = isUser1 ? f.u2 : f.u1;
            return {
                id: f.id,
                friend_id: otherUser.id,
                username: otherUser.username,
                real_name: otherUser.real_name,
                avatar_url: otherUser.avatar_url,
                last_message: f.last_message,
                last_message_at: f.last_message_at,
                unread_count: isUser1 ? f.unread_count_1 : f.unread_count_2,
                created_at: f.created_at
            };
        });

        return NextResponse.json({ friends: formatted });
    } catch (err) {
        console.error('[friends/list] unexpected', err);
        return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
    }
}
