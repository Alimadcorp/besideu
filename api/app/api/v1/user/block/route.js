import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';

export async function POST(req) {
  try {
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized', code: 'unauthorized' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { user_id } = body || {};

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required', code: 'bad_request' },
        { status: 400 },
      );
    }

    if (user_id === user.id) {
      return NextResponse.json(
        { error: 'Cannot block yourself', code: 'invalid_target' },
        { status: 400 },
      );
    }

    // Create block
    const { error: blockErr } = await supabaseAdmin
      .from('user_blocks')
      .upsert({
        blocker_id: user.id,
        blocked_id: user_id,
      }, { onConflict: 'blocker_id,blocked_id' });

    if (blockErr) {
      console.error('[user/block] Failed to block user', blockErr);
      return NextResponse.json(
        { error: 'Failed to block user', code: 'supabase_error' },
        { status: 500 },
      );
    }

    // Remove friendship if exists
    const [u1, u2] = user.id < user_id ? [user.id, user_id] : [user_id, user.id];
    await supabaseAdmin
      .from('friends')
      .delete()
      .eq('user_id_1', u1)
      .eq('user_id_2', u2);

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error('[user/block] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized', code: 'unauthorized' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required', code: 'bad_request' },
        { status: 400 },
      );
    }

    // Remove block
    const { error: blockErr } = await supabaseAdmin
      .from('user_blocks')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', user_id);

    if (blockErr) {
      console.error('[user/block] Failed to unblock user', blockErr);
      return NextResponse.json(
        { error: 'Failed to unblock user', code: 'supabase_error' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error('[user/block] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}

