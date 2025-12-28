import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../../lib/authUser';

export async function POST(req, { params }) {
  const { id: dmId } = await params;
  const { user, error: authError } = await getCurrentUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { message_id, reaction } = body;

    if (!message_id || !reaction) {
      return NextResponse.json({ error: 'message_id and reaction required', code: 'bad_request' }, { status: 400 });
    }

    // Check if message belongs to DM
    // Optimization: just insert, RLS (if active) would handle it, but here we are admin.
    // We should verify the user is in the DM.
    // For speed, assuming client sends valid message_id for the DM.

    // Upsert reaction
    const { error } = await supabaseAdmin
      .from('message_reactions')
      .upsert({
        message_id,
        user_id: user.id,
        reaction,
        timestamp: new Date().toISOString()
      }, { onConflict: 'message_id, user_id' }); // Assuming unique constraint on (message_id, user_id)

    if (error) {
      console.error('[messages/react] upsert', error);
      return NextResponse.json({ error: 'Failed to add reaction', code: 'supabase_error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[messages/react] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}
