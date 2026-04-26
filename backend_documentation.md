# LMS Backend Documentation

This document provides a comprehensive overview of the `battechno-lms-api` backend. It covers the technology stack, project architecture, key modules, and the database schema.

## 1. Technology Stack

The backend is a robust RESTful API built with modern Node.js tools.

- **Runtime:** Node.js (v18+)
- **Framework:** Express.js (v4.22)
- **Database:** PostgreSQL
- **ORM:** Prisma Client (v6.0)
- **Authentication:** JSON Web Tokens (JWT) & bcrypt for password hashing
- **Validation:** Zod (for request payload validation)
- **Security & Middleware:**
  - `helmet` (HTTP header security)
  - `cors` (Cross-Origin Resource Sharing)
  - `express-rate-limit` (API rate limiting for general endpoints and auth)
  - `morgan` (HTTP request logging)

## 2. Architecture & Project Structure

The project follows a modular, domain-driven architecture. The core logic is separated into specific business domains within the `src/modules` directory.

### Directory Layout

```text
d:\LMS\backend\
├── prisma/
│   ├── schema.prisma   # Database schema definitions
│   └── seed.js         # Database seeding scripts
├── src/
│   ├── app.js          # Express app setup and middleware configuration
│   ├── server.js       # Server initialization and graceful shutdown
│   ├── config/         # Environment variables and DB configuration
│   ├── middlewares/    # Global middlewares (error handling, rate limiting, logging)
│   ├── modules/        # Domain-driven feature modules
│   ├── routes/         # Centralized routing configurations
│   ├── shared/         # Shared utilities and helpers across modules
│   └── utils/          # General utility functions
├── tests/              # Health and API tests
└── uploads/            # Static file uploads directory
```

### Server Initialization Flow
1. **`server.js`**: Validates production configuration, establishes the Prisma database connection, and starts the Express server. It also handles graceful shutdowns on `SIGINT` and `SIGTERM`.
2. **`app.js`**: Configures all Express middlewares, including Helmet, CORS, request IDs, JSON body parsing, static file serving (for uploads), and registers the main API routes (`/api/v1` and `/api/auth`).
3. **Health Checks**: Provides `/health` (basic alive check) and `/health/ready` (verifies DB connection).

## 3. Core Modules

The application logic is broken down into specific domains under `src/modules`. Each module typically handles its own routes, controllers, and services. Key modules include:

- **Users & Authentication:** `auth`, `users`, `roles`
- **Academic Setup:** `universities`, `tracks`, `micro-credentials`, `modules`, `learning-outcomes`
- **Delivery & Execution:** `cohorts`, `enrollments`, `sessions`, `attendance`
- **Assessments:** `assessments`, `submissions`, `grades`, `rubrics`
- **Quality Assurance & Risk:** `integrity-cases`, `risk-cases`, `qa-reviews`, `corrective-actions`
- **Outcomes:** `certificates`, `evidence`, `recognition-requests`
- **System:** `analytics`, `audit-logs`, `notifications`, `reports`

## 4. Database Schema Overview

The database is managed by Prisma and uses PostgreSQL. The schema (`schema.prisma`) is highly relational and models a complete Learning Management System.

### Key Data Entities

1. **Users & Organization**
   - `users`: Core user accounts (Students, Instructors, Admins).
   - `universities`: Organizational entities that students/users belong to.
   - `roles` & `permissions`: Role-Based Access Control (RBAC).

2. **Curriculum**
   - `tracks` -> `micro_credentials` -> `modules` -> `contents`
   - Hierarchical structure defining the educational programs.

3. **Delivery**
   - `cohorts`: Specific instances of a micro-credential being taught by an instructor to a group of students.
   - `enrollments`: Links students to cohorts with statuses (in-progress, passed, failed).
   - `sessions` & `attendance_records`: Scheduled classes and tracking of student presence.

4. **Assessment & Grading**
   - `assessments`: Defines quizzes, assignments, or projects within a cohort.
   - `submissions`: Student work uploaded for an assessment.
   - `grades`: Scores and feedback given by instructors.
   - `rubrics` & `rubric_criteria`: Detailed grading criteria.

5. **Compliance & Analytics**
   - `audit_logs`: Append-only trail for sensitive actions.
   - `qa_reviews` & `corrective_actions`: Quality assurance workflows.
   - `risk_cases` & `integrity_cases`: Tracking student performance risks and academic integrity issues (e.g., plagiarism).

6. **Certification**
   - `certificates`: Official records of completion with verification codes and QR codes.
   - `recognition_requests`: Workflows for university recognition of micro-credentials.
