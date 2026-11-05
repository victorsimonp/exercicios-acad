-- AlterTable
ALTER TABLE "SessionExercise" ADD COLUMN     "muscleParticipationSnapshot" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "WorkoutSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workoutTemplateId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "previousDates" JSONB NOT NULL DEFAULT '[]',
    "sessionId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "WorkoutSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSchedule_sessionId_key" ON "WorkoutSchedule"("sessionId");

-- CreateIndex
CREATE INDEX "WorkoutSchedule_userId_scheduledDate_idx" ON "WorkoutSchedule"("userId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "WorkoutSchedule" ADD CONSTRAINT "WorkoutSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSchedule" ADD CONSTRAINT "WorkoutSchedule_workoutTemplateId_fkey" FOREIGN KEY ("workoutTemplateId") REFERENCES "WorkoutTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSchedule" ADD CONSTRAINT "WorkoutSchedule_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
