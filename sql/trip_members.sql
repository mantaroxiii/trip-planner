-- ============================================
-- Trip Planner: Full SQL Schema
-- Safe to run multiple times (IF NOT EXISTS)
-- ============================================

-- 1. trip_proposals (ข้อเสนอจากเพื่อน)
CREATE TABLE IF NOT EXISTS trip_proposals (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id       UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  proposer_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  proposer_name TEXT,
  description   TEXT,
  plan_json     JSONB NOT NULL,
  status        TEXT DEFAULT 'pending',
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE trip_proposals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'proposals_insert' AND tablename = 'trip_proposals') THEN
    CREATE POLICY "proposals_insert" ON trip_proposals FOR INSERT WITH CHECK (auth.uid() = proposer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'proposals_owner_select' AND tablename = 'trip_proposals') THEN
    CREATE POLICY "proposals_owner_select" ON trip_proposals FOR SELECT USING (trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'proposals_owner_update' AND tablename = 'trip_proposals') THEN
    CREATE POLICY "proposals_owner_update" ON trip_proposals FOR UPDATE USING (trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'proposals_self_select' AND tablename = 'trip_proposals') THEN
    CREATE POLICY "proposals_self_select" ON trip_proposals FOR SELECT USING (proposer_id = auth.uid());
  END IF;
END $$;

-- 2. trip_members (ผู้ร่วมทริป - auto-join เมื่อเพื่อนเปิด link)
CREATE TABLE IF NOT EXISTS trip_members (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id   UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL,
  role      TEXT DEFAULT 'member' CHECK (role IN ('member', 'editor')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trip_id, user_id)
);

ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'members_read_own' AND tablename = 'trip_members') THEN
    CREATE POLICY "members_read_own" ON trip_members FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'members_owner_manage' AND tablename = 'trip_members') THEN
    CREATE POLICY "members_owner_manage" ON trip_members FOR ALL USING (trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'members_service_role' AND tablename = 'trip_members') THEN
    CREATE POLICY "members_service_role" ON trip_members FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
