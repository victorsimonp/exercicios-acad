import { z } from 'zod';
export const idParams = z.object({
  id: z.string().min(1),
  itemId: z.string().optional(),
  setId: z.string().optional(),
});
export const prescription = z
  .object({
    exerciseId: z.string().min(1),
    order: z.number().int().min(0).max(100).default(0),
    targetSets: z.number().int().min(1).max(20),
    minReps: z.number().int().min(1).max(100),
    maxReps: z.number().int().min(1).max(100),
    targetRirMin: z.number().int().min(0).max(10).default(1),
    targetRirMax: z.number().int().min(0).max(10).default(2),
    restSeconds: z.number().int().min(0).max(900),
    restMaxSeconds: z.number().int().min(0).max(900).default(120),
    notes: z.string().max(2000).default(''),
  })
  .refine(
    (d) =>
      d.minReps <= d.maxReps &&
      d.targetRirMin <= d.targetRirMax &&
      d.restSeconds <= d.restMaxSeconds,
    'Limites mínimos devem ser menores ou iguais aos máximos.',
  );
export const exerciseSchema = z.object({
  name: z.string().trim().min(2).max(200),
  primaryMuscleGroupId: z.string(),
  region: z.string().max(100).default(''),
  equipment: z.string().max(100).default(''),
  movementType: z.enum(['compound', 'isolation']).default('compound'),
  laterality: z.enum(['bilateral', 'unilateral']).default('bilateral'),
  instructions: z.string().max(4000).default(''),
  increment: z.coerce.number().min(0.001).max(100).default(1),
  incrementPercent: z.coerce.number().min(1).max(10).default(2.5),
  weightBasis: z.enum(['total', 'per_side', 'per_dumbbell']).default('total'),
  isActive: z.boolean().default(true),
  secondaryMuscles: z
    .array(
      z.object({
        muscleGroupId: z.string(),
        emphasis: z.number().min(0).max(1),
      }),
    )
    .max(50)
    .optional(),
});
export const setSchema = z
  .object({
    weight: z.number().min(0).max(2000).nullable(),
    actualReps: z.number().int().min(0).max(200).nullable(),
    rir: z.number().int().min(0).max(10).nullable(),
    completed: z.boolean(),
    techniqueOk: z.boolean().default(true),
    notes: z.string().max(2000).default(''),
    weightBasis: z.enum(['total', 'per_side', 'per_dumbbell']),
    revision: z.number().int().min(0),
  })
  .refine(
    (d) =>
      !d.completed ||
      (d.weight !== null &&
        d.actualReps !== null &&
        d.actualReps > 0 &&
        d.rir !== null),
    'Informe carga, repetições e RIR antes de concluir.',
  );
export const pagination = z.object({
  programId: z.string().optional(),
  weekNumber: z.coerce.number().int().min(1).max(52).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().default(''),
  muscle: z.string().optional(),
  focus: z.enum(['A', 'B']).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  exerciseId: z.string().optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
});
