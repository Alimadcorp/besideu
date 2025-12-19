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

    const { data: upserted, error } = await supabaseAdmin
      .from('contacts')
      .upsert(
        {
          user_id: user.id,
          contacts_data: contacts,
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
    const phones = [];
    for (const c of contacts) {
      if (Array.isArray(c.phone)) {
        for (const p of c.phone) {
          if (typeof p === 'string' && p.trim()) phones.push(p.trim());
        }
      } else if (typeof c.phone === 'string' && c.phone.trim()) {
        phones.push(c.phone.trim());
      }
    }

    let matchedUsers = [];
    if (phones.length) {
      const uniquePhones = Array.from(new Set(phones));
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


