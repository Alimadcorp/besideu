import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getCurrentUserFromRequest } from '@/lib/authUser';

export async function GET(req) {
  try {
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized', code: 'unauthorized' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all'; // 'created', 'invited', 'all'

    let meetings = [];

    // Get meetings created by user
    if (type === 'all' || type === 'created') {
      const { data: created, error: createdErr } = await supabaseAdmin
        .from('meetings')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (!createdErr && created) {
        meetings.push(...created.map((m) => ({ ...m, role: 'creator' })));
      }
    }

    // Get meetings user is invited to
    if (type === 'all' || type === 'invited') {
      const { data: invitations, error: inviteErr } = await supabaseAdmin
        .from('meeting_invitations')
        .select('meeting_id, status, meetings(*)')
        .eq('invited_user_id', user.id);

      if (!inviteErr && invitations) {
        invitations.forEach((inv) => {
          if (inv.meetings) {
            meetings.push({
              ...inv.meetings,
              invitation_status: inv.status,
              role: 'invited',
            });
          }
        });
      }
    }

    // Remove duplicates (in case user created and was also invited somehow)
    const meetingMap = new Map();
    meetings.forEach((m) => {
      if (!meetingMap.has(m.id) || m.role === 'creator') {
        meetingMap.set(m.id, m);
      }
    });

    return NextResponse.json({
      meetings: Array.from(meetingMap.values()),
    });
  } catch (err) {
    console.error('[meetings/list] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}

