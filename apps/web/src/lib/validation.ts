import { hasValidSetResults } from '@ht/shared';
import { z } from 'zod';
export const draftSchema = z
  .object({
    weight: z
      .number()
      .finite()
      .min(0, 'A carga não pode ser negativa.')
      .max(2000)
      .nullable(),
    actualReps: z
      .number()
      .int('Repetições devem ser inteiras.')
      .min(0)
      .max(200)
      .nullable(),
    rir: z
      .number()
      .int('RIR deve ser inteiro.')
      .min(0, 'RIR deve ser de 0 a 10.')
      .max(10, 'RIR deve ser de 0 a 10.')
      .nullable(),
    completed: z.boolean(),
    techniqueOk: z.boolean(),
    notes: z.string().max(2000),
    weightBasis: z.enum(['total', 'per_side', 'per_dumbbell']),
    revision: z.number().int().min(0),
  })
  .refine(
    (d) => !d.completed || hasValidSetResults(d),
    'Informe carga, repetições e RIR antes de concluir a série.',
  );
