# API Reference

Base URL: `http://localhost:4000` (development)

## Conventions

| Item | Value |
|------|-------|
| Auth prefix | `/api/auth` |
| Versioned API | `/api/v1` (configurable via `API_VERSION`) |
| Auth header | `Authorization: Bearer <jwt>` |
| Content-Type | `application/json` |
| Validation | Zod schemas return 400 with field errors |

### Response format

Success:

```json
{
  "success": true,
  "data": { }
}
```

Error:

```json
{
  "success": false,
  "message": "Human-readable error"
}
```

Paginated lists include `meta` with `page`, `limit`, `total`, `totalPages`.

## Health endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | Service info |
| GET | `/health` | No | Liveness check |
| GET | `/health/ready` | No | DB connectivity check |

## Authentication (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/register/universities` | No | List universities open for registration |
| POST | `/register` | No | Student self-registration |
| POST | `/login` | No | Login, returns JWT |
| GET | `/me` | Yes | Current user profile |
| POST | `/logout` | No | Client-side logout ack |

Rate limited separately (`AUTH_RATE_LIMIT_MAX`, default 30/window).

## Users (`/api/v1/users`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/` | ADMIN_READ |
| POST | `/activate-pending` | USER_ACTIVATE |
| GET | `/:id` | ADMIN_READ |
| POST | `/` | USER_WRITE |
| PUT | `/:id` | USER_WRITE |
| PATCH | `/:id/status` | USER_WRITE |
| PATCH | `/:id/activate` | USER_ACTIVATE |

## Universities (`/api/v1/universities`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/` | ADMIN_READ |
| GET | `/:id` | ADMIN_READ |
| POST | `/` | UNIVERSITY_WRITE |
| PUT | `/:id` | UNIVERSITY_WRITE |

## Curriculum

### Tracks (`/api/v1/tracks`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/` | CURRICULUM_READ |
| GET | `/:id` | CURRICULUM_READ |
| POST | `/` | CURRICULUM_WRITE |
| PUT | `/:id` | CURRICULUM_WRITE |

### Micro-credentials (`/api/v1/micro-credentials`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/` | CURRICULUM_READ |
| POST | `/` | CURRICULUM_WRITE |
| GET | `/:id` | CURRICULUM_READ |
| PUT | `/:id` | CURRICULUM_WRITE |
| PATCH | `/:id/status` | CURRICULUM_WRITE |
| GET | `/:microCredentialId/learning-outcomes` | CURRICULUM_READ |
| POST | `/:microCredentialId/learning-outcomes` | CURRICULUM_WRITE |

### Learning outcomes (`/api/v1/learning-outcomes`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/:id` | CURRICULUM_READ |
| PUT | `/:id` | CURRICULUM_WRITE |
| DELETE | `/:id` | CURRICULUM_WRITE |

### Modules (`/api/v1/modules`)

> Stub — router mounted but no endpoints yet.

## Delivery

### Cohorts (`/api/v1/cohorts`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/` | DELIVERY_READ |
| POST | `/` | DELIVERY_WRITE |
| GET | `/:id` | DELIVERY_READ |
| PUT | `/:id` | DELIVERY_WRITE |
| PATCH | `/:id/status` | DELIVERY_WRITE |
| GET | `/:id/enrollments` | DELIVERY_READ |
| POST | `/:id/enrollments` | DELIVERY_WRITE |
| GET | `/:id/sessions` | DELIVERY_READ |
| POST | `/:id/sessions` | DELIVERY_WRITE |
| GET | `/:id/attendance-summary` | DELIVERY_READ |

### Student aggregate (`/api/v1/student`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/available-cohorts` | student |
| POST | `/request-enrollment` | student |
| GET | `/semester-schedule` | student |

### Enrollments (`/api/v1/enrollments`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/me` | student |
| GET | `/pending` | ENROLLMENT_DECISION |
| POST | `/request` | student |
| GET | `/:id` | DELIVERY_READ / scoped |
| PATCH | `/:id/approve` | ENROLLMENT_DECISION |
| PATCH | `/:id/reject` | ENROLLMENT_DECISION |
| PATCH | `/:id/status` | DELIVERY_WRITE |

### Sessions (`/api/v1/sessions`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/me` | student / instructor |
| GET | `/:id` | DELIVERY_READ |
| PUT | `/:id` | DELIVERY_WRITE |
| GET | `/:id/attendance` | DELIVERY_READ |
| POST | `/:id/attendance` | DELIVERY_WRITE |
| PATCH | `/:id/documentation-status` | DELIVERY_WRITE |

### Attendance records (`/api/v1/attendance-records`)

| Method | Path | Roles |
|--------|------|-------|
| PUT | `/:id` | DELIVERY_WRITE |

## Assessment and grading

### Assessments (`/api/v1/assessments`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/` | ACADEMIC_READ |
| POST | `/` | ACADEMIC_WRITE |
| GET | `/:id` | ACADEMIC_READ |
| PUT | `/:id` | ACADEMIC_WRITE |
| PATCH | `/:id/status` | ACADEMIC_WRITE |
| GET | `/:id/submissions` | ACADEMIC_READ |
| POST | `/:id/submissions` | student (scoped) |
| GET | `/:id/grades` | ACADEMIC_READ |
| POST | `/:id/grades` | ACADEMIC_WRITE |

### Rubrics (`/api/v1/rubrics`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/` | ACADEMIC_READ |
| POST | `/` | ACADEMIC_WRITE |
| GET | `/:id` | ACADEMIC_READ |
| PUT | `/:id` | ACADEMIC_WRITE |
| GET | `/:id/criteria` | ACADEMIC_READ |
| POST | `/:id/criteria` | ACADEMIC_WRITE |

### Rubric criteria (`/api/v1/rubric-criteria`)

| Method | Path | Roles |
|--------|------|-------|
| PUT | `/:id` | ACADEMIC_WRITE |
| DELETE | `/:id` | ACADEMIC_WRITE |

### Submissions (`/api/v1/submissions`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/` | ACADEMIC_READ |
| GET | `/:id` | ACADEMIC_READ |
| PUT | `/:id` | ACADEMIC_WRITE |

### Grades (`/api/v1/grades`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/` | ACADEMIC_READ |
| GET | `/:id` | ACADEMIC_READ |
| PUT | `/:id` | ACADEMIC_WRITE |
| PATCH | `/:id/finalize` | ACADEMIC_WRITE |

### Students (`/api/v1/students`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/:studentId/submissions` | ACADEMIC_READ |
| GET | `/:studentId/grades` | ACADEMIC_READ |

## Quality assurance and governance

### Evidence (`/api/v1/evidence`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/` | EVIDENCE_READ |
| POST | `/` | EVIDENCE_WRITE |
| GET | `/:id` | EVIDENCE_READ |
| PUT | `/:id` | EVIDENCE_WRITE |

### QA reviews (`/api/v1/qa-reviews`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/` | QA_OVERSIGHT |
| POST | `/` | QA_OVERSIGHT |
| GET | `/:id` | QA_OVERSIGHT |
| PUT | `/:id` | QA_OVERSIGHT |
| PATCH | `/:id/status` | QA_OVERSIGHT |

### Corrective actions (`/api/v1/corrective-actions`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/` | QA_OVERSIGHT |
| POST | `/` | QA_OVERSIGHT |
| GET | `/:id` | QA_OVERSIGHT |
| PUT | `/:id` | QA_OVERSIGHT |
| PATCH | `/:id/status` | QA_OVERSIGHT |

### Risk cases (`/api/v1/risk-cases`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/` | RISK_INTEGRITY |
| POST | `/` | RISK_INTEGRITY |
| GET | `/:id` | RISK_INTEGRITY |
| PUT | `/:id` | RISK_INTEGRITY |
| PATCH | `/:id/status` | RISK_INTEGRITY |

### Integrity cases (`/api/v1/integrity-cases`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/` | RISK_INTEGRITY |
| POST | `/` | RISK_INTEGRITY |
| GET | `/:id` | RISK_INTEGRITY |
| PUT | `/:id` | RISK_INTEGRITY |
| PATCH | `/:id/status` | RISK_INTEGRITY |

## Recognition and certificates

### Recognition requests (`/api/v1/recognition-requests`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/` | RECOGNITION_READ |
| POST | `/` | RECOGNITION_WRITE |
| GET | `/:id` | RECOGNITION_READ |
| PUT | `/:id` | RECOGNITION_WRITE |
| PATCH | `/:id/status` | RECOGNITION_WRITE |
| GET | `/:id/documents` | RECOGNITION_READ |
| POST | `/:id/documents` | RECOGNITION_WRITE |

### Recognition documents (`/api/v1/recognition-documents`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/:id` | RECOGNITION_READ |
| PUT | `/:id` | RECOGNITION_WRITE |
| DELETE | `/:id` | RECOGNITION_WRITE |

### Certificates (`/api/v1/certificates`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/verify/:verificationCode` | **Public** |
| GET | `/` | CERTIFICATE_READ |
| POST | `/` | CERTIFICATE_WRITE |
| GET | `/:id` | CERTIFICATE_READ |
| PATCH | `/:id/status` | CERTIFICATE_WRITE |

## System

### Notifications (`/api/v1/notifications`)

| Method | Path | Auth |
|--------|------|------|
| GET | `/` | Yes |
| PATCH | `/read-all` | Yes |
| GET | `/:id` | Yes |
| PATCH | `/:id/read` | Yes |

### Analytics (`/api/v1/analytics`) — super_admin only

| Method | Path |
|--------|------|
| GET | `/overview` |
| GET | `/universities` |
| GET | `/enrollments` |
| GET | `/cohorts` |
| GET | `/assessments` |
| GET | `/attendance` |
| GET | `/evidence` |
| GET | `/qa-integrity` |
| GET | `/recognition` |
| GET | `/certificates` |

### Reports (`/api/v1/reports`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/universities` | REPORT_READ |
| GET | `/cohorts` | REPORT_READ |
| GET | `/attendance` | REPORT_READ |
| GET | `/assessments` | REPORT_READ |
| GET | `/recognition` | REPORT_READ |
| GET | `/certificates` | REPORT_READ |
| GET | `/:type/export` | REPORT_READ |

### Audit logs (`/api/v1/audit-logs`)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/` | AUDIT_LOG_READ |
| GET | `/:id` | AUDIT_LOG_READ |

## Standalone courses — super_admin only

### Admin courses (`/api/v1/admin/courses`)

Full CRUD for courses, sections, lessons, training configuration, YouTube playlist preview, publish/archive, and cover image upload.

### Student courses (`/api/v1/student/courses`) — student

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List enrolled courses |
| GET | `/:id` | Course detail |
| GET | `/:id/progress` | Progress summary |
| POST | `/:id/start` | Start course |
| POST | `/:courseId/lessons/:lessonId/complete` | Mark lesson complete |
| * | Training workflow endpoints | Lesson training submissions |

## Field training

### Admin (`/api/v1/admin/field-training`) — super_admin

Opportunities CRUD, application review, tasks CRUD, submissions list.

### Student (`/api/v1/student/field-training`) — student

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Browse opportunities |
| GET | `/:id` | Opportunity detail |
| POST | `/:id/apply` | Submit application |
| GET | `/my-applications` | Own applications |
| PATCH | `/applications/:applicationId/cancel` | Cancel application |
| GET | `/:id/tasks` | Tasks for opportunity |
| POST | `/tasks/:taskId/submit` | Submit task work |

## Static files

| Path | Description |
|------|-------------|
| `/uploads/*` | Locally stored uploads (`UPLOAD_DIR`) |

When `STORAGE_BACKEND=s3`, file URLs use `S3_PUBLIC_BASE_URL`.

## Rate limiting

| Scope | Default |
|-------|---------|
| General API (`/api/v1`) | 300 requests / 15 min |
| Auth (`/api/auth`) | 30 requests / 15 min |

Configurable via `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`.

## Frontend endpoint map

The frontend mirrors these paths in `frontend/src/services/endpoints.js`.

## Roles reference

Role gate names (e.g. `ADMIN_READ`, `CURRICULUM_WRITE`) map to env-configurable role code lists. See [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md).
