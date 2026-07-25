-- Milestone 11 — schema base: organizações, membros e perfis.

-- Necessária para gen_random_bytes() (token de convite). gen_random_uuid() já é
-- nativo do Postgres 13+, não depende da extensão.
create extension if not exists pgcrypto;

create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  email       text not null,
  created_at  timestamptz not null default now()
);

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  plan        text not null default 'entrada'
              check (plan in ('entrada', 'profissional', 'escala')),
  created_at  timestamptz not null default now()
);

create table organization_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('admin', 'vendedor')),
  created_at  timestamptz not null default now(),
  unique (org_id, user_id)
);
create index on organization_members (user_id);
create index on organization_members (org_id);

-- Convite pendente. Vira membership só na aceitação via accept_invite(), nunca por insert direto.
create table organization_invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  email       text not null,
  role        text not null check (role in ('admin', 'vendedor')),
  token       text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by  uuid not null references auth.users (id),
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on organization_invites (org_id);
