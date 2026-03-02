-- ============================================================
-- Migration v5: Phase 2 — AI proposal pipeline from Recall.ai
-- Run this after v4-calendar migration.
-- ============================================================

-- Make meeting_id nullable so AI-triggered proposals can omit it
-- (they use org_meeting_id instead)
ALTER TABLE proposed_changes
  ALTER COLUMN meeting_id DROP NOT NULL;

-- Add org_meeting_id to link proposals back to Recall.ai meetings
ALTER TABLE proposed_changes
  ADD COLUMN IF NOT EXISTS org_meeting_id UUID
    REFERENCES org_meetings(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS proposed_changes_org_meeting_id_idx
  ON proposed_changes(org_meeting_id);

-- Store bot failure reason (e.g. "meeting_requires_sign_in") for display in the UI
ALTER TABLE org_meetings
  ADD COLUMN IF NOT EXISTS bot_error TEXT;
