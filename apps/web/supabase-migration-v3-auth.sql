-- ═══════════════════════════════════════════════════════════════════════════
-- Flax v3 Migration — Auth, Orgs & Access Control
-- ═══════════════════════════════════════════════════════════════════════════
-- Run AFTER supabase-schema.sql + supabase-migration-v2.sql
-- Safe to run on an existing DB (all DDL uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
--
-- What this adds:
--   • organizations       — one per company/team (the "workspace")
--   • organization_members— user ↔ org, with role: owner | admin | member
--   • invitations         — token-based invite links (email optional)
--   • project_members     — explicit access for restricted projects
--   • document_members    — explicit access for restricted documents
--   • visibility columns  — on projects and documents
--   • public_share_token  — on documents (read-only link, no login needed)
--   • created_by / author_id — on all content tables
--   • Row Level Security  — enabled + policies on every table
--
-- ⚠️  Existing test seed data (a0000... / b0000... UUIDs) will remain in the
--     DB but will be invisible through RLS because they have no org_id.
--     Clear them manually if desired:
--       truncate proposed_changes, block_history, meetings, documents, projects cascade;
-- ═══════════════════════════════════════════════════════════════════════════

-- Extensions
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1 — NEW TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- 1.1  Organizations (workspaces — one per company)
-- ─────────────────────────────────────────────────
create table if not exists organizations (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        unique not null,   -- URL-safe identifier: "acme-inc"
  logo_url    text,
  created_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace trigger organizations_updated_at
  before update on organizations
  for each row execute function update_updated_at();

-- 1.2  Organization members
-- ─────────────────────────
create table if not exists organization_members (
  org_id        uuid        not null references organizations(id) on delete cascade,
  user_id       uuid        not null references auth.users(id)    on delete cascade,
  role          text        not null default 'member'
                            check (role in ('owner', 'admin', 'member')),
  display_name  text,         -- editable display name (may differ from auth.users)
  avatar_url    text,
  joined_at     timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- 1.3  Invitations
-- ─────────────────
-- email IS NULL  → open invite link (anyone with the token can join)
-- email NOT NULL → targeted invite (only that email address can use it)
create table if not exists invitations (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references organizations(id) on delete cascade,
  email        text,
  token        text        unique not null default encode(gen_random_bytes(32), 'hex'),
  role         text        not null default 'member'
                           check (role in ('admin', 'member')),
  invited_by   uuid        references auth.users(id) on delete set null,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists invitations_token_idx  on invitations(token);
create index if not exists invitations_org_id_idx on invitations(org_id);
create index if not exists invitations_email_idx  on invitations(email);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2 — ALTER EXISTING TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- 2.1  Projects — add org scope + visibility
-- ──────────────────────────────────────────
alter table projects
  add column if not exists org_id      uuid references organizations(id) on delete cascade,
  add column if not exists created_by  uuid references auth.users(id)    on delete set null,
  add column if not exists visibility  text not null default 'workspace'
                                       check (visibility in ('workspace', 'restricted', 'private'));

create index if not exists projects_org_id_idx on projects(org_id);

-- 2.2  Project members (explicit access for restricted projects)
-- ──────────────────────────────────────────────────────────────
create table if not exists project_members (
  project_id  uuid        not null references projects(id)  on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  role        text        not null default 'editor'
                          check (role in ('owner', 'editor', 'viewer')),
  added_at    timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- 2.3  Documents — add visibility + public share token
-- ──────────────────────────────────────────────────────
alter table documents
  add column if not exists created_by         uuid references auth.users(id) on delete set null,
  add column if not exists visibility         text not null default 'workspace'
                                              check (visibility in ('workspace', 'restricted', 'private')),
  add column if not exists public_share_token text unique;  -- null = no public link

-- 2.4  Document members (explicit access for restricted documents)
-- ─────────────────────────────────────────────────────────────────
create table if not exists document_members (
  doc_id    uuid        not null references documents(id)   on delete cascade,
  user_id   uuid        not null references auth.users(id)  on delete cascade,
  role      text        not null default 'editor'
                        check (role in ('editor', 'viewer')),
  added_at  timestamptz not null default now(),
  primary key (doc_id, user_id)
);

-- 2.5  Block history — add author
-- ─────────────────────────────────
alter table block_history
  add column if not exists author_id uuid references auth.users(id) on delete set null;

-- 2.6  Proposed changes — add reviewer
-- ─────────────────────────────────────
alter table proposed_changes
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3 — HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────
-- All functions are SECURITY DEFINER so they run as the DB owner and bypass
-- RLS on the tables they query internally. This prevents circular dependency
-- errors when RLS policies on table A need to query table A or related tables.
-- ─────────────────────────────────────────────────────────────────────────────

-- Returns every org the current user belongs to.
create or replace function user_org_ids()
returns setof uuid
language sql security definer stable
as $$
  select org_id
  from   organization_members
  where  user_id = auth.uid()
$$;

-- Can the current user see/access the given project?
-- Used in document policies to avoid repeating the project-gate logic.
create or replace function user_can_access_project(p_project_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1
    from   projects p
    where  p.id = p_project_id
    and (
      -- workspace project: user must be in the org
      (p.visibility = 'workspace'   and p.org_id in (select user_org_ids()))
      -- private project: user must be the creator
      or (p.visibility = 'private'  and p.created_by = auth.uid())
      -- restricted project: user must be in project_members
      or (p.visibility = 'restricted' and exists (
          select 1 from project_members pm
          where  pm.project_id = p.id
          and    pm.user_id    = auth.uid()
      ))
    )
  )
$$;

-- Is the current user an explicit member of the given document?
-- Security-definer so document RLS can call this without recursion.
create or replace function user_is_document_member(p_doc_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1
    from   document_members
    where  doc_id   = p_doc_id
    and    user_id  = auth.uid()
  )
$$;

-- Can the current user READ the given document?
-- = project gate AND document-level read permission.
create or replace function user_can_access_document(p_doc_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1
    from   documents d
    where  d.id = p_doc_id
    and (
      -- public share link — no login required
      d.public_share_token is not null
      or (
        user_can_access_project(d.project_id)
        and (
          d.visibility = 'workspace'
          or (d.visibility = 'private'    and d.created_by = auth.uid())
          or (d.visibility = 'restricted' and (
              d.created_by = auth.uid()
              or user_is_document_member(d.id)
          ))
        )
      )
    )
  )
$$;

-- Can the current user EDIT (write) the given document?
-- Viewers on restricted docs cannot edit.
create or replace function user_can_edit_document(p_doc_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1
    from   documents d
    where  d.id = p_doc_id
    and    user_can_access_project(d.project_id)
    and (
      d.visibility = 'workspace'
      or (d.visibility = 'private' and d.created_by = auth.uid())
      or (d.visibility = 'restricted' and (
          d.created_by = auth.uid()
          or exists (
            select 1 from document_members dm
            where  dm.doc_id  = d.id
            and    dm.user_id = auth.uid()
            and    dm.role    = 'editor'
          )
      ))
    )
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 4 — CREATE/ALTER user_settings + ENABLE ROW LEVEL SECURITY
-- user_settings must exist before we can enable RLS on it. It may or may not
-- exist depending on which previous migrations were run.
-- ─────────────────────────────────────────────────────────────────────────────

-- Create user_settings if it doesn't exist (fresh DB, skipped v2 migration)
create table if not exists user_settings (
  id                 text        primary key default 'default',
  author_name        text        not null default 'You',
  author_color       text        not null default '#2563EB',
  theme              text        not null default 'light' check (theme in ('light', 'dark')),
  default_doc_status text        not null default 'draft' check (default_doc_status in ('draft', 'published')),
  auto_save_delay    integer     not null default 800,
  ai_model           text        not null default 'claude-sonnet-4-6',
  user_id            uuid        references auth.users(id) on delete cascade,
  updated_at         timestamptz not null default now()
);

-- Add user_id column if table already existed (from v2 migration)
alter table user_settings
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create unique index if not exists user_settings_user_id_idx on user_settings(user_id);

-- Enable RLS on all tables
alter table organizations        enable row level security;
alter table organization_members enable row level security;
alter table invitations          enable row level security;
alter table projects             enable row level security;
alter table project_members      enable row level security;
alter table documents            enable row level security;
alter table document_members     enable row level security;
alter table block_history        enable row level security;
alter table meetings             enable row level security;
alter table proposed_changes     enable row level security;
alter table user_settings        enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 5 — RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

-- ── organizations ────────────────────────────────────────────────────────────

drop policy if exists "orgs: members can view their org"      on organizations;
drop policy if exists "orgs: authenticated users can create"  on organizations;
drop policy if exists "orgs: owner or admin can update"       on organizations;
drop policy if exists "orgs: owner can delete"                on organizations;

create policy "orgs: members can view their org"
  on organizations for select
  using (id in (select user_org_ids()));

create policy "orgs: authenticated users can create"
  on organizations for insert
  with check (auth.uid() is not null);

create policy "orgs: owner or admin can update"
  on organizations for update
  using (exists (
    select 1 from organization_members
    where  org_id   = organizations.id
    and    user_id  = auth.uid()
    and    role in ('owner', 'admin')
  ));

create policy "orgs: owner can delete"
  on organizations for delete
  using (exists (
    select 1 from organization_members
    where  org_id   = organizations.id
    and    user_id  = auth.uid()
    and    role     = 'owner'
  ));

-- ── organization_members ─────────────────────────────────────────────────────

drop policy if exists "org_members: members can view peers"                       on organization_members;
drop policy if exists "org_members: user can join via invite or create as owner"  on organization_members;
drop policy if exists "org_members: owner/admin can update roles"                 on organization_members;
drop policy if exists "org_members: leave or admin removes"                       on organization_members;

create policy "org_members: members can view peers"
  on organization_members for select
  using (org_id in (select user_org_ids()));

create policy "org_members: user can join via invite or create as owner"
  on organization_members for insert
  with check (
    user_id = auth.uid()
    and (
      (
        role = 'owner'
        and exists (
          select 1 from organizations
          where  id         = org_id
          and    created_by = auth.uid()
        )
      )
      or exists (
        select 1 from invitations i
        where  i.org_id      = organization_members.org_id
        and    i.accepted_at is null
        and    i.expires_at  > now()
        and (
          i.email is null
          or i.email = (select email from auth.users where id = auth.uid())
        )
      )
    )
  );

create policy "org_members: owner/admin can update roles"
  on organization_members for update
  using (
    organization_members.role != 'owner'
    and exists (
      select 1 from organization_members om
      where  om.org_id  = organization_members.org_id
      and    om.user_id = auth.uid()
      and    om.role in ('owner', 'admin')
    )
  )
  with check (role != 'owner');

create policy "org_members: leave or admin removes"
  on organization_members for delete
  using (
    (user_id = auth.uid() and role != 'owner')
    or (
      role != 'owner'
      and exists (
        select 1 from organization_members om
        where  om.org_id  = organization_members.org_id
        and    om.user_id = auth.uid()
        and    om.role in ('owner', 'admin')
      )
    )
  );

-- ── invitations ──────────────────────────────────────────────────────────────

drop policy if exists "invitations: owner/admin can view"   on invitations;
drop policy if exists "invitations: owner/admin can create" on invitations;
drop policy if exists "invitations: owner/admin can revoke" on invitations;

create policy "invitations: owner/admin can view"
  on invitations for select
  using (
    org_id in (select user_org_ids())
    and exists (
      select 1 from organization_members
      where  org_id  = invitations.org_id
      and    user_id = auth.uid()
      and    role in ('owner', 'admin')
    )
  );

create policy "invitations: owner/admin can create"
  on invitations for insert
  with check (exists (
    select 1 from organization_members
    where  org_id  = invitations.org_id
    and    user_id = auth.uid()
    and    role in ('owner', 'admin')
  ));

create policy "invitations: owner/admin can revoke"
  on invitations for delete
  using (exists (
    select 1 from organization_members
    where  org_id  = invitations.org_id
    and    user_id = auth.uid()
    and    role in ('owner', 'admin')
  ));

-- ── projects ─────────────────────────────────────────────────────────────────

drop policy if exists "projects: view accessible projects"    on projects;
drop policy if exists "projects: org members can create"      on projects;
drop policy if exists "projects: creator or admin can update" on projects;
drop policy if exists "projects: creator or admin can delete" on projects;

create policy "projects: view accessible projects"
  on projects for select
  using (
    (visibility = 'workspace'   and org_id in (select user_org_ids()))
    or (visibility = 'private'  and created_by = auth.uid())
    or (visibility = 'restricted' and exists (
        select 1 from project_members pm
        where  pm.project_id = projects.id
        and    pm.user_id    = auth.uid()
    ))
  );

create policy "projects: org members can create"
  on projects for insert
  with check (org_id in (select user_org_ids()));

create policy "projects: creator or admin can update"
  on projects for update
  using (
    created_by = auth.uid()
    or exists (
      select 1 from organization_members
      where  org_id  = projects.org_id
      and    user_id = auth.uid()
      and    role in ('owner', 'admin')
    )
  );

create policy "projects: creator or admin can delete"
  on projects for delete
  using (
    created_by = auth.uid()
    or exists (
      select 1 from organization_members
      where  org_id  = projects.org_id
      and    user_id = auth.uid()
      and    role in ('owner', 'admin')
    )
  );

-- ── project_members ───────────────────────────────────────────────────────────

drop policy if exists "project_members: project-accessible users can view"          on project_members;
drop policy if exists "project_members: project creator or org admin can insert"    on project_members;
drop policy if exists "project_members: project creator or org admin can update"    on project_members;
drop policy if exists "project_members: leave self or admin removes"                on project_members;

create policy "project_members: project-accessible users can view"
  on project_members for select
  using (user_can_access_project(project_id));

create policy "project_members: project creator or org admin can insert"
  on project_members for insert
  with check (exists (
    select 1 from projects p
    where  p.id = project_id
    and (
      p.created_by = auth.uid()
      or exists (
        select 1 from organization_members om
        where  om.org_id  = p.org_id
        and    om.user_id = auth.uid()
        and    om.role in ('owner', 'admin')
      )
    )
  ));

create policy "project_members: project creator or org admin can update"
  on project_members for update
  using (exists (
    select 1 from projects p
    where  p.id = project_id
    and (
      p.created_by = auth.uid()
      or exists (
        select 1 from organization_members om
        where  om.org_id  = p.org_id
        and    om.user_id = auth.uid()
        and    om.role in ('owner', 'admin')
      )
    )
  ));

create policy "project_members: leave self or admin removes"
  on project_members for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from projects p
      where  p.id = project_id
      and (
        p.created_by = auth.uid()
        or exists (
          select 1 from organization_members om
          where  om.org_id  = p.org_id
          and    om.user_id = auth.uid()
          and    om.role in ('owner', 'admin')
        )
      )
    )
  );

-- ── documents ─────────────────────────────────────────────────────────────────

drop policy if exists "documents: view accessible documents"      on documents;
drop policy if exists "documents: project members can create"     on documents;
drop policy if exists "documents: authorized users can update"    on documents;
drop policy if exists "documents: creator or org admin can delete" on documents;

create policy "documents: view accessible documents"
  on documents for select
  using (user_can_access_document(id));

create policy "documents: project members can create"
  on documents for insert
  with check (user_can_access_project(project_id));

create policy "documents: authorized users can update"
  on documents for update
  using (user_can_edit_document(id));

create policy "documents: creator or org admin can delete"
  on documents for delete
  using (
    created_by = auth.uid()
    or exists (
      select 1 from projects p
      join   organization_members om on om.org_id = p.org_id
      where  p.id          = documents.project_id
      and    om.user_id    = auth.uid()
      and    om.role in ('owner', 'admin')
    )
  );

-- ── document_members ─────────────────────────────────────────────────────────

drop policy if exists "document_members: creator or member can view"  on document_members;
drop policy if exists "document_members: doc creator can manage"      on document_members;
drop policy if exists "document_members: doc creator can update roles" on document_members;
drop policy if exists "document_members: creator or self can remove"  on document_members;

create policy "document_members: creator or member can view"
  on document_members for select
  using (
    exists (
      select 1 from documents d
      where  d.id          = doc_id
      and    d.created_by  = auth.uid()
    )
    or user_is_document_member(doc_id)
  );

create policy "document_members: doc creator can manage"
  on document_members for insert
  with check (exists (
    select 1 from documents d
    where  d.id         = doc_id
    and    d.created_by = auth.uid()
  ));

create policy "document_members: doc creator can update roles"
  on document_members for update
  using (exists (
    select 1 from documents d
    where  d.id         = doc_id
    and    d.created_by = auth.uid()
  ));

create policy "document_members: creator or self can remove"
  on document_members for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from documents d
      where  d.id         = doc_id
      and    d.created_by = auth.uid()
    )
  );

-- ── block_history ─────────────────────────────────────────────────────────────

drop policy if exists "block_history: view if can access document"   on block_history;
drop policy if exists "block_history: insert if can edit document"   on block_history;

create policy "block_history: view if can access document"
  on block_history for select
  using (user_can_access_document(doc_id));

create policy "block_history: insert if can edit document"
  on block_history for insert
  with check (user_can_edit_document(doc_id));

-- ── meetings ─────────────────────────────────────────────────────────────────

drop policy if exists "meetings: view if can access project"   on meetings;
drop policy if exists "meetings: insert if can access project" on meetings;
drop policy if exists "meetings: update if can access project" on meetings;

create policy "meetings: view if can access project"
  on meetings for select
  using (user_can_access_project(project_id));

create policy "meetings: insert if can access project"
  on meetings for insert
  with check (user_can_access_project(project_id));

create policy "meetings: update if can access project"
  on meetings for update
  using (user_can_access_project(project_id));

-- ── proposed_changes ─────────────────────────────────────────────────────────

drop policy if exists "proposed_changes: view if can access document"   on proposed_changes;
drop policy if exists "proposed_changes: insert if can access document" on proposed_changes;
drop policy if exists "proposed_changes: update if can edit document"   on proposed_changes;

create policy "proposed_changes: view if can access document"
  on proposed_changes for select
  using (user_can_access_document(doc_id));

create policy "proposed_changes: insert if can access document"
  on proposed_changes for insert
  with check (user_can_access_document(doc_id));

create policy "proposed_changes: update if can edit document"
  on proposed_changes for update
  using (user_can_edit_document(doc_id));

-- ── user_settings ─────────────────────────────────────────────────────────────

drop policy if exists "user_settings: users can view own settings"   on user_settings;
drop policy if exists "user_settings: users can insert own settings" on user_settings;
drop policy if exists "user_settings: users can update own settings" on user_settings;

create policy "user_settings: users can view own settings"
  on user_settings for select
  using (user_id = auth.uid());

create policy "user_settings: users can insert own settings"
  on user_settings for insert
  with check (user_id = auth.uid());

create policy "user_settings: users can update own settings"
  on user_settings for update
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 6 — HELPER INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists org_members_user_id_idx     on organization_members(user_id);
create index if not exists org_members_org_id_idx      on organization_members(org_id);
create index if not exists project_members_user_id_idx on project_members(user_id);
create index if not exists document_members_user_id_idx on document_members(user_id);
create index if not exists documents_share_token_idx   on documents(public_share_token)
  where public_share_token is not null;
create index if not exists documents_created_by_idx    on documents(created_by);
create index if not exists projects_created_by_idx     on projects(created_by);

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE
-- Next steps in Supabase dashboard:
--   1. Authentication → Providers → enable Email (magic link) + Google OAuth
--   2. Authentication → URL Configuration → set Site URL to http://localhost:3000
--      Add redirect URL: http://localhost:3000/auth/callback
--   3. For Google OAuth: add your Google client ID + secret
-- ═══════════════════════════════════════════════════════════════════════════
