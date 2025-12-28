import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../../lib/authUser';

export async function GET(req, { params }) {
  const { id: dmId } = await params;
  const { user, error: authError } = await getCurrentUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const after = searchParams.get('after');

  try {
    let msgQuery = supabaseAdmin
      .from('messages')
      .select('*')
      .eq('dm_id', dmId)
      .order('timestamp', { ascending: true });

    if (after) {
      msgQuery = msgQuery.gte('timestamp', after);
    }

    const { data: messages, error: msgErr } = await msgQuery;
    if (msgErr) {
      console.error('[messages/get] fetch messages', msgErr);
      return NextResponse.json({ error: 'Failed to fetch messages', code: 'supabase_error' }, { status: 500 });
    }

    // Reactions table includes message_id mapping; filter by dm_id messages
    const messageIds = messages.map((m) => m.id);
    const meetupRequestIds = messages
      .filter(m => m.meetup_request_id)
      .map(m => m.meetup_request_id);

    let reactions = [];
    if (messageIds.length) {
      const { data: reacts, error: reactErr } = await supabaseAdmin
        .from('message_reactions')
        .select('*')
        .in('message_id', messageIds);
      if (reactErr) {
        console.error('[messages/get] fetch reactions', reactErr);
      } else {
        reactions = reacts;
      }
    }

    let meetupsMap = {};
    if (meetupRequestIds.length > 0) {
      const { data: meetupsData, error: meetupErr } = await supabaseAdmin
        .from('meetups')
        .select('*')
        .in('id', meetupRequestIds);

      if (meetupErr) {
        console.error('[messages/get] fetch meetups', meetupErr);
      } else if (meetupsData) {
        const now = new Date();
        meetupsData.forEach(m => {
          // Lazy expiration check
          let status = m.status;
          if (status === 'pending' && m.expires_at && new Date(m.expires_at) < now) {
            status = 'expired';
            // Optimistically update DB? maybe separately. For now just return expired.
          }
          meetupsMap[m.id] = { ...m, status };
        });
      }
    }

    // Map messages to include meetup details
    const mappedMessages = messages.map(m => {
      let meetupRequest = null;
      if (m.meetup_request_id && meetupsMap[m.meetup_request_id]) {
        meetupRequest = meetupsMap[m.meetup_request_id];
      }
      return {
        ...m,
        meetup_request: meetupRequest
      };
    });

    return NextResponse.json({
      dm_id: dmId,
      user: null, // client should know who they are talking to via DM list logic or context
      messages: mappedMessages,
      reactions,
    });
  } catch (err) {
    console.error('[messages/get] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}


