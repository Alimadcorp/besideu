# Scheduled Messages & Status Setup

## Environment Variables

Add the following to your `.env` file or Vercel environment variables:

```bash
CRON_SECRET=your-random-secret-here
```

Generate a secure random secret:
```bash
openssl rand -base64 32
```

## Cron Jobs

The following cron jobs run every minute on Vercel:

1. **Scheduled Messages** (`/api/v1/cron/scheduled-messages`)
   - Processes messages with `scheduled_at` timestamps that have passed
   - Updates friend records with last message and unread counts
   - Sends push notifications to recipients

2. **Scheduled Status** (`/api/v1/cron/scheduled-status`)
   - Processes users with `scheduled_status_at` timestamps that have passed
   - Updates user status and expiration
   - Clears scheduled status fields

## Manual Testing

You can manually trigger the cron jobs for testing:

```bash
curl -X POST https://your-api.vercel.app/api/v1/cron/scheduled-messages \
  -H "Authorization: Bearer your-cron-secret"

curl -X POST https://your-api.vercel.app/api/v1/cron/scheduled-status \
  -H "Authorization: Bearer your-cron-secret"
```

## Features

### Scheduled Messages
- Users can schedule messages up to 7 days in advance
- Presets: 1 hour, 4 hours, Tomorrow, 2 Days
- Custom date/time picker with +1 Hour, +1 Day buttons
- Messages appear in chat only when scheduled time arrives
- Notifications sent at scheduled time, not when message is created

### Delayed Status
- Three-step workflow:
  1. Select when status should go live (presets or custom time)
  2. Enter the status message
  3. Set when it should expire after going live
- Presets for expiration: 1 hour, 4 hours, 24 hours, or never
- Lazy publishing: status updates automatically when profile is viewed after scheduled time
- Cron job ensures timely updates even if profile isn't viewed

## Database Schema

### Messages Table
- `scheduled_at` (timestamp, nullable): When the message should be sent

### Users Table
- `scheduled_status` (text, nullable): The status to publish
- `scheduled_status_at` (timestamp, nullable): When to publish it
- `scheduled_status_expiration` (timestamp, nullable): When it should expire after publishing
