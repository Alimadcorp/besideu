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
    const { location, timestamp, meta } = body || {};
    if (!location || typeof location.lat !== 'number' || typeof location.long !== 'number') {
      return NextResponse.json({ error: 'location.lat and location.long required', code: 'invalid_location' }, { status: 400 });
    }

    const meetupId = uuidv4();
    const createdAt = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('meetups')
      .insert({
        id: meetupId,
        dm_id: dmId,
        requested_by: user.id,
        requested_from: meta?.requested_from || null,
        status: 'accepted',
        location,
        expires_at: null,
        created_at: createdAt,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[messages/meetup] insert', error);
      return NextResponse.json({ error: 'Failed to create meetup', code: 'supabase_error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, meetup_id: data.id });
  } catch (err) {
    console.error('[messages/meetup] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}


