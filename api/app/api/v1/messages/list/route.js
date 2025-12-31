import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getCurrentUserFromRequest } from '@/lib/authUser';

export async function GET(req) {
  const { user, error: authError } = await getCurrentUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const after = searchParams.get('after');
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');

  let limit = Number(limitParam);
  if (!Number.isFinite(limit) || limit <= 0) limit = 50;
  limit = Math.min(limit, 100);
  const offset = Number.isFinite(Number(offsetParam)) && Number(offsetParam) >= 0 ? Number(offsetParam) : 0;

  try {
    // 1. Fetch DM Chats (Friends)
    const { data: friendRows, error: friendError } = await supabaseAdmin
      .from('friends')
      .select('id, user_id_1, user_id_2, last_message, last_message_at, unread_count_1, unread_count_2, hidden_by_user_1, hidden_by_user_2')
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
      .order('last_message_at', { ascending: false });

    if (friendError) {
      console.error('[messages/list] fetch friends error', friendError);
      return NextResponse.json({ error: 'Failed to fetch messages', code: 'supabase_error' }, { status: 500 });
    }

    const visibleDMs = (friendRows || []).filter(row => {
      return row.user_id_1 === user.id ? !row.hidden_by_user_1 : !row.hidden_by_user_2;
    }).map(row => ({ ...row, type: 'dm' }));

    // 2. Fetch Meeting Chats
    const { data: meetingMemberships, error: mmError } = await supabaseAdmin
      .from('meeting_channel_members')
      .select('user_id, joined_at, channel_id, meeting_channels(id, meeting_id, meetings(id, title, location))')
      .eq('user_id', user.id);

    let meetingChats = [];
    if (!mmError && meetingMemberships && meetingMemberships.length > 0) {
      const channelIds = meetingMemberships.map(m => m.channel_id);

      // Get last message for each channel
      const { data: lastMessages, error: lmError } = await supabaseAdmin
        .from('meeting_channel_messages')
        .select('channel_id, text, timestamp')
        .in('channel_id', channelIds)
        .order('timestamp', { ascending: false }); // Heuristic: we'll have to pick latest per channel manually or use complex query

      // Map last messages to channels
      const lastMsgMap = {};
      if (lastMessages) {
        lastMessages.forEach(msg => {
          if (!lastMsgMap[msg.channel_id]) {
            lastMsgMap[msg.channel_id] = msg;
          }
        });
      }

      meetingChats = meetingMemberships.map(membership => {
        const channel = membership.meeting_channels;
        const meeting = channel?.meetings;
        const lastMsg = lastMsgMap[channel.id];

        if (!meeting) return null;

        return {
          id: channel.id, // channel_id acts as chat id
          type: 'meeting',
          meeting_id: meeting.id,
          title: meeting.title,
          location: meeting.location,
          last_message: {
            text: lastMsg?.text || `Joined meeting chat`,
            timestamp: lastMsg?.timestamp || membership.joined_at
          },
          unread_count: 0, // Placeholder: implement real count later
          updated_at: lastMsg?.timestamp || membership.joined_at
        };
      }).filter(Boolean);
    }

    // 3. Combine and Sort
    const allChats = [...visibleDMs, ...meetingChats].sort((a, b) => {
      const timeA = new Date(a.updated_at || 0).getTime();
      const timeB = new Date(b.updated_at || 0).getTime();
      return timeB - timeA;
    });

    // Pagination
    const paginated = allChats.slice(offset, offset + limit);
    if (paginated.length === 0) {
      return NextResponse.json({ dms: [], pagination: { limit, offset, returned: 0 } });
    }

    // resolve user details for DMs only
    const otherUserIds = new Set();
    paginated.filter(c => c.type === 'dm').forEach(row => {
      const otherId = row.user_id_1 === user.id ? row.user_id_2 : row.user_id_1;
      if (otherId) otherUserIds.add(otherId);
    });
    // Include self
    if (paginated.some(c => c.type === 'dm' && c.user_id_1 === c.user_id_2)) {
      otherUserIds.add(user.id);
    }

    const { data: usersData } = await supabaseAdmin
      .from('users')
      .select('id, username, real_name, avatar_url')
      .in('id', Array.from(otherUserIds));

    const userMap = {};
    if (usersData) usersData.forEach(u => userMap[u.id] = u);

    // Final mapping
    const dms = paginated.map(chat => {
      if (chat.type === 'meeting') {
        return {
          id: chat.id, // channel_id
          type: 'meeting',
          username: chat.title, // Display title as username
          real_name: 'Meeting Chat',
          avatar_url: null, // Could use specific icon handling in client
          last_message: chat.last_message,
          unread_count: chat.unread_count,
          updated_at: chat.updated_at,
          meeting_id: chat.meeting_id
        };
      } else {
        // DM
        const isUser1 = chat.user_id_1 === user.id;
        const isSelfChat = chat.user_id_1 === chat.user_id_2;
        const otherId = isUser1 ? chat.user_id_2 : chat.user_id_1;
        const otherUser = userMap[otherId] || { id: otherId, username: isSelfChat ? 'Yourself' : 'Unknown' };

        return {
          id: chat.id,
          type: 'dm',
          user_id: otherUser.id,
          username: otherUser.username,
          real_name: otherUser.real_name,
          avatar_url: otherUser.avatar_url,
          last_message: {
            text: chat.last_message || '',
            timestamp: chat.last_message_at || chat.created_at,
          },
          unread_count: isUser1 ? (isSelfChat ? 0 : chat.unread_count_1) : chat.unread_count_2,
          updated_at: chat.last_message_at || chat.created_at
        };
      }
    });

    return NextResponse.json({
      dms,
      pagination: { limit, offset, returned: dms.length },
    });
  } catch (err) {
    console.error('[messages/list] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}
