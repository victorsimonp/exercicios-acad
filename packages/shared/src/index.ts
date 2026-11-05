export type HealthResponse = { status: 'ok' };
export type User = {
  id: string;
  name: string;
  email: string;
  settings: {
    theme?: 'dark' | 'light';
    warmupSets?: number;
    feederSets?: number;
  };
};
export type Muscle = { id: string; name: string };
export type Exercise = {
  id: string;
  name: string;
  primaryMuscleGroupId: string;
  primaryMuscle: Muscle;
  region: string;
  equipment: string;
  movementType: string;
  laterality: string;
  instructions: string;
  source: string;
  userId: string | null;
  increment: string;
  incrementPercent: string;
  weightBasis: string;
  isActive: boolean;
  muscles?: { muscleGroupId: string; role: string; emphasis: number }[];
  _count?: { prescriptions: number };
};
export type Prescription = {
  id: string;
  exerciseId: string;
  exercise: Exercise;
  order: number;
  targetSets: number;
  minReps: number;
  maxReps: number;
  targetRirMin: number;
  targetRirMax: number;
  restSeconds: number;
  restMaxSeconds: number;
  notes: string;
  futureOverride?: Omit<
    Prescription,
    'exercise' | 'id' | 'futureOverride'
  > | null;
};
export type Workout = {
  id: string;
  programId: string;
  focus: string;
  dayNumber: number;
  name: string;
  description: string;
  exercises: Prescription[];
};
export type Week = {
  id: string;
  weekNumber: number;
  focus: string;
  isDeload: boolean;
  rirMin: number;
  rirMax: number;
  volumeRule: string;
  setsOverride: number | null;
};
export type Program = {
  id: string;
  name: string;
  description: string;
  totalWeeks: number;
  startDate: string;
  status: string;
  weeks: Week[];
  workouts: Workout[];
};
export type ExerciseSet = {
  skipped?: boolean;
  completedAt?: string | null;
  id: string;
  setNumber: number;
  setType: string;
  prescribedRepsMin: number;
  prescribedRepsMax: number;
  actualReps: number | null;
  weight: string | null;
  weightBasis: string;
  rir: number | null;
  completed: boolean;
  techniqueOk: boolean;
  notes: string;
  revision: number;
};
export type SessionExercise = {
  id: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  muscleSnapshot: string;
  weightBasisSnapshot: string;
  order: number;
  prescribedSetsSnapshot: number;
  minRepsSnapshot: number;
  maxRepsSnapshot: number;
  targetRirMinSnapshot: number;
  targetRirMaxSnapshot: number;
  restSecondsSnapshot: number;
  notes: string;
  sets: ExerciseSet[];
};
export type Recommendation = {
  id: string;
  exerciseId: string;
  currentWeight: string | null;
  suggestedWeight: string | null;
  reason: string;
  status: string;
  exercise?: Exercise;
};
export type Session = {
  workoutTemplateId: string;
  programId: string;
  id: string;
  nameSnapshot: string;
  focusSnapshot: string;
  weekNumberSnapshot: number;
  isDeloadSnapshot: boolean;
  startedAt: string;
  completedAt: string | null;
  status: string;
  notes: string;
  restEndsAt: string | null;
  exercises: SessionExercise[];
  recommendations: Recommendation[];
};
export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
export type Analytics = {
  completed: number;
  weeklyCompleted: number;
  weeklySets: number;
  totalSets: number;
  volume: number;
  averageMinutes: number;
  adherencePercent: number | null;
  muscleVolume: Record<string, { direct: number; secondary: number }>;
  points: {
    date: string;
    weight: number;
    weightBasis: string;
    reps: number;
    rir: number | null;
    volume: number;
    name: string;
  }[];
  records: {
    name: string;
    weight: number;
    basis: string;
    reps: number;
    date: string;
  }[];
  attendance: {
    date: string;
    focus: string;
    name: string;
    sessionId: string;
  }[];
  bySession: { date: string; volume: number; focus: string }[];
  secondaryNote: string;
};
export type Schedule = {
  id: string;
  workoutTemplateId: string;
  workout: Workout;
  scheduledDate: string;
  status: string;
  sessionId: string | null;
  previousDates: string[];
  notes: string;
};
