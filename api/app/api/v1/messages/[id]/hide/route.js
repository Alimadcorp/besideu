import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../../lib/authUser';

export async function POST(req, { params }) {
  try {
    const { id: dmId } = await params;
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized', code: 'unauthorized' },
        { status: 401 },
      );
    }

    // Get friendship
    const { data: friendRow, error: friendErr } = await supabaseAdmin
      .from('friends')
      .select('user_id_1, user_id_2')
      .eq('id', dmId)
      .single();

    if (friendErr || !friendRow) {
      return NextResponse.json(
        { error: 'Conversation not found', code: 'not_found' },
        { status: 404 },
      );
    }

    const isUser1 = friendRow.user_id_1 === user.id;
    const isUser2 = friendRow.user_id_2 === user.id;

    if (!isUser1 && !isUser2) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'forbidden' },
        { status: 403 },
      );
    }

    // Update hidden flag
    const updates = {};
    if (isUser1) {
      updates.hidden_by_user_1 = true;
    } else {
      updates.hidden_by_user_2 = true;
    }

    const { error: updateErr } = await supabaseAdmin
      .from('friends')
      .update(updates)
      .eq('id', dmId);

    if (updateErr) {
      console.error('[messages/hide] Failed to hide chat', updateErr);
      return NextResponse.json(
        { error: 'Failed to hide chat', code: 'supabase_error' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error('[messages/hide] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id: dmId } = await params;
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized', code: 'unauthorized' },
        { status: 401 },
      );
    }

    // Get friendship
    const { data: friendRow, error: friendErr } = await supabaseAdmin
      .from('friends')
      .select('user_id_1, user_id_2')
      .eq('id', dmId)
      .single();

    if (friendErr || !friendRow) {
      return NextResponse.json(
        { error: 'Conversation not found', code: 'not_found' },
        { status: 404 },
      );
    }

    const isUser1 = friendRow.user_id_1 === user.id;
    const isUser2 = friendRow.user_id_2 === user.id;

    if (!isUser1 && !isUser2) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'forbidden' },
        { status: 403 },
      );
    }

    // Unhide chat
    const updates = {};
    if (isUser1) {
      updates.hidden_by_user_1 = false;
    } else {
      updates.hidden_by_user_2 = false;
    }

    const { error: updateErr } = await supabaseAdmin
      .from('friends')
      .update(updates)
      .eq('id', dmId);

    if (updateErr) {
      console.error('[messages/hide] Failed to unhide chat', updateErr);
      return NextResponse.json(
        { error: 'Failed to unhide chat', code: 'supabase_error' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error('[messages/hide] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}

