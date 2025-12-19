import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../../lib/authUser';

export async function GET(req, { params }) {
  const { user, error: authError } = await getCurrentUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  const dmId = params?.id;
  if (!dmId) {
    return NextResponse.json({ error: 'dm id required', code: 'bad_request' }, { status: 400 });
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

    return NextResponse.json({
      dm_id: dmId,
      user: null,
      messages,
      reactions,
    });
  } catch (err) {
    console.error('[messages/get] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}


