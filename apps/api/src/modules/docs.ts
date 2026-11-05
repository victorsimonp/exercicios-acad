import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exerciseSchema, prescription, setSchema } from './schemas.js';
export function documentRoutes(app: FastifyInstance) {
  app.addHook('onRoute', (options) => {
    const url = options.url.replace('/api/v1', '');
    const method = String(options.method);
    const body: Record<string, object> = {
      'POST /exercises': z.toJSONSchema(exerciseSchema),
      'PATCH /exercises/:id': z.toJSONSchema(exerciseSchema),
      'POST /workouts/:id/exercises': z.toJSONSchema(prescription),
      'PATCH /workouts/:id/exercises/:itemId': z.toJSONSchema(
        prescription.safeExtend({
          scope: z.enum(['future', 'template']).optional(),
        }),
      ),
      'PATCH /sessions/:id/exercises/:itemId': z.toJSONSchema(prescription),
      'PATCH /sessions/:id/sets/:setId': z.toJSONSchema(setSchema),
      'PATCH /workouts/:id/reorder': {
        type: 'object',
        required: ['ids'],
        properties: { ids: { type: 'array', items: { type: 'string' } } },
      },
      'POST /sessions': {
        type: 'object',
        required: ['workoutTemplateId', 'weekNumber', 'idempotencyKey'],
        properties: {
          workoutTemplateId: { type: 'string' },
          weekNumber: { type: 'integer', minimum: 1, maximum: 52 },
          idempotencyKey: { type: 'string', minLength: 8 },
          scheduleId: { type: 'string' },
        },
      },
      'POST /sessions/:id/sets': {
        type: 'object',
        required: ['sessionExerciseId', 'setType'],
        properties: {
          sessionExerciseId: { type: 'string' },
          setType: { type: 'string', enum: ['warmup', 'feeder', 'work'] },
        },
      },
      'PATCH /sessions/:id': {
        type: 'object',
        properties: {
          notes: { type: 'string' },
          status: { type: 'string', enum: ['active', 'paused'] },
          restEndsAt: {
            anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }],
          },
        },
      },
      'POST /workouts': {
        type: 'object',
        required: ['programId', 'name', 'focus', 'dayNumber'],
        properties: {
          programId: { type: 'string' },
          name: { type: 'string' },
          focus: { type: 'string', enum: ['A', 'B'] },
          dayNumber: { type: 'integer' },
          description: { type: 'string' },
        },
      },
      'PATCH /workouts/:id': {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
      },
      'PATCH /programs/:id': {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
        },
      },
      'PATCH /periodization/:programId': {
        type: 'object',
        required: ['totalWeeks'],
        properties: {
          totalWeeks: { type: 'integer', minimum: 1, maximum: 52 },
          weeks: {
            type: 'array',
            items: {
              type: 'object',
              required: [
                'weekNumber',
                'focus',
                'isDeload',
                'rirMin',
                'rirMax',
                'volumeRule',
                'setsOverride',
              ],
              properties: {
                weekNumber: { type: 'integer' },
                focus: { type: 'string', enum: ['A', 'B'] },
                isDeload: { type: 'boolean' },
                rirMin: { type: 'integer' },
                rirMax: { type: 'integer' },
                volumeRule: {
                  type: 'string',
                  enum: ['target', 'fixed', 'deload'],
                },
                setsOverride: {
                  anyOf: [{ type: 'integer' }, { type: 'null' }],
                },
              },
            },
          },
        },
      },
    };
    body['POST /schedules'] = z.toJSONSchema(
      z.object({
        workoutTemplateId: z.string(),
        scheduledDate: z.iso.datetime(),
        notes: z.string().optional(),
      }),
    );
    body['PATCH /schedules/:id'] = z.toJSONSchema(
      z.object({
        scheduledDate: z.iso.datetime().optional(),
        status: z.enum(['cancelled', 'missed']).optional(),
        notes: z.string().optional(),
      }),
    );
    body['PATCH /auth/me'] = z.toJSONSchema(
      z.object({
        name: z.string().optional(),
        settings: z
          .object({
            theme: z.enum(['dark', 'light']).optional(),
            warmupSets: z.number().int().optional(),
            feederSets: z.number().int().optional(),
          })
          .optional(),
      }),
    );
    body['POST /muscles'] = z.toJSONSchema(
      z.object({ name: z.string(), region: z.string().optional() }),
    );
    for (const action of ['accept', 'dismiss'])
      body[`POST /progression/recommendations/:id/${action}`] = z.toJSONSchema(
        z.object({ suggestedWeight: z.number().optional() }),
      );
    const schema = body[`${method} ${url}`];
    if (schema) {
      // Zod remains the runtime validator, including refinements; the JSON schema documents its shape.
      options.schema = { ...options.schema, body: schema };
    }
    if (url.startsWith('/api/') || !url.startsWith('/')) return;
    const section = url.split('/')[1];
    if (
      options.schema ||
      [
        'programs',
        'sessions',
        'workouts',
        'exercises',
        'periodization',
        'analytics',
        'progression',
        'audit',
        'muscles',
        'schedules',
      ].includes(section)
    )
      options.schema = { tags: [section], ...options.schema };
  });
}
