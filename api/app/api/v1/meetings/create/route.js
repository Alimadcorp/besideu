import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getCurrentUserFromRequest } from '@/lib/authUser';

export async function POST(req) {
  try {
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized', code: 'unauthorized' },
        { status: 401 },
      );
    }

    // Check if user is a business
    const { data: userData, error: userErr } = await supabaseAdmin
      .from('users')
      .select('is_business')
      .eq('id', user.id)
      .single();

    if (userErr || !userData?.is_business) {
      return NextResponse.json(
        { error: 'Only business profiles can create meetings', code: 'not_business' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { title, description, location, threshold_km, starts_at, ends_at, has_channel, invite_user_ids } = body || {};

    // Validate required fields
    if (!title || !location || !threshold_km) {
      return NextResponse.json(
        { error: 'title, location, and threshold_km are required', code: 'bad_request' },
        { status: 400 },
      );
    }

    if (!location.lat || !location.lon) {
      return NextResponse.json(
        { error: 'location must have lat and lon', code: 'invalid_location' },
        { status: 400 },
      );
    }

    if (threshold_km <= 0 || threshold_km > 10) {
      return NextResponse.json(
        { error: 'threshold_km must be between 0 and 10', code: 'invalid_threshold' },
        { status: 400 },
      );
    }

    // Create meeting
    const { data: meeting, error: meetingErr } = await supabaseAdmin
      .from('meetings')
      .insert({
        creator_id: user.id,
        title,
        description: description || null,
        location,
        threshold_km,
        starts_at: starts_at ? new Date(starts_at).toISOString() : null,
        ends_at: ends_at ? new Date(ends_at).toISOString() : null,
        has_channel: has_channel || false,
      })
      .select()
      .single();

    if (meetingErr) {
      console.error('[meetings/create] Failed to create meeting', meetingErr);
      return NextResponse.json(
        { error: 'Failed to create meeting', code: 'supabase_error' },
        { status: 500 },
      );
    }

    // Create channel if requested
    if (has_channel && meeting.id) {
      const { data: channel, error: channelErr } = await supabaseAdmin
        .from('meeting_channels')
        .insert({
          meeting_id: meeting.id,
        })
        .select()
        .single();

      if (!channelErr && channel) {
        // Update meeting with channel_id
        await supabaseAdmin
          .from('meetings')
          .update({ channel_id: channel.id })
          .eq('id', meeting.id);

        // Add creator as channel member
        await supabaseAdmin
          .from('meeting_channel_members')
          .insert({
            channel_id: channel.id,
            user_id: user.id,
          });

        meeting.channel_id = channel.id;
      }
    }

    // Create invitations if user_ids provided
    if (invite_user_ids && Array.isArray(invite_user_ids) && invite_user_ids.length > 0) {
      // Verify all users are friends - check each one individually
      const validFriendIds = new Set();
      
      for (const invitedId of invite_user_ids) {
        const id1 = user.id < invitedId ? user.id : invitedId;
        const id2 = user.id < invitedId ? invitedId : user.id;
        
        const { data: friendship } = await supabaseAdmin
          .from('friends')
          .select('user_id_1, user_id_2')
          .eq('user_id_1', id1)
          .eq('user_id_2', id2)
          .maybeSingle();
        
        if (friendship) {
          validFriendIds.add(invitedId);
        }
      }

      // Only invite users who are actually friends
      const validInviteIds = invite_user_ids.filter(id => validFriendIds.has(id));

      if (validInviteIds.length > 0) {
        const invitations = validInviteIds.map((invitedId) => ({
          meeting_id: meeting.id,
          invited_user_id: invitedId,
          status: 'pending',
        }));

        const { error: inviteErr } = await supabaseAdmin
          .from('meeting_invitations')
          .insert(invitations);

        if (inviteErr) {
          console.error('[meetings/create] Failed to create invitations', inviteErr);
          // Don't fail the whole request, just log the error
        }

        // Send push notifications to invited users
        try {
          const { sendPushNotifications } = await import('@/lib/pushNotifications');
          const { data: creatorInfo } = await supabaseAdmin
            .from('users')
            .select('real_name, username')
            .eq('id', user.id)
            .single();

          const creatorName = creatorInfo?.real_name || creatorInfo?.username || 'Someone';
          await sendPushNotifications(validInviteIds, {
            title: 'Meeting Invitation',
            body: `${creatorName} invited you to "${title}"`,
            data: { type: 'meeting_invitation', meeting_id: meeting.id }
          });
        } catch (notifErr) {
          console.error('[meetings/create] Failed to send notifications', notifErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      meeting: {
        id: meeting.id,
        title: meeting.title,
        description: meeting.description,
        location: meeting.location,
        threshold_km: meeting.threshold_km,
        starts_at: meeting.starts_at,
        ends_at: meeting.ends_at,
        has_channel: meeting.has_channel,
        channel_id: meeting.channel_id,
        created_at: meeting.created_at,
        invitation_url: `besideu://meeting/${meeting.id}`, // Deep link URL
      },
    });
  } catch (err) {
    console.error('[meetings/create] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}

