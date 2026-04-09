# AIS Bangladesh Chapter, UTP Dashboard — Step 6 Email Notifications

This package adds **email notifications** to the concern desk while keeping the current Vercel + Supabase structure.

## What Step 6 adds
- Sends a **confirmation email** to the member when a concern is submitted.
- Optionally sends a **committee alert email** for each new concern.
- Sends a **member update email** when the committee posts a reply or changes status.
- Keeps internal notes private and does **not** email them.
- Public tracking and secure admin inbox continue to work as before.

## New files in this step
- `api/_email.js`
- `api/concern-submit.js`

## Updated files in this step
- `api/admin-concerns.js`
- `public/js/app.js`
- `public/js/cloud.js`

## Vercel environment variables for Step 6
Add these in **Vercel → Project Settings → Environment Variables**:

### Required for email sending
- `RESEND_API_KEY`
- `EMAIL_FROM`

### Optional but recommended
- `COMMITTEE_NOTIFY_TO`

### Existing variables you should already have
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_INBOX_TOKEN`

## Example values
- `EMAIL_FROM` = `AIS Bangladesh Desk <onboarding@resend.dev>` for testing
- `COMMITTEE_NOTIFY_TO` = `your-email@example.com`

## Important note about Resend testing
If you use Resend testing mode or an unverified domain, sending may be limited. For real recipient delivery, verify a sending domain in Resend and use that domain in `EMAIL_FROM`.

## How Step 6 works
### Public submission
The site now tries to submit through `/api/concern-submit` first.
That route:
1. saves the concern in Supabase using the server key
2. sends the confirmation email to the member
3. sends the optional committee notification email

If that route is unavailable, the site falls back to the existing direct Supabase submission.

### Admin reply and status update
When admins update a concern through the secure admin inbox:
- a new committee reply triggers a member email
- a status change triggers a member email

## Deployment steps
1. Replace your GitHub repo files with this package.
2. Add the new Vercel environment variables.
3. Redeploy on Vercel.
4. Hard refresh the website.
5. Test with a new concern submission.

## Suggested first test
1. Submit a concern using your own email.
2. Confirm the row is saved in Supabase.
3. Check for the confirmation email.
4. Reply from admin.
5. Check for the update email.
