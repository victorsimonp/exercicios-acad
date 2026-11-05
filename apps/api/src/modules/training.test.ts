import { describe, expect, test } from 'vitest';
import {
  initialWeeks,
  prescribedSets,
  progression,
  volume,
  type PerformanceSet,
} from './training.js';
import { setSchema } from './schemas.js';
const prescription = {
  sets: 3,
  min: 6,
  max: 10,
  rirMin: 1,
  rirMax: 2,
  increment: 1,
  percent: 2.5,
  deload: false,
};
const work = (patch: Partial<PerformanceSet> = {}): PerformanceSet => ({
  setType: 'work',
  completed: true,
  actualReps: 10,
  weight: 40,
  rir: 2,
  techniqueOk: true,
  weightBasis: 'total',
  ...patch,
});
describe('periodização e progressão', () => {
  test('alterna A e B nas oito semanas', () =>
    expect(initialWeeks().map((w) => w.focus)).toEqual([
      'A',
      'B',
      'A',
      'B',
      'A',
      'B',
      'A',
      'B',
    ]));
  test('semanas 1 e 2 prescrevem duas séries, independentemente do alvo', () => {
    for (const w of initialWeeks().slice(0, 2))
      expect(prescribedSets(5, w)).toBe(2);
  });
  test('semanas 3 a 7 respeitam o alvo individual', () => {
    for (const w of initialWeeks().slice(2, 7))
      expect(prescribedSets(3, w)).toBe(3);
  });
  test('semana 8 é deload com menos volume e 3–4 RIR', () => {
    const w = initialWeeks()[7];
    expect(w.isDeload).toBe(true);
    expect([w.rirMin, w.rirMax]).toEqual([3, 4]);
    expect(prescribedSets(3, w)).toBe(1);
  });
  test('sugere incremento apenas ao atingir todas as metas', () =>
    expect(
      progression([work(), work(), work()], prescription).suggestedWeight,
    ).toBe(41));
  test.each([
    [work(), work(), work({ actualReps: 9 })],
    [work(), work(), work({ completed: false })],
    [work(), work()],
    [work(), work(), work({ rir: 0 })],
    [work(), work(), work({ rir: 3 })],
    [work(), work(), work({ techniqueOk: false })],
    [work(), work(), work({ weight: 42 })],
    [work(), work(), work({ weightBasis: 'per_side' })],
  ])(
    'não aumenta com meta não atingida, técnica ruim ou dados incompletos: %j',
    (...sets) =>
      expect(progression(sets, prescription).suggestedWeight).toBe(40),
  );
  test('não aumenta no deload', () =>
    expect(
      progression([work(), work(), work()], { ...prescription, deload: true })
        .suggestedWeight,
    ).toBe(40));
  test('desempenho abaixo do mínimo informa manter ou reduzir', () =>
    expect(
      progression([work({ actualReps: 4 }), work(), work()], prescription)
        .reason,
    ).toContain('reduza'));
  test('sem histórico não inventa carga', () =>
    expect(progression([], prescription).suggestedWeight).toBeNull());
  test('volume exclui preparatórias e séries incompletas; distingue base por halter', () => {
    expect(
      volume([
        work(),
        work({ setType: 'warmup' }),
        work({ setType: 'feeder' }),
        work({ completed: false }),
        work({ weightBasis: 'per_dumbbell' }),
      ]),
    ).toBe(1200);
  });
  test('RIR é informado, inteiro e limitado a 0–10; concluir exige carga e reps', () => {
    const d = {
      weight: 0,
      actualReps: 10,
      rir: 2,
      completed: true,
      weightBasis: 'total',
      revision: 0,
    };
    expect(setSchema.safeParse(d).success).toBe(true);
    for (const rir of [-1, 11, 1.5])
      expect(setSchema.safeParse({ ...d, rir }).success).toBe(false);
    expect(setSchema.safeParse({ ...d, weight: null }).success).toBe(false);
    expect(setSchema.safeParse({ ...d, actualReps: null }).success).toBe(false);
  });
});
