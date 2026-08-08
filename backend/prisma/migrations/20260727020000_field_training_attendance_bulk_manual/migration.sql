-- AlterEnum: add bulk_manual attendance method for mark-all-present
ALTER TYPE "field_training_attendance_method" ADD VALUE IF NOT EXISTS 'bulk_manual';
