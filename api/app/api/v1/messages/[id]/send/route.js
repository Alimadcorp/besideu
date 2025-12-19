import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../../lib/authUser';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req, { params }) {
  const { user, error: authError } = await getCurrentUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  const dmId = params?.id;
  if (!dmId) {
    return NextResponse.json({ error: 'dm id required', code: 'bad_request' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { text, timestamp, meetup, meta } = body || {};
    if (!text || typeof text !== 'string' || text.length > 2000) {
      return NextResponse.json({ error: 'text is required (<=2000 chars)', code: 'invalid_text' }, { status: 400 });
    }

    const messageId = uuidv4();
    const createdAt = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({
        id: messageId,
        dm_id: dmId,
        sender_id: user.id,
        text,
        timestamp: createdAt,
        meetup_request_id: meetup ? meta?.meetup_request_id || null : null,
      })
      .select('id, timestamp')
      .single();

    if (error) {
      console.error('[messages/send] insert', error);
      return NextResponse.json({ error: 'Failed to send message', code: 'supabase_error' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message_id: data.id,
      timestamp: data.timestamp,
    });
  } catch (err) {
    console.error('[messages/send] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}


