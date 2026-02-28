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
