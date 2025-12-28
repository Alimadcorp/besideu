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
    const { contacts, length, timestamp } = body || {};

    if (!Array.isArray(contacts)) {
      return NextResponse.json({ error: 'contacts array is required', code: 'bad_request' }, { status: 400 });
    }

    // Process incoming contacts (already hashed on client side)
    const normalizedContacts = [];
    const phoneHashes = new Set();
    const seenContactKeys = new Set();

    for (const c of contacts) {
      if (!c.name && (!c.phone || c.phone.length === 0)) continue;

      const entryCallbackHashes = [];
      const incomingHashes = Array.isArray(c.phone) ? c.phone : [c.phone];

      for (const h of incomingHashes) {
        if (typeof h === 'string' && h.length === 64) { // SHA-256 hex length
          phoneHashes.add(h);
          entryCallbackHashes.push(h);
        }
      }

      const uniqueEntryHashes = Array.from(new Set(entryCallbackHashes));

      if (uniqueEntryHashes.length > 0) {
        const key = `${c.name || ''}:${uniqueEntryHashes.sort().join(',')}`;
        if (!seenContactKeys.has(key)) {
          seenContactKeys.add(key);
          normalizedContacts.push({
            name: c.name,
            phone: uniqueEntryHashes // Storing hashes for privacy
          });
        }
      }
    }

    const { data: upserted, error } = await supabaseAdmin
      .from('contacts')
      .upsert(
        {
          user_id: user.id,
          contacts_data: normalizedContacts,
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

    // Match users by phone_hash instead of cleartext phone
    const uniqueHashes = Array.from(phoneHashes);
    let matchedUsers = [];

    if (uniqueHashes.length) {
      const { data: matched, error: matchErr } = await supabaseAdmin
        .from('users')
        .select('id')
        .in('phone_hash', uniqueHashes);

      if (matchErr) {
        console.error('[contacts/set] match', matchErr);
      } else {
        matchedUsers = matched?.map((u) => u.id) || [];
      }
    }

    return NextResponse.json({
      success: true,
      length: normalizedContacts.length,
      matched_users: matchedUsers,
      last_synced_at: upserted.last_synced_at,
    });
  } catch (err) {
    console.error('[contacts/set] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}
