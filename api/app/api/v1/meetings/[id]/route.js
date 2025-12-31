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

    // Get attendees (accepted invitations)
    const { data: attendees } = await supabaseAdmin
      .from('meeting_invitations')
      .select('invited_user_id, status, users(id, username, real_name, avatar_url)')
      .eq('meeting_id', id)
      .eq('status', 'accepted');

    // Get arrivals if user is creator
    let arrivals = [];
    if (isCreator) {
      const { data: arr } = await supabaseAdmin
        .from('meeting_arrivals')
        .select('user_id, arrived_at, location, users(id, username, real_name, avatar_url)')
        .eq('meeting_id', id)
        .order('arrived_at', { ascending: false });

      arrivals = arr || [];
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
        })),
        arrivals: isCreator ? arrivals : undefined,
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

