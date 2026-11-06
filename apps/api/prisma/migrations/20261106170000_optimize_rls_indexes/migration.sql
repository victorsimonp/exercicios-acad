CREATE INDEX "Exercise_primaryMuscleGroupId_idx" ON public."Exercise"("primaryMuscleGroupId");
CREATE INDEX "WorkoutSession_programId_idx" ON public."WorkoutSession"("programId");

-- Keep one SELECT policy per role; write policies preserve the same owner checks.
DROP POLICY exercise_write ON public."Exercise";
CREATE POLICY exercise_insert ON public."Exercise" FOR INSERT TO ht_api WITH CHECK ("userId" IN (SELECT id FROM public."User"));
CREATE POLICY exercise_update ON public."Exercise" FOR UPDATE TO ht_api USING ("userId" IN (SELECT id FROM public."User")) WITH CHECK ("userId" IN (SELECT id FROM public."User"));
CREATE POLICY exercise_delete ON public."Exercise" FOR DELETE TO ht_api USING ("userId" IN (SELECT id FROM public."User"));
DROP POLICY exercise_muscle_write ON public."ExerciseMuscle";
CREATE POLICY exercise_muscle_insert ON public."ExerciseMuscle" FOR INSERT TO ht_api WITH CHECK (EXISTS (SELECT 1 FROM public."Exercise" e WHERE e.id = "exerciseId" AND e."userId" IN (SELECT id FROM public."User")));
CREATE POLICY exercise_muscle_update ON public."ExerciseMuscle" FOR UPDATE TO ht_api USING (EXISTS (SELECT 1 FROM public."Exercise" e WHERE e.id = "exerciseId" AND e."userId" IN (SELECT id FROM public."User"))) WITH CHECK (EXISTS (SELECT 1 FROM public."Exercise" e WHERE e.id = "exerciseId" AND e."userId" IN (SELECT id FROM public."User")));
CREATE POLICY exercise_muscle_delete ON public."ExerciseMuscle" FOR DELETE TO ht_api USING (EXISTS (SELECT 1 FROM public."Exercise" e WHERE e.id = "exerciseId" AND e."userId" IN (SELECT id FROM public."User")));
