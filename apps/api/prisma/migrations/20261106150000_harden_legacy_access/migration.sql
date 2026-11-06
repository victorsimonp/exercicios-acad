-- Explicitly deny access to legacy/technical tables, even if a grant is added later.
CREATE POLICY legacy_sessions_denied ON public."AuthSession" FOR ALL TO anon,authenticated,ht_api USING (false) WITH CHECK (false);
CREATE POLICY setup_check_denied ON public."SetupCheck" FOR ALL TO anon,authenticated,ht_api USING (false) WITH CHECK (false);
DO $$ BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC,anon,authenticated;
  END IF;
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public._prisma_migrations FORCE ROW LEVEL SECURITY;
    REVOKE ALL ON public._prisma_migrations FROM PUBLIC,anon,authenticated,ht_api;
    CREATE POLICY migration_metadata_denied ON public._prisma_migrations FOR ALL TO anon,authenticated,ht_api USING (false) WITH CHECK (false);
  END IF;
END $$;
