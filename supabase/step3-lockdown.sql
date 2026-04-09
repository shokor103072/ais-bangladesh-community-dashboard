-- Step 3: remove temporary broad policies used during testing

drop policy if exists "concerns_admin_select_all" on public.concerns;
drop policy if exists "concerns_admin_update_all" on public.concerns;

-- Keep public submit and public trackable read policies from schema.sql.
