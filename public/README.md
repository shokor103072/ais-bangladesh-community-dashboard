# Frontend assets

This folder contains the static frontend served by Vercel.

## Current storage model
The current dashboard stores editable data in the browser using localStorage.
This is acceptable for a prototype/demo deployment, but not for a shared production admin system.

## Next professional upgrade
Connect the frontend to Supabase or Firebase so that:
- admin accounts are centrally managed
- concerns are shared across all committee members
- audit logs are stored on the backend
- members/events/gallery updates sync across devices
