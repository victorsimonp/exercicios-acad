export function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
export function initialWeeks(total = 8) {
  return Array.from({ length: total }, (_, i) => ({
    weekNumber: i + 1,
    focus: i % 2 === 0 ? 'A' : 'B',
    isDeload: i === total - 1,
    rirMin: i === total - 1 ? 3 : 1,
    rirMax: i === total - 1 ? 4 : 2,
    volumeRule: i < 2 ? 'fixed' : i === total - 1 ? 'deload' : 'target',
    setsOverride: i < 2 ? 2 : i === total - 1 ? 1 : null,
  }));
}
export function prescribedSets(
  target: number,
  week: { volumeRule: string; setsOverride: number | null },
) {
  return week.volumeRule === 'target' ? target : (week.setsOverride ?? 1);
}
export type PerformanceSet = {
  setType: string;
  completed: boolean;
  actualReps: number | null;
  weight: unknown;
  rir: number | null;
  techniqueOk: boolean;
  weightBasis: string;
};
export function volume(sets: PerformanceSet[]) {
  return sets
    .filter((s) => s.completed && s.setType === 'work')
    .reduce(
      (sum, s) =>
        sum +
        Number(s.weight ?? 0) *
          (s.actualReps ?? 0) *
          (s.weightBasis === 'total' ? 1 : 2),
      0,
    );
}
export function progression(
  sets: PerformanceSet[],
  prescription: {
    sets: number;
    min: number;
    max: number;
    rirMin: number;
    rirMax: number;
    increment: number;
    percent: number;
    deload: boolean;
  },
) {
  const work = sets.filter((s) => s.setType === 'work');
  const current = work[0]?.weight == null ? null : Number(work[0].weight);
  const result = (reason: string, suggestedWeight = current) => ({
    currentWeight: current,
    suggestedWeight,
    reason,
  });
  if (prescription.deload)
    return result('Deload: priorize a recuperação; sem aumento de carga.');
  if (
    work.length !== prescription.sets ||
    work.some(
      (s) =>
        !s.completed ||
        s.weight == null ||
        s.rir == null ||
        s.actualReps == null,
    )
  )
    return result(
      'Histórico insuficiente ou séries incompletas: sem sugestão de aumento.',
    );
  if (work.some((s) => (s.actualReps ?? 0) < prescription.min))
    return result('Repetições abaixo da faixa: mantenha ou reduza a carga.');
  if (
    current === null ||
    current <= 0 ||
    work.some(
      (s) =>
        Number(s.weight) !== current || s.weightBasis !== work[0].weightBasis,
    )
  )
    return result(
      'Cargas ou bases diferentes: registre séries comparáveis antes de aumentar.',
    );
  if (
    work.every(
      (s) =>
        s.techniqueOk &&
        (s.actualReps ?? 0) >= prescription.max &&
        (s.rir ?? -1) >= prescription.rirMin &&
        (s.rir ?? 99) <= prescription.rirMax,
    )
  ) {
    const step = prescription.increment;
    const suggested =
      Math.ceil((current * (1 + prescription.percent / 100) - 1e-8) / step) *
      step;
    return result(
      'Todas as séries atingiram o topo da faixa, com RIR na meta e técnica adequada. Aumento opcional pelo incremento disponível.',
      Math.round(suggested * 1000) / 1000,
    );
  }
  return result(
    'Mantenha a carga e progrida nas repetições até atingir a meta em todas as séries.',
  );
}
