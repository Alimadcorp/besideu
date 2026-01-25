import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getCurrentUserFromRequest } from '@/lib/authUser';

export async function GET(req, { params }) {
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
      .select('*')
      .eq('id', id)
      .single();

    if (meetingErr || !meeting) {
      return NextResponse.json(
        { error: 'Meeting not found', code: 'not_found' },
        { status: 404 },
      );
    }

    // Check if user is creator or invited
    const isCreator = meeting.creator_id === user.id;

    let invitation = null;
    if (!isCreator) {
      const { data: inv } = await supabaseAdmin
        .from('meeting_invitations')
        .select('status, invited_at, responded_at')
        .eq('meeting_id', id)
        .eq('invited_user_id', user.id)
        .maybeSingle();

      invitation = inv;
    }

    // Get attendees (accepted invitations) with live status
    const { data: attendees } = await supabaseAdmin
      .from('meeting_invitations')
      .select('invited_user_id, status, participation_status, current_lat, current_lon, last_seen_at, users(id, username, real_name, avatar_url)')
      .eq('meeting_id', id)
      .eq('status', 'accepted');

    // Get logs if user is creator
    let logs = [];
    if (isCreator) {
      const { data: l } = await supabaseAdmin
        .from('meeting_logs')
        .select('user_id, type, created_at, location, distance_km, users(id, username, real_name, avatar_url)')
        .eq('meeting_id', id)
        .order('created_at', { ascending: false });

      logs = l || [];
    }

    return NextResponse.json({
      meeting: {
        ...meeting,
        invitation_status: invitation?.status,
        invitation_url: `besideu://meeting/${meeting.id}`,
        is_creator: isCreator,
        attendees: (attendees || []).map((a) => ({
          user_id: a.invited_user_id,
          user: a.users,
          status: a.status,
          participation_status: a.participation_status,
          current_lat: a.current_lat,
          current_lon: a.current_lon,
          last_seen_at: a.last_seen_at
        })),
        logs: isCreator ? logs : undefined,
      },
    });
  } catch (err) {
    console.error('[meetings/[id]] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}

