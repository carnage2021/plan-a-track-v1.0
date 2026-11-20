-- Run against the application's local database with the database owner's connection.
create table if not exists auth.smtp_settings (
  singleton boolean primary key default true check (singleton),
  revision integer not null default 0,
  enabled boolean not null default false,
  host text not null default '',
  port integer not null default 587 check (port between 1 and 65535),
  security text not null default 'starttls' check (security in ('starttls','tls','loopback')),
  username text not null default '',
  password_cipher bytea,
  sender text not null default ''
);
revoke all on auth.smtp_settings from public, anon, authenticated;
grant select, update on auth.smtp_settings to plan_admin;
insert into auth.smtp_settings (singleton) values (true) on conflict do nothing;
