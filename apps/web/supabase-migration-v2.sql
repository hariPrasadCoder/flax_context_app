-- Flax v2 Migration — run in Supabase SQL Editor
-- Safe to run on existing databases (uses IF NOT EXISTS)

create table if not exists meetings (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  title       text not null,
  transcript  text not null,
  created_at  timestamptz not null default now()
);

create index if not exists meetings_project_id_idx on meetings(project_id);

create table if not exists proposed_changes (
  id              uuid primary key default gen_random_uuid(),
  doc_id          uuid not null references documents(id) on delete cascade,
  meeting_id      uuid not null references meetings(id) on delete cascade,
  block_id        text not null,
  before_content  text,
  after_content   text not null,
  reason          text,
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at      timestamptz not null default now()
);

create index if not exists proposed_changes_doc_id_idx on proposed_changes(doc_id);
create index if not exists proposed_changes_meeting_id_idx on proposed_changes(meeting_id);
create index if not exists proposed_changes_status_idx on proposed_changes(status);

alter table meetings disable row level security;
alter table proposed_changes disable row level security;

-- v3: Document draft/published status
-- Existing docs default to 'published' so nothing breaks
alter table documents
  add column if not exists status text not null default 'published'
  check (status in ('draft', 'published'));

-- v4: User settings (single-row singleton, no auth yet)
create table if not exists user_settings (
  id                text primary key default 'default',
  author_name       text not null default 'You',
  author_color      text not null default '#2563EB',
  theme             text not null default 'light' check (theme in ('light', 'dark')),
  default_doc_status text not null default 'draft' check (default_doc_status in ('draft', 'published')),
  auto_save_delay   integer not null default 800,
  ai_model          text not null default 'claude-sonnet-4-6',
  updated_at        timestamptz not null default now()
);

-- Seed the default row so GET always returns a row
insert into user_settings (id) values ('default') on conflict do nothing;

alter table user_settings disable row level security;
