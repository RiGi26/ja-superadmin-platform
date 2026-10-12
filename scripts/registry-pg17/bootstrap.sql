-- Synthetic engine fixtures only. Not a Supabase schema or identity simulation.
-- This file is executed only inside the job-owned ephemeral PG17 container.
do $$
begin
  if current_setting('server_version_num')::int / 10000 <> 17 then
    raise exception 'This harness requires PostgreSQL 17';
  end if;
end;
$$;

create schema auth;
create table auth.users (id uuid primary key);
create table public.tenants (id uuid primary key);
revoke create on schema public from public;
grant usage on schema public to anon, authenticated, service_role, harness_session;

-- Compare a strict profile with deliberately permissive object defaults.
-- Neither profile claims to reproduce the current hosted Core catalog.
\if :permissive_defaults
alter default privileges for role postgres in schema public
  grant all privileges on tables to public, anon, authenticated, service_role;
\endif

insert into auth.users(id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002');
insert into public.tenants(id) values
  ('20000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002');
