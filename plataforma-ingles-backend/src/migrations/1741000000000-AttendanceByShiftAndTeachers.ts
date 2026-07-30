import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceByShiftAndTeachers1741000000000 implements MigrationInterface {
  name = 'AttendanceByShiftAndTeachers1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shift_teachers (
        id SERIAL PRIMARY KEY,
        "shiftId" int NOT NULL,
        "moodleUserId" int NOT NULL,
        "assignedByUserId" int NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_shift_teacher" UNIQUE ("shiftId", "moodleUserId"),
        CONSTRAINT "FK_shift_teacher_shift" FOREIGN KEY ("shiftId")
          REFERENCES schedule_shifts(id) ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_shift_teachers_moodleUserId"
      ON shift_teachers ("moodleUserId");
    `);

    const shiftIdCol = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'attendance_sessions' AND column_name = 'shiftId'
    `);

    if (!shiftIdCol.length) {
      // Legacy schema: wipe incompatible rows, then reshape
      await queryRunner.query(`DELETE FROM attendance_checkins`);
      await queryRunner.query(`DELETE FROM attendance_sessions`);
      await queryRunner.query(`DROP INDEX IF EXISTS "UQ_attendance_course_date"`);

      await queryRunner.query(`
        ALTER TABLE attendance_sessions
        ADD COLUMN "shiftId" int NULL
      `);

      await queryRunner.query(`
        ALTER TABLE attendance_sessions
        ALTER COLUMN "moodleCourseId" DROP NOT NULL
      `);

      await queryRunner.query(`
        ALTER TABLE attendance_sessions
        ADD CONSTRAINT "FK_attendance_session_shift"
        FOREIGN KEY ("shiftId") REFERENCES schedule_shifts(id) ON DELETE CASCADE
      `);

      // Table is empty — safe
      await queryRunner.query(`
        ALTER TABLE attendance_sessions
        ALTER COLUMN "shiftId" SET NOT NULL
      `);

      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "UQ_attendance_shift_date"
        ON attendance_sessions ("shiftId", "sessionDate");
      `);
    } else {
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "UQ_attendance_shift_date"
        ON attendance_sessions ("shiftId", "sessionDate");
      `);
      await queryRunner.query(`DROP INDEX IF EXISTS "UQ_attendance_course_date"`);
    }

    await queryRunner.query(`
      ALTER TABLE attendance_checkins
      ADD COLUMN IF NOT EXISTS "markedByUserId" int NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attendance_checkins
      DROP COLUMN IF EXISTS "markedByUserId"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_attendance_shift_date"`);

    await queryRunner.query(`
      ALTER TABLE attendance_sessions
      DROP CONSTRAINT IF EXISTS "FK_attendance_session_shift"
    `);

    await queryRunner.query(`
      ALTER TABLE attendance_sessions
      DROP COLUMN IF EXISTS "shiftId"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE attendance_sessions ALTER COLUMN "moodleCourseId" SET NOT NULL;
      EXCEPTION WHEN others THEN
        NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_attendance_course_date"
      ON attendance_sessions ("moodleCourseId", "sessionDate");
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS shift_teachers`);
  }
}
