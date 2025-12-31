import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getCurrentUserFromRequest } from '@/lib/authUser';

export async function POST(req, { params }) {
  const { id: dmId } = await params;
  const { user, error: authError } = await getCurrentUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  try {
    // 1. Rate Limiting (1 message per second per user)
    const oneSecondAgo = new Date(Date.now() - 1000).toISOString();
    const { data: lastMsg } = await supabaseAdmin
      .from('messages')
      .select('timestamp')
      .eq('sender_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastMsg && lastMsg.timestamp > oneSecondAgo) {
      return NextResponse.json({ error: 'Too fast. Please wait a second.', code: 'rate_limit' }, { status: 429 });
    }

    // 2. Validate DM and Get Participants
    const { data: friendRow, error: friendErr } = await supabaseAdmin
      .from('friends')
      .select('*')
      .eq('id', dmId)
      .single();

    if (friendErr || !friendRow) {
      return NextResponse.json({ error: 'Conversation not found', code: 'not_found' }, { status: 404 });
    }

    const isUser1 = friendRow.user_id_1 === user.id;
    const isUser2 = friendRow.user_id_2 === user.id;
    const isSelfChat = friendRow.user_id_1 === friendRow.user_id_2;

    if (!isUser1 && !isUser2) {
      return NextResponse.json({ error: 'Unauthorized to send to this conversation', code: 'forbidden' }, { status: 403 });
    }

    // Check if blocked
    if (!isSelfChat) {
      const otherUserId = isUser1 ? friendRow.user_id_2 : friendRow.user_id_1;
      const { data: block } = await supabaseAdmin
        .from('user_blocks')
        .select('id')
        .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${user.id})`)
        .maybeSingle();

      if (block) {
        return NextResponse.json({ error: 'Cannot send message (user is blocked)', code: 'blocked' }, { status: 403 });
      }
    }

    const otherUserId = isUser1 ? friendRow.user_id_2 : friendRow.user_id_1;

    // 3. Parse Body
    const body = await req.json();
    const { text, timestamp, meetup, image_url, scheduled_at } = body || {};

    if (!text && !image_url && !meetup) {
      return NextResponse.json({ error: 'Message content is required (text or image)', code: 'bad_request' }, { status: 400 });
    }

    if (text && text.length > 2000) {
      return NextResponse.json({ error: 'text is too long (<=2000 chars)', code: 'invalid_text' }, { status: 400 });
    }

    if (scheduled_at) {
      const scheduledDate = new Date(scheduled_at);
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (scheduledDate <= now) {
        return NextResponse.json({ error: 'Scheduled time must be in the future', code: 'invalid_schedule' }, { status: 400 });
      }
      if (scheduledDate > sevenDaysFromNow) {
        return NextResponse.json({ error: 'Cannot schedule more than 7 days in advance', code: 'too_far_ahead' }, { status: 400 });
      }
    }

    const createdAt = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
    const messageId = crypto.randomUUID();
    let meetupRequestId = null;

    // 4. Create Meetup if requested
    if (meetup) {
      meetupRequestId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      const { error: meetupErr } = await supabaseAdmin
        .from('meetups')
        .insert({
          id: meetupRequestId,
          dm_id: dmId,
          requested_by: user.id,
          requested_from: otherUserId,
          status: 'pending',
          expires_at: expiresAt,
          created_at: createdAt,
          location: null
        });

      if (meetupErr) {
        console.error('[messages/send] meetup create', meetupErr);
        return NextResponse.json({ error: 'Failed to create meetup request', code: 'supabase_error' }, { status: 500 });
      }
    }

    // 5. Insert Message
    const { error: msgErr } = await supabaseAdmin
      .from('messages')
      .insert({
        id: messageId,
        dm_id: dmId,
        sender_id: user.id,
        text: text || (image_url ? 'Image' : ''),
        image_url: image_url || null,
        timestamp: createdAt,
        meetup_request_id: meetupRequestId,
        scheduled_at: scheduled_at ? new Date(scheduled_at).toISOString() : null,
      });

    if (msgErr) {
      console.error('[messages/send] insert', msgErr);
      return NextResponse.json({ error: 'Failed to send message', code: 'supabase_error' }, { status: 500 });
    }

    // 6. Update Friends (Inbox & Unread) - ONLY IF NOT SCHEDULED
    if (!scheduled_at) {
      const updates = {
        last_message: text || (image_url ? 'Image' : 'Meetup Request'),
        last_message_at: createdAt,
      };

      // If chat was hidden, unhide it
      if (isUser1 && friendRow.hidden_by_user_1) {
        updates.hidden_by_user_1 = false;
      } else if (isUser2 && friendRow.hidden_by_user_2) {
        updates.hidden_by_user_2 = false;
      }

      // Increment unread count for the OTHER user (skip for self-chat)
      if (!isSelfChat) {
        if (isUser1) {
          updates.unread_count_2 = (friendRow.unread_count_2 || 0) + 1;
        } else {
          updates.unread_count_1 = (friendRow.unread_count_1 || 0) + 1;
        }
      }

      await supabaseAdmin
        .from('friends')
        .update(updates)
        .eq('id', dmId);

      // Send push notification (skip for self-chat)
      if (!isSelfChat) {
        const { sendPushNotification } = await import('@/lib/pushNotifications');
        sendPushNotification(otherUserId, {
          title: user.username,
          body: text || (image_url ? '📷 Sent an image' : 'Sent a meetup request'),
          data: { type: 'new_message', dmId }
        });
      }
    }

    return NextResponse.json({
      success: true,
      message_id: messageId,
      timestamp: createdAt,
      meetup_request_id: meetupRequestId
    });
  } catch (err) {
    console.error('[messages/send] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}
