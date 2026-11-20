\set ON_ERROR_STOP on

grant usage on schema public, auth, storage to anon, authenticated, plan_admin;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
grant all privileges on all tables in schema public, auth, storage to plan_admin;
grant all privileges on all sequences in schema public, auth, storage to plan_admin;
grant execute on all functions in schema public, auth, storage to plan_admin;

alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
