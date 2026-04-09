# AIS Bangladesh Chapter, UTP Dashboard — Vercel + Supabase Step 2

This package is prepared for **Vercel deployment** and now includes a **Supabase-ready cloud layer for the concern desk**.

## What this step adds
- Keeps the dashboard deployable on **Vercel**.
- Adds **Supabase client integration** for shared concern submissions.
- Adds **live cloud sync badge** so you can see whether the app is using browser mode or Supabase mode.
- Adds **realtime refresh** for concerns when Supabase is connected.
- Adds `supabase/schema.sql` for database setup.
- Adds `public/js/supabase-config.js` and `public/js/supabase-config.example.js`.
- Keeps automatic fallback to **localStorage** if Supabase is not configured yet.

## What is already cloud-enabled
### Shared across devices when Supabase is configured
- concern submission
- concern lookup by ticket / email
- realtime refresh of the concern list

### Still local browser mode for now
- admin login session
- admin account management
- admin audit logs
- members / events / gallery / announcements / achievements

That split is intentional. Moving admin credentials into client-side Supabase access too early would weaken security. The safer next step is to move admin authentication and private concern management into **secure Vercel API routes**.

## Files added in this step
- `public/js/cloud.js`
- `public/js/supabase-config.js`
- `public/js/supabase-config.example.js`
- `supabase/schema.sql`

## Setup Supabase
1. Create a new Supabase project.
2. Open the SQL Editor in Supabase.
3. Run the SQL from `supabase/schema.sql`.
4. Open `public/js/supabase-config.js`.
5. Set:
   - `enabled: true`
   - your project URL
   - your anon key
6. Redeploy to Vercel.

## Security note about private concerns
The supplied SQL is conservative by default:
- anyone can **submit** a concern
- public users can only **read trackable** concerns
- full admin inbox sync is **not opened by default**

Inside `supabase/schema.sql` you will see commented policies for broader admin-style read/update access. Those are kept commented because they are not ideal for production security when using only a browser anon key.

## Current deployment flow
1. Push this project to GitHub.
2. Import the repo into Vercel.
3. Framework preset: **Other**.
4. No build command is required.
5. Deploy.

## Health check
After deploy, open:
- `/api/health`

## Temporary admin access
Temporary master account:
- Username: `masteradmin`
- Password: `UTP-Admin-2026!`

Change the password immediately after first login.

## Best next upgrade after this package
### Step 3
Move **admin authentication and private concern management** into secure Vercel API routes.

That next step should include:
- server-side admin login
- secure password verification on the server
- protected admin concern inbox
- protected admin logs
- role-based permissions for master admin and committee admins

### Step 4
Move the rest of the editable dashboard data to Supabase:
- members
- committee
- alumni
- events
- announcements
- achievements
- gallery


## Step 3: Secure admin concern inbox via Vercel API

This package adds a protected admin inbox path:
- public users still submit concerns directly with the Supabase publishable key
- admin full inbox read/update now goes through `/api/admin-concerns`
- Vercel stores the sensitive keys in environment variables

### Vercel environment variables
Add these in Vercel Project Settings → Environment Variables:
- `SUPABASE_URL` = your project URL
- `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service role key
- `ADMIN_INBOX_TOKEN` = any long secret string you choose

### One-time SQL cleanup
If you previously enabled broad admin select/update RLS policies for testing, run `supabase/step3-lockdown.sql` in Supabase.

### Admin browser setup
After logging in as admin on the site:
1. open **Manage**
2. paste the same `ADMIN_INBOX_TOKEN`
3. click **Connect secure inbox**

The token is stored only in that browser. It is not embedded in the public site code.
