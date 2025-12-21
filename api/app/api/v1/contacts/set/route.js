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

    if (!Array.isArray(contacts) || !contacts.length) {
      return NextResponse.json({ error: 'contacts array is required', code: 'bad_request' }, { status: 400 });
    }

    const contactCount = Number.isFinite(Number(length)) ? Number(length) : contacts.length;

    // Helper to normalize phone
    const normalizePhone = (p) => {
      if (!p) return '';
      // Remove spaces, dashes, parentheses. Keep + and digits.
      return p.replace(/[\s\-\(\)]/g, '');
    };

    // Normalize contacts and collect phones
    const normalizedContacts = [];
    const phones = new Set();
    const seenContactKeys = new Set(); // To avoid exact duplicate entries if client sends them

    for (const c of contacts) {
      if (!c.name && (!c.phone || c.phone.length === 0)) continue;
      
      const entryCallbackPhones = [];
      const rawPhones = Array.isArray(c.phone) ? c.phone : [c.phone];
      
      for (const p of rawPhones) {
         if (typeof p === 'string') {
            const norm = normalizePhone(p);
            if (norm.length > 3) { // rudimentary validation
              phones.add(norm);
              entryCallbackPhones.push(norm);
            }
         }
      }

      // Deduplicate phones within this contact
      const uniqueEntryPhones = Array.from(new Set(entryCallbackPhones));
      
      if (uniqueEntryPhones.length > 0) {
         // Create a key to check if we already have this contact in this batch (simple name+phones check)
         const key = `${c.name || ''}:${uniqueEntryPhones.sort().join(',')}`;
         if (!seenContactKeys.has(key)) {
            seenContactKeys.add(key);
            normalizedContacts.push({
              name: c.name,
              phone: uniqueEntryPhones
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

    // Collect phone numbers to match users
    // (Already collected in `phones` Set)
    const uniquePhones = Array.from(phones);

    let matchedUsers = [];
    if (uniquePhones.length) {
      const { data: matched, error: matchErr } = await supabaseAdmin
        .from('users')
        .select('id')
        .in('phone', uniquePhones);
      if (matchErr) {
        console.error('[contacts/set] match', matchErr);
      } else {
        matchedUsers = matched?.map((u) => u.id) || [];
      }
    }

    return NextResponse.json({
      success: true,
      length: contactCount,
      matched_users: matchedUsers,
      last_synced_at: upserted.last_synced_at,
    });
  } catch (err) {
    console.error('[contacts/set] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}


