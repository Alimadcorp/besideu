import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../../lib/authUser';

export async function POST(req, { params }) {
  const { user, error: authError } = await getCurrentUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  const messageId = params?.id;
  if (!messageId) {
    return NextResponse.json({ error: 'message id required', code: 'bad_request' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { reaction } = body || {};
    
    if (!reaction || typeof reaction !== 'string' || reaction.length > 10) {
      return NextResponse.json({ error: 'reaction string required (max 10 chars)', code: 'invalid_reaction' }, { status: 400 });
    }

    // Validate permission: User must be part of the DM the message belongs to.
    const { data: message, error: msgErr } = await supabaseAdmin
      .from('messages')
      .select('dm_id')
      .eq('id', messageId)
      .single();
    
    if (msgErr || !message) {
      return NextResponse.json({ error: 'Message not found', code: 'not_found' }, { status: 404 });
    }

    // Validate DM membership
    const { data: friendRow, error: friendErr } = await supabaseAdmin
      .from('friends')
      .select('user_id_1, user_id_2')
      .eq('id', message.dm_id)
      .single();

    if (friendErr || !friendRow) {
      // Should not happen if foreign keys enforce integrity, but safe to check
      return NextResponse.json({ error: 'Conversation not found', code: 'not_found' }, { status: 404 });
    }

    if (friendRow.user_id_1 !== user.id && friendRow.user_id_2 !== user.id) {
       return NextResponse.json({ error: 'Unauthorized', code: 'forbidden' }, { status: 403 });
    }

    // Insert Reaction
    // If user already reacted with same emoji, maybe toggle? Or just strict add?
    // Schema PK is ID, so multiple reactions allow multiple rows.
    // Usually one reaction per user per message per type, or just one total?
    // README says `message_reactions` has `id, message_id, user_id, reaction, timestamp`.
    // It doesn't specify unique constraint on (message_id, user_id).
    // I'll assume allowing multiple is fine, or I should delete old one?
    // Slack/Discord allow multiple.
    // But usually typically toggles.
    // Let's implement: Add.
    
    const reactionId = crypto.randomUUID();
    
    const { error: insertErr } = await supabaseAdmin
      .from('message_reactions')
      .insert({
        id: reactionId,
        message_id: messageId,
        user_id: user.id,
        reaction: reaction,
        timestamp: new Date().toISOString()
      });

    if (insertErr) {
       console.error('[messages/react] insert', insertErr);
       return NextResponse.json({ error: 'Failed to add reaction', code: 'supabase_error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, reaction_id: reactionId });
  } catch (err) {
    console.error('[messages/react] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}
