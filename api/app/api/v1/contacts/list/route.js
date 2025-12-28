import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';

export async function GET(req) {
  const { user, error: authError } = await getCurrentUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const userFilter = searchParams.get('user');

    // Load contacts data (which now contains hashes)
    const { data: contactsRow, error: contactsErr } = await supabaseAdmin
      .from('contacts')
      .select('contacts_data')
      .eq('user_id', user.id)
      .maybeSingle();

    if (contactsErr) {
      console.error('[contacts/list] fetch contacts', contactsErr);
      return NextResponse.json({ error: 'Failed to load contacts', code: 'supabase_error' }, { status: 500 });
    }

    const contactsData = contactsRow?.contacts_data || [];
    const hashes = new Set();
    const nameByHash = {};

    for (const c of contactsData) {
      const name = c.name || null;
      const rawPhones = Array.isArray(c.phone) ? c.phone : [c.phone];
      for (const h of rawPhones) {
        if (typeof h === 'string' && h.length === 64) {
          hashes.add(h);
          nameByHash[h] = name;
        }
      }
    }

    let matched = [];
    if (hashes.size || userFilter) {
      const hashList = Array.from(hashes);
      const filters = [];
      if (userFilter) filters.push(`id.eq.${userFilter}`);
      if (hashList.length) filters.push(`phone_hash.in.(${hashList.map((h) => `"${h}"`).join(',')})`);

      const { data: users, error: usersErr } = await supabaseAdmin
        .from('users')
        .select('id, username, phone_hash')
        .or(filters.join(','));

      if (usersErr) {
        console.error('[contacts/list] fetch users', usersErr);
      } else {
        // Load friendships to compute is_friend
        const { data: friendships, error: friendsErr } = await supabaseAdmin
          .from('friends')
          .select('user_id_1, user_id_2')
          .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

        if (friendsErr) {
          console.error('[contacts/list] fetch friends', friendsErr);
        }

        const friendIds = new Set();
        for (const f of friendships || []) {
          const otherId = f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1;
          friendIds.add(otherId);
        }

        matched = (users || []).map((u) => ({
          user_id: u.id,
          username: u.username,
          // We no longer return the phone number for privacy, the client uses username anyway
          contact_name: nameByHash[u.phone_hash] || null,
          is_friend: friendIds.has(u.id),
        }));
      }
    }

    return NextResponse.json({ matched });
  } catch (err) {
    console.error('[contacts/list] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}
