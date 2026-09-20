-- Manual reset for the empty legacy simulation schema in project uyrnqwilluirwehiggtk.
-- 2026-09-20: reset work was stopped for redesign; do not run as part of the new design.
-- See supabase-database-design.md and confirm the current target state first.
-- Run BEFORE the three current supabase/migrations files, never afterwards.
-- Only the eight listed tables are removed. Auth users and other tables remain.
-- On any error, run ROLLBACK; inspect the cause instead of adding CASCADE.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Prevent new writes between the emptiness check and the drop.
lock table
  public.organizations,
  public.organization_members,
  public.simulation_runs,
  public.simulation_run_attempts,
  public.simulation_model_versions,
  public.simulation_input_snapshots,
  public.simulation_results,
  public.simulation_result_metrics
in access exclusive mode;

do $$
begin
  if exists (
    select 1 from public.organizations
    union all select 1 from public.organization_members
    union all select 1 from public.simulation_runs
    union all select 1 from public.simulation_run_attempts
    union all select 1 from public.simulation_model_versions
    union all select 1 from public.simulation_input_snapshots
    union all select 1 from public.simulation_results
    union all select 1 from public.simulation_result_metrics
  ) then
    raise exception 'RESET_ABORTED: legacy tables contain data; nothing was deleted.';
  end if;
end;
$$;

-- One statement allows dependencies among these eight tables only.
-- RESTRICT refuses external dependencies rather than deleting them implicitly.
drop table
  public.simulation_result_metrics,
  public.simulation_results,
  public.simulation_input_snapshots,
  public.simulation_run_attempts,
  public.simulation_runs,
  public.simulation_model_versions,
  public.organization_members,
  public.organizations
restrict;

commit;
