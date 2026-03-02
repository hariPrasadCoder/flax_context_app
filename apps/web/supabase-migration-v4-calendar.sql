-- ============================================================
-- Migration v4: Calendar connections + org meetings (Recall.ai)
-- Run this after v3-auth migration.
-- ============================================================

-- Ensure set_updated_at trigger function exists
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── calendar_connections ─────────────────────────────────────
-- One row per user who has connected Google Calendar.
-- Stores OAuth tokens needed to fetch calendar events.
CREATE TABLE IF NOT EXISTS calendar_connections (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id               UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  google_access_token  TEXT        NOT NULL,
  google_refresh_token TEXT,
  token_expiry         TIMESTAMPTZ,
  auto_join            BOOLEAN     NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ── org_meetings ─────────────────────────────────────────────
-- One row per unique (org, meeting_url, start_time).
-- This is the dedup table — no matter how many team members
-- share the same calendar event, only one bot gets dispatched.
CREATE TABLE IF NOT EXISTS org_meetings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  discovered_by_user_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  meeting_url           TEXT        NOT NULL,
  meeting_title         TEXT,
  start_time            TIMESTAMPTZ NOT NULL,
  end_time              TIMESTAMPTZ,
  platform              TEXT        CHECK (platform IN ('google_meet', 'zoom')),
  recall_bot_id         TEXT        UNIQUE,
  -- pending  → discovered, bot not yet dispatched
  -- dispatched → bot created in Recall, waiting to join
  -- in_call  → bot actively in the meeting
  -- done     → meeting ended, transcript received
  -- failed   → Recall reported an error
  bot_status            TEXT        NOT NULL DEFAULT 'pending',
  transcript            JSONB,
  matched_project_id    UUID        REFERENCES projects(id) ON DELETE SET NULL,
  match_confidence      TEXT        CHECK (match_confidence IN ('high', 'low', 'none')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The dedup constraint: one row per meeting per org
  UNIQUE(org_id, meeting_url, start_time)
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_meetings         ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own calendar connection
DROP POLICY IF EXISTS "Users manage own calendar connection" ON calendar_connections;
CREATE POLICY "Users manage own calendar connection"
  ON calendar_connections FOR ALL
  TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Org members can view all meetings in their org
DROP POLICY IF EXISTS "Org members view org meetings" ON org_meetings;
CREATE POLICY "Org members view org meetings"
  ON org_meetings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.org_id = org_meetings.org_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- ── Triggers ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_calendar_connections_updated_at ON calendar_connections;
CREATE TRIGGER set_calendar_connections_updated_at
  BEFORE UPDATE ON calendar_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_org_meetings_updated_at ON org_meetings;
CREATE TRIGGER set_org_meetings_updated_at
  BEFORE UPDATE ON org_meetings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS calendar_connections_org_id_idx  ON calendar_connections(org_id);
CREATE INDEX IF NOT EXISTS org_meetings_org_id_idx          ON org_meetings(org_id);
CREATE INDEX IF NOT EXISTS org_meetings_start_time_idx      ON org_meetings(start_time);
CREATE INDEX IF NOT EXISTS org_meetings_recall_bot_id_idx   ON org_meetings(recall_bot_id);
CREATE INDEX IF NOT EXISTS org_meetings_bot_status_idx      ON org_meetings(bot_status);
