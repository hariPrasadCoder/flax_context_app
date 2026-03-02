-- ============================================================
-- Migration v6: Meeting summaries, action items, reliability
-- Run after v4-calendar. Safe to run after v5 too (all IF NOT EXISTS).
-- ============================================================

-- AI-generated meeting summary (bullet points)
ALTER TABLE org_meetings
  ADD COLUMN IF NOT EXISTS meeting_summary TEXT;

-- AI-extracted action items (JSON array of strings)
ALTER TABLE org_meetings
  ADD COLUMN IF NOT EXISTS action_items JSONB;

-- Bot failure reason (e.g. "meeting_requires_sign_in")
-- Included here in case v5 was not run
ALTER TABLE org_meetings
  ADD COLUMN IF NOT EXISTS bot_error TEXT;

-- org_meeting_id on proposed_changes (in case v5 was not run)
ALTER TABLE proposed_changes
  ALTER COLUMN meeting_id DROP NOT NULL;

ALTER TABLE proposed_changes
  ADD COLUMN IF NOT EXISTS org_meeting_id UUID
    REFERENCES org_meetings(id) ON DELETE CASCADE;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS proposed_changes_org_meeting_id_idx
  ON proposed_changes(org_meeting_id);

CREATE INDEX IF NOT EXISTS org_meetings_org_start_idx
  ON org_meetings(org_id, start_time DESC);

CREATE INDEX IF NOT EXISTS org_meetings_bot_status_idx
  ON org_meetings(bot_status);
