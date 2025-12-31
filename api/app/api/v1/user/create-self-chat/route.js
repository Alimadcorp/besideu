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

    // Check if self-chat already exists
    const { data: existing } = await supabaseAdmin
      .from('friends')
      .select('id')
      .eq('user_id_1', user.id)
      .eq('user_id_2', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        dm_id: existing.id,
        already_exists: true,
      });
    }

    // Create self-chat
    const { data: selfChat, error: createErr } = await supabaseAdmin
      .from('friends')
      .insert({
        user_id_1: user.id,
        user_id_2: user.id,
      })
      .select()
      .single();

    if (createErr) {
      console.error('[user/create-self-chat] Failed to create self-chat', createErr);
      return NextResponse.json(
        { error: 'Failed to create self-chat', code: 'supabase_error' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      dm_id: selfChat.id,
      already_exists: false,
    });
  } catch (err) {
    console.error('[user/create-self-chat] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}

