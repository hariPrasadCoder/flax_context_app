-- Flax Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/iphwtmfrmjohyauqcbwx/sql/new

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── Projects ──────────────────────────────────────────────
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  emoji       text not null default '📄',
  color       text not null default '#2563EB',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Documents ─────────────────────────────────────────────
create table if not exists documents (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  parent_id  uuid references documents(id) on delete cascade,
  title      text not null default 'Untitled',
  content    jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_project_id_idx on documents(project_id);

-- ── Block History ──────────────────────────────────────────
create table if not exists block_history (
  id              uuid primary key default gen_random_uuid(),
  block_id        text not null,
  doc_id          uuid not null references documents(id) on delete cascade,
  before_content  text,
  after_content   text not null,
  source          text not null default 'manual' check (source in ('manual', 'meeting', 'ai')),
  author_name     text,
  author_color    text,
  meeting_id      uuid,
  meeting_title   text,
  reason          text,
  created_at      timestamptz not null default now()
);

create index if not exists block_history_doc_id_idx on block_history(doc_id);
create index if not exists block_history_block_id_idx on block_history(block_id);

-- ── Auto-update updated_at ─────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

create trigger documents_updated_at
  before update on documents
  for each row execute function update_updated_at();

-- ── Disable RLS (no auth yet) ─────────────────────────────
alter table projects disable row level security;
alter table documents disable row level security;
alter table block_history disable row level security;

-- ── Seed data ─────────────────────────────────────────────
insert into projects (id, name, description, emoji, color) values
  ('a0000000-0000-0000-0000-000000000001', 'Flax Platform', 'Core product — editor, Mac app, and backend infrastructure', '⚡', '#2563EB'),
  ('a0000000-0000-0000-0000-000000000002', 'Q1 Growth Initiative', 'Marketing campaign strategy and execution plan', '🚀', '#7C3AED'),
  ('a0000000-0000-0000-0000-000000000003', 'User Research', 'Interview notes, findings, and synthesis', '🔍', '#059669')
on conflict (id) do nothing;

insert into documents (id, project_id, title, content) values
  (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Technical Design Doc',
    null
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'Product Requirements',
    null
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000002',
    'Campaign Strategy',
    null
  ),
  (
    'b0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000003',
    'Interview Findings',
    null
  )
on conflict (id) do nothing;
