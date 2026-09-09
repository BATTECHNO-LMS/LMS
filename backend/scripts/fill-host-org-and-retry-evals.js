'use strict';

/**
 * Fill BATTECHNO host-organization defaults on opportunities that lack them,
 * re-apply the Tafila official template, then generate remaining eligible evals.
 *
 * Usage:
 *   node scripts/fill-host-org-and-retry-evals.js --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const evalService = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');

const APPLY = process.argv.includes('--apply');
const TAFILA_TEMPLATE_ID = 'ae4cc146-63a9-4378-98e9-8ad9a949dff1';
const HOST_DEFAULTS = {
  organization_name: 'شركة الرجل الوطواط للتكنولوجيا',
  department: 'قسم تكنولوجيا المعلومات',
  email: 'it@battechno.com',
  phone: '0798040280',
  fax: '',
  address:
    'المملكة الاردنية الهاشمية - عمان - شارع المدينة المنورة -  مجمع الباسم2 - الطابق الرابع مكتب 405',
  field_supervisor_name: 'عاصم القيسي',
  field_supervisor_email: 'a.alqeisi@battechno.com',
  field_supervisor_phone: '0791433341',
};

function log(message) {
  process.stderr.write(`[${new Date().toISOString()}] ${message}\n`);
}

function isRetryable(err) {
  const code = String(err?.code || '');
  const msg = String(err?.message || err || '');
  return (
    code === 'P1017' ||
    code === 'P1001' ||
    code === 'P1002' ||
    /closed the connection|Connection reset/i.test(msg)
  );
}

async function withRetry(label, fn, tries = 5) {
  let last;
  for (let i = 1; i <= tries; i += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      log(`${label} failed (${i}/${tries}): ${err?.code || ''} ${err?.message || err}`);
      if (!isRetryable(err) || i === tries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000 * i));
    }
  }
  throw last;
}

async function findSuperAdminUser() {
  const rows = await prisma.$queryRaw`
    SELECT u.id, u.full_name, u.email
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  if (!rows[0]) throw new Error('No active super_admin');
  return {
    userId: rows[0].id,
    fullName: rows[0].full_name,
    email: rows[0].email,
    roles: ['super_admin'],
    isGlobal: true,
    universityId: null,
  };
}

async function remainingEligibleWithoutEval(opportunityId) {
  const apps = await prisma.field_training_applications.findMany({
    where: {
      opportunity_id: opportunityId,
      status: 'approved',
      completion_eligibility_status: 'eligible',
      expelled_at: null,
      training_status: { not: 'expelled' },
    },
    select: { id: true },
  });
  const evals = apps.length
    ? await prisma.field_training_final_evaluations.findMany({
        where: { application_id: { in: apps.map((a) => a.id) }, is_current: true },
        select: { application_id: true, filled_docx_file_id: true },
      })
    : [];
  const hasEval = new Set(evals.filter((e) => e.filled_docx_file_id).map((e) => e.application_id));
  return apps.filter((a) => !hasEval.has(a.id)).map((a) => a.id);
}

async function main() {
  const user = await findSuperAdminUser();
  const opps = await prisma.field_training_opportunities.findMany({
    orderBy: { created_at: 'asc' },
    select: {
      id: true,
      title: true,
      organization_name: true,
      host_organization: true,
      evaluation_template_id: true,
    },
  });

  const hostUpdates = [];
  const templateUpdates = [];
  const evals = [];

  for (const opp of opps) {
    const host = opp.host_organization && typeof opp.host_organization === 'object' ? opp.host_organization : {};
    const needsHost =
      !opp.organization_name ||
      !host.department ||
      !host.email ||
      !host.phone ||
      !host.address ||
      !host.field_supervisor_name;
    if (needsHost) {
      hostUpdates.push({ id: opp.id, title: opp.title, before: { organization_name: opp.organization_name, host } });
      if (APPLY) {
        await evalService.saveOpportunityReportDefaults(user, opp.id, HOST_DEFAULTS);
      }
    }
    if (opp.evaluation_template_id !== TAFILA_TEMPLATE_ID) {
      templateUpdates.push({ id: opp.id, title: opp.title, from: opp.evaluation_template_id });
      if (APPLY) {
        await evalService.assignOpportunityTemplate(user, opp.id, TAFILA_TEMPLATE_ID);
      }
    }
  }

  if (APPLY) {
    for (const opp of opps) {
      const ids = await remainingEligibleWithoutEval(opp.id);
      log(`${opp.title}: remaining evals ${ids.length}`);
      const results = [];
      for (let i = 0; i < ids.length; i += 8) {
        const batch = ids.slice(i, i + 8);
        const out = await withRetry(`generate ${opp.id} ${i + 1}-${i + batch.length}`, () =>
          evalService.generateForApplications(user, batch, { regenerate: false, finalize: true })
        );
        results.push(...(out.results || []));
        log(`[eval] ${opp.id} ${Math.min(i + batch.length, ids.length)}/${ids.length}`);
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      evals.push({
        id: opp.id,
        title: opp.title,
        remaining: ids.length,
        generated: results.filter((r) => r.generated).length,
        reused: results.filter((r) => r.reused).length,
        failed: results.filter((r) => !r.generated && !r.reused).length,
        errors: results
          .filter((r) => !r.generated && !r.reused)
          .slice(0, 8)
          .map((r) => ({ name: r.studentName, code: r.code, missing: r.missingFields })),
      });
    }
  }

  const after = await prisma.field_training_opportunities.findMany({
    select: { id: true, title: true, organization_name: true, evaluation_template_id: true, host_organization: true },
  });
  const report = {
    apply: APPLY,
    hostUpdates: hostUpdates.map((row) => ({ id: row.id, title: row.title })),
    templateUpdates,
    after: after.map((o) => ({
      title: o.title,
      organization_name: o.organization_name,
      template: o.evaluation_template_id,
      isTafilaTemplate: o.evaluation_template_id === TAFILA_TEMPLATE_ID,
      host: o.host_organization,
    })),
    evals,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!APPLY) log('Dry-run only. Re-run with --apply.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
