import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExamQuestionTypesMedia1742000000000 implements MigrationInterface {
  name = 'ExamQuestionTypesMedia1742000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE questions
        ADD COLUMN IF NOT EXISTS type varchar(32) NOT NULL DEFAULT 'multiple_choice',
        ADD COLUMN IF NOT EXISTS "imageUrl" text NULL,
        ADD COLUMN IF NOT EXISTS "audioUrl" text NULL,
        ADD COLUMN IF NOT EXISTS "wordBank" jsonb NULL,
        ADD COLUMN IF NOT EXISTS "correctBlanks" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE questions
        DROP COLUMN IF EXISTS "correctBlanks",
        DROP COLUMN IF EXISTS "wordBank",
        DROP COLUMN IF EXISTS "audioUrl",
        DROP COLUMN IF EXISTS "imageUrl",
        DROP COLUMN IF EXISTS type
    `);
  }
}
