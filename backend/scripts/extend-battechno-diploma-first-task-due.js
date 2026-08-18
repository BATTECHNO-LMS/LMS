'use strict';

/**
 * Idempotent: extend due date of the first task on الدبلوم التشغيلي الرقمي
 * to 18 Aug 2026 23:59 Asia/Amman (11:59 PM).
 *
 * First task = earliest created_at on BATTECHNO-DIGITAL-OPERATIONAL-DIPLOMA.
 * Run: npm run seed:battechno-diploma-extend-first-task
 * Dry: node scripts/extend-battechno-diploma-first-task-due.js --dry-run
 */

const COURSE_CODE = 'BATTECHNO-DIGITAL-OPERATIONAL-DIPLOMA';
const TIMEZONE = 'Asia/Amman';
/** Wall-clock deadline in the course timezone. */
const DUE_LOCAL_ISO = '2026-08-18T23:59:00';
/** Asia/Amman is UTC+3 year-round (DST abolished). */
const DUE_OFFSET = '+03:00';

class SeedConflictError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SeedConflictError';
    this.details = details;
  }
}

function dueAtDate() {
  const due = new Date(`${DUE_LOCAL_ISO}${DUE_OFFSET}`);
  if (Number.isNaN(due.getTime())) {
    throw new SeedConflictError('Invalid due datetime.', { DUE_LOCAL_ISO, DUE_OFFSET });
  }
  return due;
}

function selectFirstTask(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;
  return [...tasks].sort((a, b) => {
    const createdA = new Date(a.created_at).getTime();
    const createdB = new Date(b.created_at).getTime();
    if (createdA !== createdB) return createdA - createdB;
    return String(a.id || '').localeCompare(String(b.id || ''));
  })[0];
}

function summarizeTask(task) {
  if (!task) return null;
  return {
    id: task.id,
    title: task.title,
    dueAt: task.due_at || null,
    createdAt: task.created_at || null,
    publishedAt: task.published_at || null,
  };
}

function isDryRun(argv = process.argv) {
  return argv.includes('--dry-run');
}

async function extendFirstTaskDue({ prisma, dryRun = false } = {}) {
  if (!prisma) throw new SeedConflictError('prisma client is required.');

  const courseRows = await prisma.training_programs.findMany({
    where: { code: COURSE_CODE },
    select: {
      id: true,
      code: true,
      title: true,
      organization_id: true,
      settings_json: true,
    },
  });
  if (courseRows.length > 1) {
    throw new SeedConflictError(`Multiple courses share code ${COURSE_CODE}.`, {
      ids: courseRows.map((r) => r.id),
    });
  }
  if (!courseRows.length) {
    throw new SeedConflictError(
      `Course ${COURSE_CODE} not found. Run npm run seed:battechno-diploma first.`
    );
  }
  const course = courseRows[0];

  const org = await prisma.organizations.findUnique({
    where: { id: course.organization_id },
    select: { id: true, code: true, type: true, name: true },
  });
  if (!org || org.code !== 'BATTECHNO' || org.type !== 'INSTITUTION') {
    throw new SeedConflictError('Course is not linked to BATTECHNO INSTITUTION.', {
      organization: org,
      courseId: course.id,
    });
  }

  const tasks = await prisma.training_tasks.findMany({
    where: { program_id: course.id },
    select: {
      id: true,
      title: true,
      due_at: true,
      created_at: true,
      published_at: true,
    },
  });
  const first = selectFirstTask(tasks);
  if (!first) {
    throw new SeedConflictError('No tasks found on الدبلوم التشغيلي الرقمي.', {
      courseId: course.id,
    });
  }

  const nextDueAt = dueAtDate();
  const unchanged =
    first.due_at instanceof Date && first.due_at.getTime() === nextDueAt.getTime();

  let updated = first;
  if (!dryRun && !unchanged) {
    updated = await prisma.training_tasks.update({
      where: { id: first.id },
      data: { due_at: nextDueAt, updated_at: new Date() },
      select: {
        id: true,
        title: true,
        due_at: true,
        created_at: true,
        published_at: true,
      },
    });
  }

  return {
    ok: true,
    dryRun: Boolean(dryRun),
    unchanged,
    timezone: TIMEZONE,
    dueLocal: `${DUE_LOCAL_ISO}${DUE_OFFSET}`,
    dueAt: (dryRun ? nextDueAt : updated.due_at).toISOString(),
    organization: { id: org.id, code: org.code, name: org.name },
    course: { id: course.id, code: course.code, title: course.title },
    taskCount: tasks.length,
    firstTaskBefore: summarizeTask(first),
    firstTaskAfter: summarizeTask(dryRun ? { ...first, due_at: nextDueAt } : updated),
    otherTasks: tasks
      .filter((t) => t.id !== first.id)
      .map((t) => summarizeTask(t)),
  };
}

async function main() {
  const { prisma } = require('../src/config/db');
  try {
    const report = await extendFirstTaskDue({ prisma, dryRun: isDryRun() });
    console.log(JSON.stringify(report, null, 2));
  } catch (err) {
    console.error(
      err instanceof SeedConflictError
        ? JSON.stringify({ ok: false, conflict: true, message: err.message, details: err.details }, null, 2)
        : err
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = {
  COURSE_CODE,
  TIMEZONE,
  DUE_LOCAL_ISO,
  DUE_OFFSET,
  SeedConflictError,
  dueAtDate,
  selectFirstTask,
  summarizeTask,
  isDryRun,
  extendFirstTaskDue,
};

if (require.main === module) {
  main();
}
