import { readFileSync } from 'node:fs';
import { prisma } from '../db.js';
import { initialWeeks, normalize } from './training.js';

type Row = {
  name: string;
  targetSets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
  restMaxSeconds: number;
};
// Copied by the build script alongside the compiled module.
const rows = JSON.parse(
  readFileSync(new URL('./initial-exercises.json', import.meta.url), 'utf8'),
) as Row[];
export const muscles = [
  'Peitoral',
  'Costas',
  'Trapézio',
  'Ombros',
  'Bíceps',
  'Tríceps',
  'Quadríceps',
  'Isquiotibiais',
  'Glúteo máximo',
  'Glúteo médio',
  'Adutores',
  'Panturrilhas',
  'Tibial anterior',
];
const groups = [
  0, 0, 5, 5, 1, 1, 4, 4, 6, 6, 7, 11, 3, 3, 0, 1, 0, 0, 5, 5, 1, 1, 4, 4, 8, 7,
  6, 11, 3, 3, 0, 1,
];
export async function seedCatalog() {
  await prisma.$transaction(async (tx) => {
    for (const [i, name] of muscles.entries())
      await tx.muscleGroup.upsert({
        where: { id: `muscle-${i}` },
        create: { id: `muscle-${i}`, name },
        update: {},
      });
    for (const [i, row] of rows.entries()) {
      const name = normalize(row.name);
      await tx.exercise.upsert({
        where: { id: `initial-${i + 1}` },
        update: {},
        create: {
          id: `initial-${i + 1}`,
          name: row.name,
          normalizedName: name,
          primaryMuscleGroupId: `muscle-${groups[i]}`,
          source: 'prompt',
          equipment: name.includes('halter')
            ? 'Halter'
            : name.includes('polia') ||
                name.includes('pulley') ||
                name.includes('cross')
              ? 'Polia'
              : name.includes('barra')
                ? 'Barra'
                : 'Máquina',
          movementType:
            /crucifixo|rosca|triceps|elevacao lateral|elevacao frontal|panturrilha|extensora|flexora/.test(
              name,
            )
              ? 'isolation'
              : 'compound',
          weightBasis: name.includes('halter') ? 'per_dumbbell' : 'total',
        },
      });
    }
  });
}
export async function createInitialProgram(userId: string) {
  const names = [
    'Peito e Tríceps',
    'Costas e Bíceps',
    'Pernas completas',
    'Ombros, Peito e Costas',
  ];
  const descriptions = [
    'Peitoral clavicular e tríceps',
    'Espessura dorsal e flexores do cotovelo',
    'Ênfase em quadríceps',
    'Deltoides lateral e posterior',
    'Peitoral médio/inferior e tríceps',
    'Largura dorsal e bíceps',
    'Ênfase em glúteos e cadeia posterior',
    'Deltoide anterior e largura dorsal',
  ];
  return prisma.trainingProgram.create({
    data: {
      userId,
      name: 'Hipertrofia • Ciclo 01',
      description: 'Programa inicial A/B • 4 dias por semana',
      startDate: new Date(),
      weeks: { create: initialWeeks() },
      workouts: {
        create: Array.from({ length: 8 }, (_, day) => ({
          focus: day < 4 ? 'A' : 'B',
          dayNumber: (day % 4) + 1,
          name: names[day % 4],
          description: descriptions[day],
          exercises: {
            create: rows.slice(day * 4, day * 4 + 4).map((r, i) => ({
              exerciseId: `initial-${day * 4 + i + 1}`,
              order: i,
              targetSets: r.targetSets,
              minReps: r.minReps,
              maxReps: r.maxReps,
              restSeconds: r.restSeconds,
              restMaxSeconds: r.restMaxSeconds,
            })),
          },
        })),
      },
    },
  });
}
