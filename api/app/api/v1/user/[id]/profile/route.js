import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getCurrentUserFromRequest } from '@/lib/authUser';

export async function GET(req, { params }) {
    const { id: targetId } = await params;
    const { user: requester, error: authError } = await getCurrentUserFromRequest(req);

    if (!requester) {
        return NextResponse.json({ error: authError || 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    try {
        // Allow users to view their own profile
        const isOwnProfile = requester.id === targetId;

        // Fetch target user fields
        const { data: targetUser, error: dbError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', targetId)
            .single();

        if (dbError || !targetUser) {
            return NextResponse.json({ error: 'User not found', code: 'not_found' }, { status: 404 });
        }

        // Lazy Publish Scheduled Status
        const now = new Date();
        if (targetUser.scheduled_status && targetUser.scheduled_status_at && new Date(targetUser.scheduled_status_at) <= now) {
            const { data: updated, error: updateErr } = await supabaseAdmin
                .from('users')
                .update({
                    status: targetUser.scheduled_status,
                    status_expiration: targetUser.scheduled_status_expiration,
                    scheduled_status: null,
                    scheduled_status_at: null,
                    scheduled_status_expiration: null
                })
                .eq('id', targetUser.id)
                .select('*')
                .single();

            if (!updateErr && updated) {
                Object.assign(targetUser, updated);
            }
        }

        // Privacy Logic:
        // If viewing own profile, show all fields
        let isFriend = false;
        let isContact = false;

        if (!isOwnProfile) {
            // 1. Check if they are friends (order the pair to match database constraint)
            const [u1, u2] = requester.id < targetId ? [requester.id, targetId] : [targetId, requester.id];
            const { data: friendship } = await supabaseAdmin
                .from('friends')
                .select('*')
                .eq('user_id_1', u1)
                .eq('user_id_2', u2)
                .maybeSingle();

            isFriend = !!friendship;

            // 2. Check if the target is in the requester's contacts
            if (!isFriend) {
                const { data: contactRecord } = await supabaseAdmin
                    .from('contacts')
                    .select('contacts_data')
                    .eq('user_id', requester.id)
                    .single();

                if (contactRecord && Array.isArray(contactRecord.contacts_data)) {
                    isContact = contactRecord.contacts_data.includes(targetUser.phone_hash);
                }
            }
        }

        // Prepare public profile object
        const profile = {
            id: targetUser.id,
            username: targetUser.username,
            real_name: targetUser.real_name,
            avatar_url: targetUser.avatar_url,
            bio: targetUser.bio,
            website: targetUser.website,
            business_type: targetUser.business_type,
            public_phone: targetUser.public_phone,
            status: (targetUser.status_expiration && new Date(targetUser.status_expiration) < new Date()) ? null : targetUser.status,
            status_expiration: targetUser.status_expiration,
            is_business: targetUser.is_business,
            is_online: targetUser.is_online,
            last_online: targetUser.last_online,
            is_friend: isFriend,
            is_own_profile: isOwnProfile,
        };

        // Conditional fields - show phone if own profile, friend, or contact
        if (isOwnProfile || isFriend || isContact) {
            profile.phone = targetUser.phone;
        }

        return NextResponse.json({ profile });
    } catch (err) {
        console.error('[user/profile] unexpected', err);
        return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
    }
}
