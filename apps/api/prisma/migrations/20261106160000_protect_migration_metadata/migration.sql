ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._prisma_migrations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public._prisma_migrations FROM PUBLIC,anon,authenticated,ht_api;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = '_prisma_migrations' AND policyname = 'migration_metadata_denied') THEN
    CREATE POLICY migration_metadata_denied ON public._prisma_migrations FOR ALL TO anon,authenticated,ht_api USING (false) WITH CHECK (false);
  END IF;
END $$;
