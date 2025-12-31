import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../../lib/authUser';

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

    // Verify meeting exists and user is creator
    const { data: meeting, error: meetingErr } = await supabaseAdmin
      .from('meetings')
      .select('creator_id')
      .eq('id', id)
      .single();

    if (meetingErr || !meeting) {
      return NextResponse.json(
        { error: 'Meeting not found', code: 'not_found' },
        { status: 404 },
      );
    }

    if (meeting.creator_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the meeting creator can invite users', code: 'forbidden' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { user_ids } = body || {};

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json(
        { error: 'user_ids array is required', code: 'bad_request' },
        { status: 400 },
      );
    }

    // Create invitations (ignore duplicates)
    const invitations = user_ids.map((userId) => ({
      meeting_id: id,
      invited_user_id: userId,
      status: 'pending',
    }));

    const { error: inviteErr } = await supabaseAdmin
      .from('meeting_invitations')
      .upsert(invitations, { onConflict: 'meeting_id,invited_user_id', ignoreDuplicates: false });

    if (inviteErr) {
      console.error('[meetings/invite] Failed to create invitations', inviteErr);
      return NextResponse.json(
        { error: 'Failed to create invitations', code: 'supabase_error' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      invitation_url: `besideu://meeting/${id}`,
    });
  } catch (err) {
    console.error('[meetings/invite] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}

