import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseClient';
import { getCurrentUserFromRequest } from '../../../../../lib/authUser';

export async function GET(req) {
  try {
    const { user, error: authError } = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized', code: 'unauthorized' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const rangeParam = searchParams.get('range');
    const filter = searchParams.get('filter') || null;
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('page_size') || searchParams.get('limit');

    const rangeKm = Number.isFinite(Number(rangeParam)) && Number(rangeParam) > 0
      ? Number(rangeParam)
      : null;

    // Fetch current user's location hash
    const { data: locationRow, error: locErr } = await supabaseAdmin
      .from('user_locations')
      .select('location_hash')
      .eq('user_id', user.id)
      .maybeSingle();

    if (locErr) {
      console.error('[location/find] Error fetching current user location', locErr);
      return NextResponse.json(
        { error: 'Failed to fetch current location', code: 'supabase_error' },
        { status: 500 },
      );
    }

    if (!locationRow?.location_hash) {
      return NextResponse.json(
        { error: 'Current user location not set', code: 'location_not_set' },
        { status: 400 },
      );
    }

    const myLocationHash = locationRow.location_hash;

    // Fetch users with the SAME location hash (same region)
    // We cannot determine distance > 0 because hashing is one-way.
    // So "range" parameter is effectively ignored or treated as "same region" if small enough.
    // In future, client could send neighbor hashes to check larger areas.

    const { data: candidates, error: candidatesErr } = await supabaseAdmin
      .from('user_locations')
      .select('user_id, location_hash, users!inner ( username, real_name, preferences, avatar_url )')
      .neq('user_id', user.id)
      .eq('location_hash', myLocationHash);

    if (candidatesErr) {
      console.error('[location/find] Error fetching nearby users', candidatesErr);
      return NextResponse.json(
        { error: 'Failed to fetch nearby users', code: 'supabase_error' },
        { status: 500 },
      );
    }

    const users = [];

    for (const row of candidates || []) {
      // Filter out users who disabled location sharing
      if (row.users?.preferences?.share_location === false) continue;

      users.push({
        id: row.user_id,
        username: row.users?.username || null,
        real_name: row.users?.real_name || null,
        avatar_url: row.users?.avatar_url || null,
        distance: 'near', // Fuzzy distance as per new privacy spec
        // location_hash: row.location_hash, // REMOVED: Do not expose hash to client for non-friends to ensure fuzzy-only perception
      });
    }

    // Optionally filter by friend status etc. (placeholder for now)
    // if (filter === 'friends_only') { ... }

    // Users in same region, no specific sort order available by distance
    // Could sort by recently active if updated_at was fetched

    // Simple pagination on the in-memory list
    const pageSize = Math.max(1, Math.min(100, Number(pageSizeParam) || 50));
    const page = Math.max(1, Number(pageParam) || 1);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    const paged = users.slice(start, end);

    return NextResponse.json({
      users: paged,
      pagination: {
        page,
        page_size: pageSize,
        total: users.length,
      },
    });
  } catch (err) {
    console.error('[location/find] Unexpected error', err);
    return NextResponse.json(
      { error: 'Unexpected error', code: 'internal_error' },
      { status: 500 },
    );
  }
}


