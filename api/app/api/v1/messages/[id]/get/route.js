import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getCurrentUserFromRequest } from '@/lib/authUser';

export async function GET(req, { params }) {
  const { id: chatId } = await params;
  const { user, error: authError } = await getCurrentUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const after = searchParams.get('after');
  const type = searchParams.get('type') || 'dm'; // 'dm' or 'meeting'

  try {
    let messages = [];
    let chatInfo = null;
    let reactions = [];

    if (type === 'meeting') {
      // 1. Verify membership
      const { data: membership, error: memError } = await supabaseAdmin
        .from('meeting_channel_members')
        .select('channel_id')
        .eq('channel_id', chatId)
        .eq('user_id', user.id)
        .single();

      if (memError || !membership) {
        return NextResponse.json({ error: 'Not a member of this meeting chat', code: 'forbidden' }, { status: 403 });
      }

      // 2. Fetch Meeting Info
      const { data: channelData } = await supabaseAdmin
        .from('meeting_channels')
        .select('*, meetings(*)')
        .eq('id', chatId)
        .single();

      if (channelData) {
        chatInfo = {
          id: channelData.id,
          username: channelData.meetings.title,
          real_name: 'Meeting Chat',
          avatar_url: null, // Client handles this based on type or we calculate unique avatar
          is_meeting: true,
          meeting_id: channelData.meetings.id,
          share_url: `besideu://meeting/${channelData.meetings.id}`
        };
      }

      // 3. Fetch Messages
      let msgQuery = supabaseAdmin
        .from('meeting_channel_messages')
        .select('*, sender:sender_id(id, username, real_name, avatar_url)')
        .eq('channel_id', chatId)
        .order('timestamp', { ascending: true });

      if (after) {
        msgQuery = msgQuery.gte('timestamp', after);
      }

      const { data: msgs, error: msgErr } = await msgQuery;
      if (!msgErr && msgs) {
        messages = msgs.map(m => ({
          id: m.id,
          text: m.text,
          image_url: m.image_url,
          sender_id: m.sender_id,
          timestamp: m.timestamp,
          sender_user: m.sender, // Include sender info for group chat UI
        }));
      }

    } else {
      // DM Logic (Existing)
      const now = new Date().toISOString();
      let msgQuery = supabaseAdmin
        .from('messages')
        .select('*')
        .eq('dm_id', chatId)
        .or(`scheduled_at.is.null,scheduled_at.lte.${now},sender_id.eq.${user.id}`)
        .order('timestamp', { ascending: true });

      if (after) {
        msgQuery = msgQuery.gte('timestamp', after);
      }

      const { data: msgs, error: msgErr } = await msgQuery;
      if (msgErr) throw msgErr;
      messages = msgs;

      // ... existing DM reaction/meetup logic ...
      // Only simpler version for now as requested
      // Fetch friend info
      const { data: friendRow } = await supabaseAdmin
        .from('friends')
        .select('user_id_1, user_id_2, u1:user_id_1(id, username, real_name, avatar_url), u2:user_id_2(id, username, real_name, avatar_url)')
        .eq('id', chatId)
        .single();

      const friendInfo = friendRow ? (friendRow.user_id_1 === user.id ? friendRow.u2 : friendRow.u1) : null;
      chatInfo = friendInfo;
    }

    return NextResponse.json({
      dm_id: chatId,
      user: chatInfo,
      messages: messages,
      reactions: reactions,
    });

  } catch (err) {
    console.error('[messages/get] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}
