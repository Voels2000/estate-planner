-- Sprint Four-Surface Polish: distinguish prep vs meeting record vs follow-up notes
ALTER TABLE public.advisor_notes
ADD COLUMN IF NOT EXISTS note_type text
  DEFAULT 'meeting_record'
  CHECK (note_type IN ('prep', 'meeting_record', 'follow_up'));

COMMENT ON COLUMN public.advisor_notes.note_type IS
  'Advisor note category: prep (pre-meeting), meeting_record (what was discussed), follow_up (next session action)';
