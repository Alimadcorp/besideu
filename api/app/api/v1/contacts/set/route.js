import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';

export async function PUT(req) {
  const { user, error: authError } = await getCurrentUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { hashes, timestamp } = body || {};

    if (!Array.isArray(hashes)) {
      return NextResponse.json({ error: 'hashes array is required', code: 'bad_request' }, { status: 400 });
    }

    // Process incoming hashes: ensure uniqueness and validity
    const uniqueHashes = Array.from(new Set(
      hashes.filter(h => typeof h === 'string' && h.length === 64)
    ));

    const { data: upserted, error } = await supabaseAdmin
      .from('contacts')
      .upsert(
        {
          user_id: user.id,
          contacts_data: uniqueHashes, // Simple array of strings (hashes)
          last_synced_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();

    if (error) {
      console.error('[contacts/set] upsert', error);
      return NextResponse.json({ error: 'Failed to store contacts', code: 'supabase_error' }, { status: 500 });
    }

    // No longer returning matched users here, relying on specific list/check call if needed, 
    // or we could return it, but user flow says "respond with hashes again" later.
    // Actually user says "recieve... just save... Then when used does contact list... it will respond".
    // So this set route just needs to save.

    return NextResponse.json({
      success: true,
      length: uniqueHashes.length,
      last_synced_at: upserted.last_synced_at,
    });
  } catch (err) {
    console.error('[contacts/set] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}
