import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../../lib/authUser';


export async function POST(req, { params }) {
  const { id: dmId } = await params;
  const { user, error: authError } = await getCurrentUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { location, timestamp, meta } = body || {};
    if (!location || typeof location.lat !== 'number' || typeof location.long !== 'number') {
      return NextResponse.json({ error: 'location.lat and location.long required', code: 'invalid_location' }, { status: 400 });
    }

    const meetupRequestId = meta?.meetup_request_id;
    let data, error;

    if (meetupRequestId) {
      // Update existing pending request
      ({ data, error } = await supabaseAdmin
        .from('meetups')
        .update({
          status: 'accepted',
          location,
          // Extend expiration or clear it? Let's keep it as is or update it.
          // For now just update status and location.
        })
        .eq('id', meetupRequestId)
        .eq('status', 'pending') // Ensure we only update pending ones
        .select('id')
        .single());

      if (!data && !error) {
        return NextResponse.json({ error: 'Meetup request not found or expired', code: 'not_found' }, { status: 404 });
      }
    } else {
      // Create new spontaneous meetup location share (if feature supported)
      const meetupId = crypto.randomUUID();
      ({ data, error } = await supabaseAdmin
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
        .single());
    }

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


