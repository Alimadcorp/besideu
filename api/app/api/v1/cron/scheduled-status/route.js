import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// This endpoint processes scheduled status updates that are due
// Should be called by a cron job every minute
export async function POST(req) {
    try {
        // Verify cron secret to prevent unauthorized access
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const now = new Date().toISOString();

        // Find all users with scheduled status updates that are due
        const { data: users, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('id, scheduled_status, scheduled_status_at, scheduled_status_expiration')
            .not('scheduled_status', 'is', null)
            .not('scheduled_status_at', 'is', null)
            .lte('scheduled_status_at', now)
            .limit(100);

        if (fetchError) {
            console.error('[cron/scheduled-status] fetch error', fetchError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        if (!users || users.length === 0) {
            return NextResponse.json({ processed: 0, message: 'No scheduled status updates due' });
        }

        let processed = 0;

        for (const user of users) {
            try {
                // Update user's status
                await supabaseAdmin
                    .from('users')
                    .update({
                        status: user.scheduled_status,
                        status_expiration: user.scheduled_status_expiration,
                        scheduled_status: null,
                        scheduled_status_at: null,
                        scheduled_status_expiration: null
                    })
                    .eq('id', user.id);

                processed++;
            } catch (err) {
                console.error('[cron/scheduled-status] process error', err);
            }
        }

        return NextResponse.json({
            processed,
            total: users.length,
            message: `Processed ${processed} scheduled status updates`
        });
    } catch (err) {
        console.error('[cron/scheduled-status] unexpected error', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
