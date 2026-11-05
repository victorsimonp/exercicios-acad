-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuscleGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT '',
    "parentId" TEXT,

    CONSTRAINT "MuscleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "primaryMuscleGroupId" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT '',
    "equipment" TEXT NOT NULL DEFAULT '',
    "movementType" TEXT NOT NULL DEFAULT 'compound',
    "laterality" TEXT NOT NULL DEFAULT 'bilateral',
    "instructions" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'custom',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "increment" DECIMAL(8,3) NOT NULL DEFAULT 1,
    "incrementPercent" DECIMAL(6,3) NOT NULL DEFAULT 2.5,
    "weightBasis" TEXT NOT NULL DEFAULT 'total',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseMuscle" (
    "exerciseId" TEXT NOT NULL,
    "muscleGroupId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "emphasis" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "ExerciseMuscle_pkey" PRIMARY KEY ("exerciseId","muscleGroupId")
);

-- CreateTable
CREATE TABLE "TrainingProgram" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "totalWeeks" INTEGER NOT NULL DEFAULT 8,
    "startDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramWeek" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "focus" TEXT NOT NULL,
    "isDeload" BOOLEAN NOT NULL DEFAULT false,
    "rirMin" INTEGER NOT NULL DEFAULT 1,
    "rirMax" INTEGER NOT NULL DEFAULT 2,
    "volumeRule" TEXT NOT NULL DEFAULT 'target',
    "setsOverride" INTEGER,

    CONSTRAINT "ProgramWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplate" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "focus" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "WorkoutTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutExercise" (
    "id" TEXT NOT NULL,
    "workoutTemplateId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "targetSets" INTEGER NOT NULL,
    "minReps" INTEGER NOT NULL,
    "maxReps" INTEGER NOT NULL,
    "targetRirMin" INTEGER NOT NULL DEFAULT 1,
    "targetRirMax" INTEGER NOT NULL DEFAULT 2,
    "restSeconds" INTEGER NOT NULL,
    "restMaxSeconds" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "futureOverride" JSONB,

    CONSTRAINT "WorkoutExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "programWeekId" TEXT NOT NULL,
    "workoutTemplateId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT NOT NULL DEFAULT '',
    "nameSnapshot" TEXT NOT NULL,
    "focusSnapshot" TEXT NOT NULL,
    "weekNumberSnapshot" INTEGER NOT NULL,
    "isDeloadSnapshot" BOOLEAN NOT NULL,
    "restEndsAt" TIMESTAMP(3),

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionExercise" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "exerciseNameSnapshot" TEXT NOT NULL,
    "muscleSnapshot" TEXT NOT NULL,
    "weightBasisSnapshot" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prescribedSetsSnapshot" INTEGER NOT NULL,
    "minRepsSnapshot" INTEGER NOT NULL,
    "maxRepsSnapshot" INTEGER NOT NULL,
    "targetRirMinSnapshot" INTEGER NOT NULL,
    "targetRirMaxSnapshot" INTEGER NOT NULL,
    "restSecondsSnapshot" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "SessionExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseSet" (
    "id" TEXT NOT NULL,
    "sessionExerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "setType" TEXT NOT NULL DEFAULT 'work',
    "prescribedRepsMin" INTEGER NOT NULL,
    "prescribedRepsMax" INTEGER NOT NULL,
    "actualReps" INTEGER,
    "weight" DECIMAL(10,3),
    "weightUnit" TEXT NOT NULL DEFAULT 'kg',
    "weightBasis" TEXT NOT NULL DEFAULT 'total',
    "rir" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "techniqueOk" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExerciseSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressionRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "currentWeight" DECIMAL(10,3),
    "suggestedWeight" DECIMAL(10,3),
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressionRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseChangeLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT,
    "workoutTemplateId" TEXT,
    "previousExerciseId" TEXT,
    "newExerciseId" TEXT,
    "changeScope" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "Exercise_userId_normalizedName_idx" ON "Exercise"("userId", "normalizedName");

-- CreateIndex
CREATE INDEX "TrainingProgram_userId_status_idx" ON "TrainingProgram"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramWeek_programId_weekNumber_key" ON "ProgramWeek"("programId", "weekNumber");

-- CreateIndex
CREATE INDEX "WorkoutTemplate_programId_focus_idx" ON "WorkoutTemplate"("programId", "focus");

-- CreateIndex
CREATE INDEX "WorkoutExercise_workoutTemplateId_order_idx" ON "WorkoutExercise"("workoutTemplateId", "order");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_startedAt_idx" ON "WorkoutSession"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSession_userId_idempotencyKey_key" ON "WorkoutSession"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SessionExercise_sessionId_order_idx" ON "SessionExercise"("sessionId", "order");

-- CreateIndex
CREATE INDEX "ExerciseSet_sessionExerciseId_idx" ON "ExerciseSet"("sessionExerciseId");

-- CreateIndex
CREATE INDEX "ProgressionRecommendation_userId_status_idx" ON "ProgressionRecommendation"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressionRecommendation_sessionId_exerciseId_key" ON "ProgressionRecommendation"("sessionId", "exerciseId");

-- CreateIndex
CREATE INDEX "ExerciseChangeLog_userId_resourceId_changedAt_idx" ON "ExerciseChangeLog"("userId", "resourceId", "changedAt");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_primaryMuscleGroupId_fkey" FOREIGN KEY ("primaryMuscleGroupId") REFERENCES "MuscleGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseMuscle" ADD CONSTRAINT "ExerciseMuscle_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseMuscle" ADD CONSTRAINT "ExerciseMuscle_muscleGroupId_fkey" FOREIGN KEY ("muscleGroupId") REFERENCES "MuscleGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgram" ADD CONSTRAINT "TrainingProgram_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramWeek" ADD CONSTRAINT "ProgramWeek_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplate" ADD CONSTRAINT "WorkoutTemplate_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_workoutTemplateId_fkey" FOREIGN KEY ("workoutTemplateId") REFERENCES "WorkoutTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_programWeekId_fkey" FOREIGN KEY ("programWeekId") REFERENCES "ProgramWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_workoutTemplateId_fkey" FOREIGN KEY ("workoutTemplateId") REFERENCES "WorkoutTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSet" ADD CONSTRAINT "ExerciseSet_sessionExerciseId_fkey" FOREIGN KEY ("sessionExerciseId") REFERENCES "SessionExercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionRecommendation" ADD CONSTRAINT "ProgressionRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionRecommendation" ADD CONSTRAINT "ProgressionRecommendation_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionRecommendation" ADD CONSTRAINT "ProgressionRecommendation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseChangeLog" ADD CONSTRAINT "ExerciseChangeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
