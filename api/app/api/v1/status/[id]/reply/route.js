import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../lib/authUser';

export async function POST(req, { params }) {
    const { id: statusId } = await params;
    const { user: sender, error: authError } = await getCurrentUserFromRequest(req);
    if (!sender) {
        return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { text } = body;

        if (!text) {
            return NextResponse.json({ error: 'Reply text is required', code: 'bad_request' }, { status: 400 });
        }

        // 1. Fetch the status
        const { data: status, error: statusErr } = await supabaseAdmin
            .from('user_statuses')
            .select('user_id, content, media_url, type')
            .eq('id', statusId)
            .single();

        if (statusErr || !status) {
            return NextResponse.json({ error: 'Status not found', code: 'not_found' }, { status: 404 });
        }

        const receiverId = status.user_id;

        // 2. Find or verify friendship (DM)
        const { data: friendRow, error: friendErr } = await supabaseAdmin
            .from('friends')
            .select('id, user_id_1, user_id_2')
            .or(`and(user_id_1.eq.${sender.id},user_id_2.eq.${receiverId}),and(user_id_1.eq.${receiverId},user_id_2.eq.${sender.id})`)
            .maybeSingle();

        if (friendErr || !friendRow) {
            // If not friends, we might still allow replying if privacy settings allow, 
            // but usually you can only reply to friends' statuses.
            return NextResponse.json({ error: 'You are not friends with this user', code: 'not_friends' }, { status: 403 });
        }

        const dmId = friendRow.id;

        // 3. Create the message referencing the status
        // We'll store it as a normal message but maybe with a JSON field 'meta' if supported, 
        // or just format the text for now. Let's check if 'meta' exists or just insert.
        const messageId = crypto.randomUUID();
        const createdAt = new Date().toISOString();

        const { error: msgErr } = await supabaseAdmin
            .from('messages')
            .insert({
                id: messageId,
                dm_id: dmId,
                sender_id: sender.id,
                text: text,
                timestamp: createdAt,
                // Optional: add status reference if schema allows. 
                // For now, let's assume standard columns.
            });

        if (msgErr) {
            console.error('[status/reply] msg insert error', msgErr);
            return NextResponse.json({ error: 'Failed to send reply', code: 'db_error' }, { status: 500 });
        }

        // 4. Update conversation last message
        await supabaseAdmin
            .from('friends')
            .update({
                last_message: text,
                last_message_at: createdAt,
                // unread count logic?
            })
            .eq('id', dmId);

        // 5. Push Notification
        const { sendPushNotification } = await import('@/lib/pushNotifications');
        sendPushNotification(receiverId, {
            title: sender.username,
            body: `Replied to your status: ${text}`,
            data: { type: 'status_reply', dmId, statusId }
        });

        return NextResponse.json({ success: true, message_id: messageId });

    } catch (err) {
        console.error('[status/reply] unexpected', err);
        return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
    }
}
