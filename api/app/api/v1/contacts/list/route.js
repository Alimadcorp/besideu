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

    // Load contacts data (now raw hashes)
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
    // contactsData should be string[] or empty. Sanitize just in case structure migrated.
    const myHashes = new Set();

    if (Array.isArray(contactsData)) {
      for (const item of contactsData) {
        if (typeof item === 'string') {
          myHashes.add(item);
        } else if (typeof item === 'object' && Array.isArray(item.phone)) {
          // Backward compatibility for old structure { name, phone: [] }
          item.phone.forEach(p => myHashes.add(p));
        }
      }
    }

    let matched = [];
    if (myHashes.size > 0 || userFilter) {
      const hashList = Array.from(myHashes);
      // Deduplicate results
      const userMap = new Map();

      // 1a. Handle specific user filter
      if (userFilter) {
        const { data } = await supabaseAdmin
          .from('users')
          .select('id, username, phone_hash, avatar_url')
          .eq('id', userFilter);
        if (data) data.forEach(u => userMap.set(u.id, u));
      }

      // 1b. Handle Hash List using RPC (Efficient, Single Query, No URL limit)
      if (hashList.length > 0) {
        const { data, error } = await supabaseAdmin.rpc('match_contact_hashes', {
          hashes: hashList
        });

        if (error) {
          console.error('[contacts/list] rpc match error', error);
          // Fallback to chunked parsing if RPC missing? No, we assume migration ran.
        } else if (data) {
          data.forEach(u => userMap.set(u.id, u));
        }
      }

      const users = Array.from(userMap.values()).filter(u => u.id !== user.id);

      // 2. Fetch Friend Status and Requests
      const { data: friendships, error: friendsErr } = await supabaseAdmin
        .from('friends')
        .select('user_id_1, user_id_2')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

      const { data: requests, error: requestsErr } = await supabaseAdmin
        .from('friend_requests')
        .select('id, from_user_id, to_user_id, status')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .eq('status', 'pending');

      if (friendsErr || requestsErr) {
        console.error('[contacts/list] fetch status/requests', friendsErr || requestsErr);
      }

      const friendIds = new Set();
      for (const f of friendships || []) {
        const otherId = f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1;
        friendIds.add(otherId);
      }

      const requestsMap = new Map();
      for (const r of requests || []) {
        const otherId = r.from_user_id === user.id ? r.to_user_id : r.from_user_id;
        requestsMap.set(otherId, {
          id: r.id,
          direction: r.from_user_id === user.id ? 'outgoing' : 'incoming'
        });
      }

      // 3. Construct Response
      matched = (users || []).map((u) => {
        const request = requestsMap.get(u.id);
        return {
          user_id: u.id,
          username: u.username,
          avatar_url: u.avatar_url,
          hash: u.phone_hash,
          is_friend: friendIds.has(u.id),
          request_id: request?.id || null,
          request_direction: request?.direction || null
        };
      });
    }


    return NextResponse.json({ matched });
  } catch (err) {
    console.error('[contacts/list] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}
