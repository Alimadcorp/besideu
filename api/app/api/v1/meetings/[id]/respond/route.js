import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getCurrentUserFromRequest } from '@/lib/authUser';

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

    const body = await req.json();
    const { status } = body || {}; // 'accepted' or 'declined'

    if (!status || !['accepted', 'declined'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be "accepted" or "declined"', code: 'bad_request' },
        { status: 400 },
      );
    }

    // Update invitation
    const { data: invitation, error: inviteErr } = await supabaseAdmin
      .from('meeting_invitations')
      .update({
        status,
        responded_at: new Date().toISOString(),
      })
      .eq('meeting_id', id)
      .eq('invited_user_id', user.id)
      .select()
      .single();

    if (inviteErr || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found', code: 'not_found' },
        { status: 404 },
      );
    }

    // If accepted and meeting has channel, add user to channel
    if (status === 'accepted') {
      const { data: meeting } = await supabaseAdmin
        .from('meetings')
        .select('channel_id')
        .eq('id', id)
        .single();

      if (meeting?.channel_id) {
        await supabaseAdmin
          .from('meeting_channel_members')
          .upsert({
            channel_id: meeting.channel_id,
            user_id: user.id,
          }, { onConflict: 'channel_id,user_id' });
      }
    }

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (err) {
    console.error('[meetings/respond] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}

