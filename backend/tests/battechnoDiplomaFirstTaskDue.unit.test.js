'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  COURSE_CODE,
  TIMEZONE,
  DUE_LOCAL_ISO,
  DUE_OFFSET,
  dueAtDate,
  selectFirstTask,
  summarizeTask,
  isDryRun,
  extendFirstTaskDue,
  SeedConflictError,
} = require('../scripts/extend-battechno-diploma-first-task-due');

describe('BATTECHNO diploma first-task due extension', () => {
  it('targets the digital operational diploma at 18 Aug 2026 23:59 Asia/Amman', () => {
    assert.equal(COURSE_CODE, 'BATTECHNO-DIGITAL-OPERATIONAL-DIPLOMA');
    assert.equal(TIMEZONE, 'Asia/Amman');
    assert.equal(DUE_LOCAL_ISO, '2026-08-18T23:59:00');
    const due = dueAtDate();
    assert.equal(due.toISOString(), '2026-08-18T20:59:00.000Z');
    assert.equal(`${DUE_LOCAL_ISO}${DUE_OFFSET}`, '2026-08-18T23:59:00+03:00');
  });

  it('selects the earliest created task as the first task', () => {
    const first = selectFirstTask([
      { id: 'b', title: 'الثانية', created_at: '2026-08-10T10:00:00.000Z' },
      { id: 'a', title: 'الأولى', created_at: '2026-08-03T08:00:00.000Z' },
      { id: 'c', title: 'الثالثة', created_at: '2026-08-12T12:00:00.000Z' },
    ]);
    assert.equal(first.id, 'a');
    assert.equal(first.title, 'الأولى');
    assert.equal(selectFirstTask([]), null);
  });

  it('breaks created_at ties by id and summarizes without dropping the title', () => {
    const first = selectFirstTask([
      { id: 'z', title: 'لاحق', created_at: '2026-08-03T08:00:00.000Z' },
      { id: 'a', title: 'أسبق بالمعرّف', created_at: '2026-08-03T08:00:00.000Z' },
    ]);
    assert.equal(first.id, 'a');
    assert.deepEqual(summarizeTask(first), {
      id: 'a',
      title: 'أسبق بالمعرّف',
      dueAt: null,
      createdAt: '2026-08-03T08:00:00.000Z',
      publishedAt: null,
    });
  });

  it('detects --dry-run from argv', () => {
    assert.equal(isDryRun(['node', 'script.js']), false);
    assert.equal(isDryRun(['node', 'script.js', '--dry-run']), true);
  });

  it('updates only the first task due_at and leaves other tasks unchanged', async () => {
    const due = dueAtDate();
    const calls = { update: [] };
    const prisma = {
      training_programs: {
        findMany: async () => [
          {
            id: 'course-1',
            code: COURSE_CODE,
            title: 'الدبلوم التشغيلي الرقمي',
            organization_id: 'org-1',
            settings_json: { timezone: TIMEZONE },
          },
        ],
      },
      organizations: {
        findUnique: async () => ({
          id: 'org-1',
          code: 'BATTECHNO',
          type: 'INSTITUTION',
          name: 'BATTECHNO',
        }),
      },
      training_tasks: {
        findMany: async () => [
          {
            id: 'task-2',
            title: 'المهمة الثانية',
            due_at: new Date('2026-09-01T20:59:00.000Z'),
            created_at: new Date('2026-08-10T00:00:00.000Z'),
            published_at: new Date('2026-08-10T00:00:00.000Z'),
          },
          {
            id: 'task-1',
            title: 'المهمة الأولى',
            due_at: new Date('2026-08-10T20:59:00.000Z'),
            created_at: new Date('2026-08-03T00:00:00.000Z'),
            published_at: new Date('2026-08-03T00:00:00.000Z'),
          },
        ],
        update: async ({ where, data }) => {
          calls.update.push({ where, data });
          return {
            id: where.id,
            title: 'المهمة الأولى',
            due_at: data.due_at,
            created_at: new Date('2026-08-03T00:00:00.000Z'),
            published_at: new Date('2026-08-03T00:00:00.000Z'),
          };
        },
      },
    };

    const report = await extendFirstTaskDue({ prisma, dryRun: false });
    assert.equal(report.ok, true);
    assert.equal(report.taskCount, 2);
    assert.equal(report.firstTaskBefore.id, 'task-1');
    assert.equal(report.firstTaskAfter.dueAt.toISOString(), due.toISOString());
    assert.equal(calls.update.length, 1);
    assert.equal(calls.update[0].where.id, 'task-1');
    assert.equal(calls.update[0].data.due_at.toISOString(), due.toISOString());
    assert.equal(report.otherTasks.length, 1);
    assert.equal(report.otherTasks[0].id, 'task-2');
  });

  it('dry-run does not write and missing course is a conflict', async () => {
    const prisma = {
      training_programs: { findMany: async () => [] },
      organizations: { findUnique: async () => null },
      training_tasks: {
        findMany: async () => [],
        update: async () => {
          throw new Error('update must not run');
        },
      },
    };
    await assert.rejects(
      () => extendFirstTaskDue({ prisma, dryRun: true }),
      (err) => err instanceof SeedConflictError && /not found/.test(err.message)
    );
  });
});
