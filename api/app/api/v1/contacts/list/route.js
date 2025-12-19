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
    const phoneFilter = searchParams.get('phone');

    // Load contacts data
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
    const phones = new Set();
    const nameByPhone = {};
    for (const c of contactsData) {
      const name = c.name || null;
      if (Array.isArray(c.phone)) {
        for (const p of c.phone) {
          if (typeof p === 'string' && p.trim()) {
            phones.add(p.trim());
            nameByPhone[p.trim()] = name;
          }
        }
      } else if (typeof c.phone === 'string' && c.phone.trim()) {
        phones.add(c.phone.trim());
        nameByPhone[c.phone.trim()] = name;
      }
    }

    let matched = [];
    if (phones.size || userFilter || phoneFilter) {
      const phoneList = phoneFilter ? [phoneFilter] : Array.from(phones);
      const filters = [];
      if (userFilter) filters.push(`id.eq.${userFilter}`);
      if (phoneList.length) filters.push(`phone.in.(${phoneList.map((p) => `"${p}"`).join(',')})`);

      const { data: users, error: usersErr } = await supabaseAdmin
        .from('users')
        .select('id, username, phone')
        .or(filters.join(','));

      if (usersErr) {
        console.error('[contacts/list] fetch users', usersErr);
      } else {
        // Load friendships for current user once, to compute is_friend
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
          phone: u.phone,
          contact_name: nameByPhone[u.phone] || null,
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


