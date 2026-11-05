import { beforeAll, afterAll, describe, expect, test } from 'vitest';
import type {
  Program,
  Session,
  ExerciseSet,
  Prescription,
  Workout,
} from '@ht/shared';
import { buildApp } from './app.js';
import { prisma } from './db.js';
import { seedCatalog } from './modules/seed.js';
import { cleanupUser } from './testing/cleanup-user.js';
const app = buildApp('http://localhost:5173');
const users: string[] = [];
let cookie = '';
let otherCookie = '';
let p: Program;
let s: Session;
const request = async (
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: object,
  auth = cookie,
) =>
  app.inject({
    method,
    url: `/api/v1${url}`,
    payload,
    headers: auth ? { cookie: auth } : {},
  });
const body = (e: Prescription) => ({
  exerciseId: e.exerciseId,
  order: e.order,
  targetSets: e.targetSets,
  minReps: e.minReps,
  maxReps: e.maxReps,
  targetRirMin: e.targetRirMin,
  targetRirMax: e.targetRirMax,
  restSeconds: e.restSeconds,
  restMaxSeconds: e.restMaxSeconds,
  notes: e.notes,
});
beforeAll(async () => {
  await seedCatalog();
  await app.ready();
  for (let i = 0; i < 2; i++) {
    const r = await request(
      'POST',
      '/auth/register',
      {
        name: 'Teste automatizado',
        email: `test-${crypto.randomUUID()}@example.invalid`,
        password: 'Senha-Teste-12345',
      },
      '',
    );
    expect(r.statusCode).toBe(201);
    users.push(r.json().id);
    const c = (r.headers['set-cookie'] as string).split(';')[0];
    if (i === 0) cookie = c;
    else otherCookie = c;
  }
  p = (await request('GET', '/programs')).json<Program[]>()[0];
}, 30000);
afterAll(async () => {
  // Remove only users created by this run and their data, preserving real profiles.
  for (const userId of users)
    await prisma.$transaction((tx) => cleanupUser(tx, userId));
  await app.close();
  await prisma.$disconnect();
}, 30000);
describe.sequential('API com PostgreSQL real', () => {
  test('agenda, reagenda, vincula a sessão e preserva as datas anteriores', async () => {
    const w = p.workouts[0];
    const created = await request('POST', '/schedules', {
      workoutTemplateId: w.id,
      scheduledDate: '2026-11-01T03:00:00.000Z',
    });
    expect(created.statusCode).toBe(201);
    const scheduleId = created.json().id;
    expect(
      (
        await request(
          'PATCH',
          `/schedules/${scheduleId}`,
          { notes: 'indevido' },
          otherCookie,
        )
      ).statusCode,
    ).toBe(404);
    const moved = await request('PATCH', `/schedules/${scheduleId}`, {
      scheduledDate: '2026-11-04T03:00:00.000Z',
    });
    expect(moved.statusCode).toBe(200);
    expect(moved.json().previousDates).toHaveLength(1);
    const started = await request('POST', '/sessions', {
      workoutTemplateId: w.id,
      weekNumber: 1,
      idempotencyKey: crypto.randomUUID(),
      scheduleId,
    });
    expect(started.statusCode).toBe(201);
    const session = started.json<Session>();
    const set = session.exercises[0].sets.find((a) => a.setType === 'work')!;
    expect(
      (
        await request('PATCH', `/sessions/${session.id}/sets/${set.id}`, {
          weight: 0,
          actualReps: 10,
          rir: 2,
          completed: true,
          weightBasis: 'total',
          revision: 0,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await request('POST', `/sessions/${session.id}/complete`)).statusCode,
    ).toBe(200);
    const schedules = (await request('GET', '/schedules')).json();
    expect(schedules[0].status).toBe('completed');
    expect(
      (
        await request('PATCH', `/schedules/${scheduleId}`, {
          scheduledDate: '2026-11-05T03:00:00.000Z',
        })
      ).statusCode,
    ).toBe(409);
  });
  test('metadados secundários são ponderados e preservados após edição', async () => {
    const created = await request('POST', '/exercises', {
      name: 'Supino reto halter (personalizado)',
      primaryMuscleGroupId: 'muscle-0',
      secondaryMuscles: [{ muscleGroupId: 'muscle-5', emphasis: 0.5 }],
      weightBasis: 'per_dumbbell',
    });
    expect(created.statusCode).toBe(201);
    const e = created.json();
    const w = p.workouts[2];
    const item = await request('POST', `/workouts/${w.id}/exercises`, {
      ...body(w.exercises[0]),
      exerciseId: e.id,
    });
    expect(item.statusCode).toBe(201);
    const result = await request('POST', '/sessions', {
      workoutTemplateId: w.id,
      weekNumber: 3,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(result.statusCode).toBe(201);
    const session = result.json<Session>();
    const last = session.exercises.at(-1)!;
    const set = last.sets.find((s) => s.setType === 'work')!;
    await request('PATCH', `/sessions/${session.id}/sets/${set.id}`, {
      weight: 0,
      actualReps: 10,
      rir: 2,
      completed: true,
      weightBasis: 'per_dumbbell',
      revision: 0,
    });
    await request('POST', `/sessions/${session.id}/complete`);
    expect(
      (await request('GET', '/analytics/dashboard')).json().muscleVolume[
        'Tríceps'
      ].secondary,
    ).toBe(0.5);
    expect(
      (
        await request('PATCH', `/exercises/${e.id}`, {
          name: e.name,
          primaryMuscleGroupId: 'muscle-0',
          secondaryMuscles: [],
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await request('GET', '/analytics/dashboard')).json().muscleVolume[
        'Tríceps'
      ].secondary,
    ).toBe(0.5);
    await request('DELETE', `/workouts/${w.id}/exercises/${item.json().id}`);
  });
  test('autenticação e autorização por proprietário', async () => {
    expect((await request('GET', '/programs', undefined, '')).statusCode).toBe(
      401,
    );
    expect(
      (await request('GET', `/programs/${p.id}`, undefined, otherCookie))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await request(
          'GET',
          `/workouts/${p.workouts[0].id}`,
          undefined,
          otherCookie,
        )
      ).statusCode,
    ).toBe(404);
  });
  test('seed contém oito fichas e 32 exercícios, sem cargas fictícias', async () => {
    expect(p.workouts).toHaveLength(8);
    expect(p.workouts.every((w) => w.exercises.length === 4)).toBe(true);
    const catalog = (await request('GET', '/exercises')).json();
    expect(catalog.total).toBeGreaterThanOrEqual(32);
    expect(p.workouts[0].exercises[0].exercise.name).toBe(
      'Supino inclinado smith banco 30°',
    );
  });
  test('iniciar sessão é idempotente e aplica duas séries na semana 1', async () => {
    const input = {
      workoutTemplateId: p.workouts[0].id,
      weekNumber: 1,
      idempotencyKey: crypto.randomUUID(),
    };
    const r = await request('POST', '/sessions', input);
    expect(r.statusCode).toBe(201);
    s = r.json<Session>();
    expect(s.exercises[0].prescribedSetsSnapshot).toBe(2);
    expect(s.exercises[0].sets.every((a) => a.weight === null)).toBe(true);
    expect((await request('POST', '/sessions', input)).json().id).toBe(s.id);
    expect(
      (await request('GET', `/sessions/${s.id}`, undefined, otherCookie))
        .statusCode,
    ).toBe(404);
  });
  test('registra carga/reps/RIR, persiste após nova leitura e protege revisões', async () => {
    const set = s.exercises[0].sets.find((a) => a.setType === 'work')!;
    const d = {
      weight: 40,
      actualReps: 10,
      rir: 2,
      completed: true,
      weightBasis: 'total',
      revision: 0,
    };
    const r = await request('PATCH', `/sessions/${s.id}/sets/${set.id}`, d);
    expect(r.statusCode).toBe(200);
    expect(
      (await request('PATCH', `/sessions/${s.id}/sets/${set.id}`, d))
        .statusCode,
    ).toBe(409);
    s = (await request('GET', `/sessions/${s.id}`)).json<Session>();
    expect(s.exercises[0].sets.find((a) => a.id === set.id)?.weight).toBe('40');
    expect(
      (
        await request('PATCH', `/sessions/${s.id}/sets/${set.id}`, {
          ...d,
          rir: 11,
          revision: 1,
        })
      ).statusCode,
    ).toBe(400);
  });
  test('substituição e edição do modelo preservam a sessão iniciada', async () => {
    const e = p.workouts[0].exercises[0];
    const replacement = p.workouts[1].exercises[0];
    expect(
      (
        await request(
          'PATCH',
          `/workouts/${p.workouts[0].id}/exercises/${e.id}`,
          { ...body(e), exerciseId: replacement.exerciseId, targetSets: 4 },
        )
      ).statusCode,
    ).toBe(200);
    const existing = (
      await request('GET', `/sessions/${s.id}`)
    ).json<Session>();
    expect(existing.exercises[0].exerciseNameSnapshot).toBe(e.exercise.name);
    expect(existing.exercises[0].prescribedSetsSnapshot).toBe(2);
  });
  test('adiciona, reordena e remove exercício sem perder histórico', async () => {
    const w = p.workouts[0];
    const r = await request(
      'POST',
      `/workouts/${w.id}/exercises`,
      body(w.exercises[1]),
    );
    expect(r.statusCode).toBe(201);
    const updated = (await request('GET', `/workouts/${w.id}`)).json<Workout>();
    const ids = updated.exercises.map((e) => e.id).reverse();
    const ordered = await request('PATCH', `/workouts/${w.id}/reorder`, {
      ids,
    });
    expect(ordered.statusCode).toBe(200);
    expect(ordered.json<Workout>().exercises[0].id).toBe(ids[0]);
    expect(
      (
        await request('PATCH', `/workouts/${w.id}/reorder`, {
          ids: [ids[0], ids[0]],
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await request('DELETE', `/workouts/${w.id}/exercises/${r.json().id}`))
        .statusCode,
    ).toBe(200);
    expect(
      (await request('GET', `/sessions/${s.id}`)).json<Session>().exercises,
    ).toHaveLength(4);
  });
  test('edição futura não modifica modelo e edição de sessão não modifica ficha', async () => {
    const w = p.workouts[1];
    const e = w.exercises[0];
    expect(
      (
        await request('PATCH', `/workouts/${w.id}/exercises/${e.id}`, {
          ...body(e),
          targetSets: 5,
          scope: 'future',
        })
      ).statusCode,
    ).toBe(200);
    const updated = (await request('GET', `/workouts/${w.id}`)).json<Workout>();
    expect(updated.exercises[0].targetSets).toBe(3);
    expect(updated.exercises[0].futureOverride?.targetSets).toBe(5);
    const created = await request('POST', '/sessions', {
      workoutTemplateId: w.id,
      weekNumber: 3,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(created.statusCode).toBe(201);
    const session = created.json<Session>();
    expect(session.exercises[0].prescribedSetsSnapshot).toBe(5);
    const se = session.exercises[1];
    expect(
      (
        await request('PATCH', `/sessions/${session.id}/exercises/${se.id}`, {
          ...body(w.exercises[1]),
          targetSets: 1,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await request('GET', `/workouts/${w.id}`)).json<Workout>().exercises[1]
        .targetSets,
    ).toBe(3);
  });
  test('finaliza, calcula volume e não recomenda aumento com séries incompletas', async () => {
    const r = await request('POST', `/sessions/${s.id}/complete`);
    expect(r.statusCode).toBe(200);
    s = r.json<Session>();
    expect(s.status).toBe('completed');
    expect(s.recommendations[0].reason).toContain('incompletas');
    expect(
      (await request('POST', `/sessions/${s.id}/complete`)).statusCode,
    ).toBe(200);
    expect((await request('GET', '/analytics/dashboard')).json().volume).toBe(
      400,
    );
    expect(
      (await request('PATCH', `/sessions/${s.id}`, { status: 'active' }))
        .statusCode,
    ).toBe(409);
  });
  test('corrige resultados com auditoria e recalcula volume/recomendações', async () => {
    const set = s.exercises[0].sets.find((a) => a.completed)!;
    const r = await request('PATCH', `/sessions/${s.id}/sets/${set.id}`, {
      weight: 42,
      actualReps: 9,
      rir: 1,
      completed: true,
      weightBasis: 'total',
      revision: set.revision,
      notes: 'Correção',
    });
    expect(r.statusCode).toBe(200);
    expect(r.json<ExerciseSet>().revision).toBe(2);
    expect((await request('GET', `/audit/${set.id}`)).json().length).toBe(2);
    expect((await request('GET', '/analytics/dashboard')).json().volume).toBe(
      378,
    );
  });
  test('deload, mudanças de periodização e histórico preservado', async () => {
    const w = p.workouts.find((w) => w.focus === 'B')!;
    const r = await request('POST', '/sessions', {
      workoutTemplateId: w.id,
      weekNumber: 8,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(r.statusCode).toBe(201);
    const d = r.json<Session>();
    expect(d.isDeloadSnapshot).toBe(true);
    expect(d.exercises[0].prescribedSetsSnapshot).toBe(1);
    expect(d.exercises[0].targetRirMinSnapshot).toBe(3);
    const weeks = p.weeks.map((w) => ({
      ...w,
      focus: w.weekNumber === 1 ? 'B' : w.focus,
    }));
    expect(
      (
        await request('PATCH', `/periodization/${p.id}`, {
          totalWeeks: 8,
          weeks,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await request('GET', `/sessions/${s.id}`)).json<Session>().focusSnapshot,
    ).toBe('A');
  });
  test('origem não autorizada é bloqueada; documentação disponível', async () => {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/auth/logout',
          headers: { origin: 'https://invalid.example', cookie },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ method: 'GET', url: '/docs/json' })).statusCode,
    ).toBe(200);
  });
});
