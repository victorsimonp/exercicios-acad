-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authUserId" UUID,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");

-- auth.users is managed by Supabase. The conditional keeps the same migration
-- executable on the preserved PostgreSQL development database.
DO $$ BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    ALTER TABLE public."User" ADD CONSTRAINT "User_authUserId_fkey"
      FOREIGN KEY ("authUserId") REFERENCES auth.users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ht_api') THEN CREATE ROLE ht_api NOLOGIN NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN NOBYPASSRLS; END IF;
  EXECUTE format('GRANT ht_api TO %I',current_user);
END $$;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA public, app_private TO ht_api, authenticated;

-- Compatible with Supabase's validated JWT context. SET LOCAL prevents context
-- leaking between requests when using a pooled PostgreSQL connection.
CREATE OR REPLACE FUNCTION app_private.auth_uid() RETURNS uuid
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub')::uuid $$;
CREATE OR REPLACE FUNCTION app_private.auth_email() RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT lower(nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'email') $$;
REVOKE ALL ON FUNCTION app_private.auth_uid(), app_private.auth_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.auth_uid(), app_private.auth_email() TO ht_api, authenticated;

-- The only privileged profile operation. Needed to claim an unlinked imported
-- profile that RLS intentionally hides. Only the backend role can execute it.
-- Email/sub are built from auth.getUser(), never from request JSON/user_metadata.
CREATE OR REPLACE FUNCTION app_private.claim_profile(new_id text, display_name text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := app_private.auth_uid(); verified_email text := app_private.auth_email();
        result text; linked uuid;
BEGIN
  IF uid IS NULL OR verified_email IS NULL THEN RAISE EXCEPTION 'Verified identity required' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(uid::text));
  SELECT id INTO result FROM public."User" WHERE "authUserId" = uid;
  IF result IS NOT NULL THEN RETURN result; END IF;
  SELECT id,"authUserId" INTO result,linked FROM public."User" WHERE lower(email) = verified_email FOR UPDATE;
  IF result IS NOT NULL THEN
    IF linked IS NOT NULL THEN RAISE EXCEPTION 'Identity already linked' USING ERRCODE = '42501'; END IF;
    UPDATE public."User" SET "authUserId" = uid,"updatedAt" = now() WHERE id = result;
  ELSE
    result := new_id;
    INSERT INTO public."User"(id,name,email,"authUserId",settings,"createdAt","updatedAt")
      VALUES (result,left(display_name,100),verified_email,uid,'{}',now(),now());
  END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION app_private.claim_profile(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION app_private.claim_profile(text,text) TO ht_api;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['User','AuthSession','SetupCheck','MuscleGroup','Exercise','ExerciseMuscle','TrainingProgram','ProgramWeek','WorkoutTemplate','WorkoutExercise','WorkoutSession','SessionExercise','ExerciseSet','WorkoutSchedule','ProgressionRecommendation','ExerciseChangeLog'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,ht_api',t);
  END LOOP;
END $$;

GRANT SELECT ON public."User",public."MuscleGroup",public."Exercise",public."ExerciseMuscle",public."TrainingProgram",public."ProgramWeek",public."WorkoutTemplate",public."WorkoutExercise",public."WorkoutSession",public."SessionExercise",public."ExerciseSet",public."WorkoutSchedule",public."ProgressionRecommendation",public."ExerciseChangeLog" TO authenticated,ht_api;
GRANT INSERT ON public."MuscleGroup" TO ht_api;
GRANT INSERT,UPDATE,DELETE ON public."Exercise",public."ExerciseMuscle",public."TrainingProgram",public."ProgramWeek",public."WorkoutTemplate",public."WorkoutExercise",public."WorkoutSession",public."SessionExercise",public."ExerciseSet",public."WorkoutSchedule",public."ProgressionRecommendation",public."ExerciseChangeLog" TO ht_api;
GRANT UPDATE(name,settings,"updatedAt") ON public."User" TO ht_api;

CREATE POLICY profile_select ON public."User" FOR SELECT TO authenticated,ht_api USING ("authUserId" = (SELECT app_private.auth_uid()));
CREATE POLICY profile_update ON public."User" FOR UPDATE TO ht_api USING ("authUserId" = (SELECT app_private.auth_uid())) WITH CHECK ("authUserId" = (SELECT app_private.auth_uid()));
CREATE POLICY muscle_select ON public."MuscleGroup" FOR SELECT TO authenticated,ht_api USING ((SELECT app_private.auth_uid()) IS NOT NULL);
CREATE POLICY muscle_insert ON public."MuscleGroup" FOR INSERT TO ht_api WITH CHECK ((SELECT app_private.auth_uid()) IS NOT NULL);
CREATE POLICY exercise_select ON public."Exercise" FOR SELECT TO authenticated,ht_api USING ("userId" IS NULL OR "userId" IN (SELECT id FROM public."User"));
CREATE POLICY exercise_write ON public."Exercise" FOR ALL TO ht_api USING ("userId" IN (SELECT id FROM public."User")) WITH CHECK ("userId" IN (SELECT id FROM public."User"));
CREATE POLICY exercise_muscle_select ON public."ExerciseMuscle" FOR SELECT TO authenticated,ht_api USING (EXISTS (SELECT 1 FROM public."Exercise" e WHERE e.id = "exerciseId"));
CREATE POLICY exercise_muscle_write ON public."ExerciseMuscle" FOR ALL TO ht_api USING (EXISTS (SELECT 1 FROM public."Exercise" e WHERE e.id = "exerciseId" AND e."userId" IN (SELECT id FROM public."User"))) WITH CHECK (EXISTS (SELECT 1 FROM public."Exercise" e WHERE e.id = "exerciseId" AND e."userId" IN (SELECT id FROM public."User")));

CREATE POLICY program_owner ON public."TrainingProgram" FOR ALL TO authenticated,ht_api USING ("userId" IN (SELECT id FROM public."User")) WITH CHECK ("userId" IN (SELECT id FROM public."User"));
CREATE POLICY week_owner ON public."ProgramWeek" FOR ALL TO authenticated,ht_api USING (EXISTS (SELECT 1 FROM public."TrainingProgram" p WHERE p.id = "programId")) WITH CHECK (EXISTS (SELECT 1 FROM public."TrainingProgram" p WHERE p.id = "programId"));
CREATE POLICY workout_owner ON public."WorkoutTemplate" FOR ALL TO authenticated,ht_api USING (EXISTS (SELECT 1 FROM public."TrainingProgram" p WHERE p.id = "programId")) WITH CHECK (EXISTS (SELECT 1 FROM public."TrainingProgram" p WHERE p.id = "programId"));
CREATE POLICY prescription_owner ON public."WorkoutExercise" FOR ALL TO authenticated,ht_api USING (EXISTS (SELECT 1 FROM public."WorkoutTemplate" w WHERE w.id = "workoutTemplateId")) WITH CHECK (EXISTS (SELECT 1 FROM public."WorkoutTemplate" w WHERE w.id = "workoutTemplateId") AND EXISTS (SELECT 1 FROM public."Exercise" e WHERE e.id = "exerciseId"));
CREATE POLICY session_owner ON public."WorkoutSession" FOR ALL TO authenticated,ht_api USING ("userId" IN (SELECT id FROM public."User")) WITH CHECK ("userId" IN (SELECT id FROM public."User") AND EXISTS (SELECT 1 FROM public."TrainingProgram" p WHERE p.id = "programId" AND p."userId" = "WorkoutSession"."userId") AND EXISTS (SELECT 1 FROM public."ProgramWeek" w WHERE w.id = "programWeekId" AND w."programId" = "WorkoutSession"."programId") AND EXISTS (SELECT 1 FROM public."WorkoutTemplate" w WHERE w.id = "workoutTemplateId" AND w."programId" = "WorkoutSession"."programId"));
CREATE POLICY session_exercise_owner ON public."SessionExercise" FOR ALL TO authenticated,ht_api USING (EXISTS (SELECT 1 FROM public."WorkoutSession" s WHERE s.id = "sessionId")) WITH CHECK (EXISTS (SELECT 1 FROM public."WorkoutSession" s WHERE s.id = "sessionId") AND EXISTS (SELECT 1 FROM public."Exercise" e WHERE e.id = "exerciseId"));
CREATE POLICY set_owner ON public."ExerciseSet" FOR ALL TO authenticated,ht_api USING (EXISTS (SELECT 1 FROM public."SessionExercise" e WHERE e.id = "sessionExerciseId")) WITH CHECK (EXISTS (SELECT 1 FROM public."SessionExercise" e WHERE e.id = "sessionExerciseId"));
CREATE POLICY schedule_owner ON public."WorkoutSchedule" FOR ALL TO authenticated,ht_api USING ("userId" IN (SELECT id FROM public."User")) WITH CHECK ("userId" IN (SELECT id FROM public."User") AND EXISTS (SELECT 1 FROM public."WorkoutTemplate" w WHERE w.id = "workoutTemplateId") AND ("sessionId" IS NULL OR EXISTS (SELECT 1 FROM public."WorkoutSession" s WHERE s.id = "sessionId" AND s."workoutTemplateId" = "WorkoutSchedule"."workoutTemplateId")));
CREATE POLICY recommendation_owner ON public."ProgressionRecommendation" FOR ALL TO authenticated,ht_api USING ("userId" IN (SELECT id FROM public."User")) WITH CHECK ("userId" IN (SELECT id FROM public."User") AND EXISTS (SELECT 1 FROM public."WorkoutSession" s WHERE s.id = "sessionId" AND s."userId" = "ProgressionRecommendation"."userId") AND EXISTS (SELECT 1 FROM public."Exercise" e WHERE e.id = "exerciseId"));
CREATE POLICY audit_owner ON public."ExerciseChangeLog" FOR ALL TO authenticated,ht_api USING ("userId" IN (SELECT id FROM public."User")) WITH CHECK ("userId" IN (SELECT id FROM public."User"));

CREATE INDEX "SessionExercise_exerciseId_idx" ON public."SessionExercise"("exerciseId");
CREATE INDEX "ExerciseMuscle_muscleGroupId_idx" ON public."ExerciseMuscle"("muscleGroupId");
CREATE INDEX "WorkoutExercise_exerciseId_idx" ON public."WorkoutExercise"("exerciseId");
CREATE INDEX "WorkoutSession_programWeekId_idx" ON public."WorkoutSession"("programWeekId");
CREATE INDEX "WorkoutSession_workoutTemplateId_idx" ON public."WorkoutSession"("workoutTemplateId");
CREATE INDEX "WorkoutSchedule_workoutTemplateId_idx" ON public."WorkoutSchedule"("workoutTemplateId");
CREATE INDEX "ProgressionRecommendation_exerciseId_idx" ON public."ProgressionRecommendation"("exerciseId");
