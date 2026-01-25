import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getCurrentUserFromRequest } from '@/lib/authUser';
import { hashLocationAll } from '@/lib/crypto';

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized', code: 'unauthorized' },
        { status: 401 },
      );
    }

    // Get meeting
    const { data: meeting, error: meetingErr } = await supabaseAdmin
      .from('meetings')
      .select('location, threshold_km, creator_id, channel_id')
      .eq('id', id)
      .single();

    if (meetingErr || !meeting) {
      return NextResponse.json(
        { error: 'Meeting not found', code: 'not_found' },
        { status: 404 },
      );
    }

    // Check if user is invited and accepted
    const { data: invitation } = await supabaseAdmin
      .from('meeting_invitations')
      .select('status')
      .eq('meeting_id', id)
      .eq('invited_user_id', user.id)
      .maybeSingle();

    if (!invitation || invitation.status !== 'accepted') {
      return NextResponse.json(
        { error: 'You must accept the meeting invitation first', code: 'not_invited' },
        { status: 403 },
      );
    }

    // Get user's current location
    const body = await req.json();
    const { lat, lon } = body || {};

    if (!lat || !lon) {
      return NextResponse.json(
        { error: 'lat and lon are required', code: 'bad_request' },
        { status: 400 },
      );
    }

    // Calculate distance
    // Calculate distance
    const distance = calculateDistance(
      meeting.location.lat,
      meeting.location.lon,
      lat,
      lon,
    );

    const isWithinThreshold = distance <= meeting.threshold_km;
    const now = new Date().toISOString();

    // Get last log to determine current state
    const { data: lastLog } = await supabaseAdmin
      .from('meeting_logs')
      .select('type')
      .eq('meeting_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const wasInside = lastLog?.type === 'entered';
    let eventType = null;

    if (isWithinThreshold && !wasInside) {
      eventType = 'entered';
    } else if (!isWithinThreshold && wasInside) {
      eventType = 'exited';
    }

    // specific rule: "stop sharing location after a user has reached."
    // "Unless, the user leaves, track leaving time."
    // This implies we DO track them leaving. So we keep sharing internally, but maybe specific visibility rules apply.
    // We will just log everything for now.

    if (eventType) {
      await supabaseAdmin
        .from('meeting_logs')
        .insert({
          meeting_id: id,
          user_id: user.id,
          type: eventType,
          location: { lat, lon },
          distance_km: distance,
          created_at: now
        });

      // Send to chat channel if exists
      if (meeting.channel_id) {
        const text = eventType === 'entered' ? 'has reached the meeting location.' : 'has left the meeting location.';
        await supabaseAdmin.from('meeting_channel_messages').insert({
          channel_id: meeting.channel_id,
          sender_id: user.id,
          text: text,
          timestamp: now,
        });
      }
    }

    // Update live location for creator view (using meeting_invitations or a tracking table)
    // We'll update meeting_invitations with metadata for current location
    await supabaseAdmin
      .from('meeting_invitations')
      .update({
        current_lat: lat,
        current_lon: lon,
        last_seen_at: now,
        participation_status: isWithinThreshold ? 'arrived' : 'transit' // 'arrived' inside, 'transit' outside
      })
      .eq('meeting_id', id)
      .eq('invited_user_id', user.id);

    return NextResponse.json({
      is_within_threshold: isWithinThreshold,
      distance_km: distance,
      threshold_km: meeting.threshold_km,
      status: isWithinThreshold ? 'arrived' : 'transit'
    });
  } catch (err) {
    console.error('[meetings/check-arrival] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}

