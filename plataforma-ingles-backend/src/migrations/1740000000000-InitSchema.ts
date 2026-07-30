import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Snapshot inicial + constraints de hardening.
 * Usa IF NOT EXISTS / ADD COLUMN IF NOT EXISTS para DBs que ya tenían synchronize.
 */
export class InitSchema1740000000000 implements MigrationInterface {
  name = 'InitSchema1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS course_folders (
        id SERIAL PRIMARY KEY,
        "parentId" int NULL,
        name varchar NOT NULL,
        slug varchar(120) NULL,
        "sortOrder" int NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_course_folders_parent" FOREIGN KEY ("parentId")
          REFERENCES course_folders(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS course_folder_links (
        id SERIAL PRIMARY KEY,
        "folderId" int NOT NULL,
        "moodleCourseId" int NOT NULL,
        "sortOrder" int NOT NULL DEFAULT 0,
        CONSTRAINT "UQ_folder_moodle" UNIQUE ("folderId", "moodleCourseId"),
        CONSTRAINT "FK_links_folder" FOREIGN KEY ("folderId")
          REFERENCES course_folders(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exams (
        id SERIAL PRIMARY KEY,
        "courseId" int NOT NULL,
        title varchar NOT NULL,
        description varchar NULL,
        active boolean NOT NULL DEFAULT true,
        "maxAttempts" int NOT NULL DEFAULT 3,
        "passThreshold" int NOT NULL DEFAULT 60,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`ALTER TABLE exams ADD COLUMN IF NOT EXISTS "maxAttempts" int NOT NULL DEFAULT 3`);
    await queryRunner.query(`ALTER TABLE exams ADD COLUMN IF NOT EXISTS "passThreshold" int NOT NULL DEFAULT 60`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        text varchar NOT NULL,
        "order" int NOT NULL DEFAULT 1,
        "examId" int NULL,
        CONSTRAINT "FK_questions_exam" FOREIGN KEY ("examId")
          REFERENCES exams(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS options (
        id SERIAL PRIMARY KEY,
        text varchar NOT NULL,
        "isCorrect" boolean NOT NULL DEFAULT false,
        "questionId" int NULL,
        CONSTRAINT "FK_options_question" FOREIGN KEY ("questionId")
          REFERENCES questions(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS attempts (
        id SERIAL PRIMARY KEY,
        "examId" int NOT NULL,
        "userId" int NOT NULL,
        score float NOT NULL DEFAULT 0,
        answers jsonb NOT NULL,
        "finishedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id SERIAL PRIMARY KEY,
        "userId" int NOT NULL,
        "courseId" int NOT NULL,
        "moduleId" int NOT NULL,
        type varchar(50) NOT NULL,
        "completedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_progress_user_course_module"
      ON user_progress ("userId", "courseId", "moduleId");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS microlearning_content (
        id SERIAL PRIMARY KEY,
        title varchar(255) NOT NULL,
        type varchar(50) NOT NULL,
        content text NOT NULL,
        translation text NULL,
        "audioUrl" varchar NULL,
        "scheduledFor" date NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_microlearning_history (
        id SERIAL PRIMARY KEY,
        "userId" int NOT NULL,
        "contentId" int NOT NULL,
        "viewedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_micro_history_user_content"
      ON user_microlearning_history ("userId", "contentId");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_streak (
        id SERIAL PRIMARY KEY,
        "userId" int NOT NULL UNIQUE,
        "currentStreak" int NOT NULL DEFAULT 0,
        "lastActiveDate" date NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS schedule_shifts (
        id SERIAL PRIMARY KEY,
        name varchar(120) NOT NULL,
        "folderId" int NOT NULL,
        "moodleCourseId" int NULL,
        "daysOfWeek" text NOT NULL,
        "startTime" varchar(5) NOT NULL,
        "endTime" varchar(5) NOT NULL,
        title varchar(255) NOT NULL,
        description text NULL,
        "meetUrl" text NULL,
        "validFrom" date NULL,
        "validTo" date NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_shift_folder" FOREIGN KEY ("folderId")
          REFERENCES course_folders(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS shift_enrollments (
        id SERIAL PRIMARY KEY,
        "shiftId" int NOT NULL,
        "moodleUserId" int NOT NULL,
        "assignedByUserId" int NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_shift_user" UNIQUE ("shiftId", "moodleUserId"),
        CONSTRAINT "FK_enroll_shift" FOREIGN KEY ("shiftId")
          REFERENCES schedule_shifts(id) ON DELETE CASCADE
      );
    `);

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

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS attendance_sessions (
        id SERIAL PRIMARY KEY,
        "shiftId" int NOT NULL,
        "moodleCourseId" int NULL,
        "sessionDate" date NOT NULL,
        title varchar(255) NULL,
        status varchar(20) NOT NULL DEFAULT 'closed',
        "openedByUserId" int NULL,
        "openedAt" TIMESTAMPTZ NULL,
        "closedAt" TIMESTAMPTZ NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_attendance_session_shift" FOREIGN KEY ("shiftId")
          REFERENCES schedule_shifts(id) ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_attendance_shift_date"
      ON attendance_sessions ("shiftId", "sessionDate");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS attendance_checkins (
        id SERIAL PRIMARY KEY,
        "sessionId" int NOT NULL,
        "moodleUserId" int NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'present',
        "markedByUserId" int NULL,
        "checkedInAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_checkin_session" FOREIGN KEY ("sessionId")
          REFERENCES attendance_sessions(id) ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_checkin_session_user"
      ON attendance_checkins ("sessionId", "moodleUserId");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id SERIAL PRIMARY KEY,
        title varchar(255) NOT NULL,
        description text NULL,
        "meetUrl" text NULL,
        "startsAt" TIMESTAMPTZ NOT NULL,
        "endsAt" TIMESTAMPTZ NOT NULL,
        "shiftId" int NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_event_shift" FOREIGN KEY ("shiftId")
          REFERENCES schedule_shifts(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS class_recordings (
        id SERIAL PRIMARY KEY,
        "folderId" int NOT NULL,
        title varchar(255) NOT NULL,
        "driveUrl" text NOT NULL,
        "recordedAt" date NULL,
        "sortOrder" int NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_recording_folder" FOREIGN KEY ("folderId")
          REFERENCES course_folders(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_profile_prefs (
        "moodleUserId" int PRIMARY KEY,
        "avatarColor" varchar(7) NOT NULL DEFAULT '#0071BC',
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_profile_prefs`);
    await queryRunner.query(`DROP TABLE IF EXISTS class_recordings`);
    await queryRunner.query(`DROP TABLE IF EXISTS calendar_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS attendance_checkins`);
    await queryRunner.query(`DROP TABLE IF EXISTS attendance_sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS shift_teachers`);
    await queryRunner.query(`DROP TABLE IF EXISTS shift_enrollments`);
    await queryRunner.query(`DROP TABLE IF EXISTS schedule_shifts`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_streak`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_microlearning_history`);
    await queryRunner.query(`DROP TABLE IF EXISTS microlearning_content`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_progress`);
    await queryRunner.query(`DROP TABLE IF EXISTS attempts`);
    await queryRunner.query(`DROP TABLE IF EXISTS options`);
    await queryRunner.query(`DROP TABLE IF EXISTS questions`);
    await queryRunner.query(`DROP TABLE IF EXISTS exams`);
    await queryRunner.query(`DROP TABLE IF EXISTS course_folder_links`);
    await queryRunner.query(`DROP TABLE IF EXISTS course_folders`);
  }
}
