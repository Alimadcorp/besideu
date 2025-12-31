import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../../../lib/authUser';

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

    // Get meeting and channel
    const { data: meeting, error: meetingErr } = await supabaseAdmin
      .from('meetings')
      .select('channel_id, creator_id')
      .eq('id', id)
      .single();

    if (meetingErr || !meeting || !meeting.channel_id) {
      return NextResponse.json(
        { error: 'Meeting channel not found', code: 'not_found' },
        { status: 404 },
      );
    }

    // Check if user is channel member or creator
    const { data: member } = await supabaseAdmin
      .from('meeting_channel_members')
      .select('user_id')
      .eq('channel_id', meeting.channel_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member && meeting.creator_id !== user.id) {
      return NextResponse.json(
        { error: 'Not a member of this channel', code: 'forbidden' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const after = searchParams.get('after');

    // Get messages
    let query = supabaseAdmin
      .from('meeting_channel_messages')
      .select('*, users(id, username, real_name, avatar_url)')
      .eq('channel_id', meeting.channel_id)
      .order('timestamp', { ascending: false })
      .limit(50);

    if (after) {
      query = query.lt('timestamp', after);
    }

    const { data: messages, error: msgErr } = await query;

    if (msgErr) {
      console.error('[channel/messages] Failed to fetch messages', msgErr);
      return NextResponse.json(
        { error: 'Failed to fetch messages', code: 'supabase_error' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      messages: messages || [],
    });
  } catch (err) {
    console.error('[channel/messages] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
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

    // Get meeting and channel
    const { data: meeting, error: meetingErr } = await supabaseAdmin
      .from('meetings')
      .select('channel_id')
      .eq('id', id)
      .single();

    if (meetingErr || !meeting || !meeting.channel_id) {
      return NextResponse.json(
        { error: 'Meeting channel not found', code: 'not_found' },
        { status: 404 },
      );
    }

    // Check if user is channel member
    const { data: member } = await supabaseAdmin
      .from('meeting_channel_members')
      .select('user_id')
      .eq('channel_id', meeting.channel_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json(
        { error: 'Not a member of this channel', code: 'forbidden' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { text, image_url } = body || {};

    if (!text && !image_url) {
      return NextResponse.json(
        { error: 'text or image_url is required', code: 'bad_request' },
        { status: 400 },
      );
    }

    if (text && text.length > 2000) {
      return NextResponse.json(
        { error: 'text is too long (<=2000 chars)', code: 'invalid_text' },
        { status: 400 },
      );
    }

    // Insert message
    const { data: message, error: msgErr } = await supabaseAdmin
      .from('meeting_channel_messages')
      .insert({
        channel_id: meeting.channel_id,
        sender_id: user.id,
        text: text || null,
        image_url: image_url || null,
      })
      .select()
      .single();

    if (msgErr) {
      console.error('[channel/send] Failed to send message', msgErr);
      return NextResponse.json(
        { error: 'Failed to send message', code: 'supabase_error' },
        { status: 500 },
      );
    }

    // Update channel updated_at
    await supabaseAdmin
      .from('meeting_channels')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', meeting.channel_id);

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (err) {
    console.error('[channel/send] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}

