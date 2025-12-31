import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// This endpoint processes scheduled messages that are due
// Should be called by a cron job every minute
export async function POST(req) {
    try {
        // Verify cron secret to prevent unauthorized access
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const now = new Date().toISOString();

        // Find all scheduled messages that are due
        const { data: scheduledMessages, error: fetchError } = await supabaseAdmin
            .from('messages')
            .select('*, dm_id')
            .not('scheduled_at', 'is', null)
            .lte('scheduled_at', now)
            .limit(100);

        if (fetchError) {
            console.error('[cron/scheduled-messages] fetch error', fetchError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        if (!scheduledMessages || scheduledMessages.length === 0) {
            return NextResponse.json({ processed: 0, message: 'No scheduled messages due' });
        }

        let processed = 0;
        const { sendPushNotification } = await import('@/lib/pushNotifications');

        for (const msg of scheduledMessages) {
            try {
                // Get the DM/friend record
                const { data: friendRow } = await supabaseAdmin
                    .from('friends')
                    .select('*')
                    .eq('id', msg.dm_id)
                    .single();

                if (!friendRow) continue;

                const isUser1 = friendRow.user_id_1 === msg.sender_id;
                const otherUserId = isUser1 ? friendRow.user_id_2 : friendRow.user_id_1;

                // Update the message to mark it as sent
                await supabaseAdmin
                    .from('messages')
                    .update({ scheduled_at: null })
                    .eq('id', msg.id);

                // Update friends table with last message and unread count
                const updates = {
                    last_message: msg.text || (msg.image_url ? '📷 Image' : 'Meetup Request'),
                    last_message_at: now,
                };

                if (isUser1) {
                    updates.unread_count_2 = (friendRow.unread_count_2 || 0) + 1;
                } else {
                    updates.unread_count_1 = (friendRow.unread_count_1 || 0) + 1;
                }

                await supabaseAdmin
                    .from('friends')
                    .update(updates)
                    .eq('id', msg.dm_id);

                // Get sender info for notification
                const { data: sender } = await supabaseAdmin
                    .from('users')
                    .select('username')
                    .eq('id', msg.sender_id)
                    .single();

                // Send push notification
                if (sender) {
                    sendPushNotification(otherUserId, {
                        title: sender.username,
                        body: msg.text || (msg.image_url ? '📷 Sent an image' : 'Sent a meetup request'),
                        data: { type: 'new_message', dmId: msg.dm_id }
                    });
                }

                processed++;
            } catch (err) {
                console.error('[cron/scheduled-messages] process error', err);
            }
        }

        return NextResponse.json({
            processed,
            total: scheduledMessages.length,
            message: `Processed ${processed} scheduled messages`
        });
    } catch (err) {
        console.error('[cron/scheduled-messages] unexpected error', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
