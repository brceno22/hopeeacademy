import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Convierte el límite de intentos por examen en un invariante de base de datos.
 * Sin el índice único, dos submits concurrentes leen el mismo conteo previo y
 * ambos insertan, superando maxAttempts.
 */
export class AttemptNumberUnique1743000000000 implements MigrationInterface {
  name = 'AttemptNumberUnique1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attempts
      ADD COLUMN IF NOT EXISTS "attemptNumber" integer
    `);

    await queryRunner.query(`
      UPDATE attempts AS a
      SET "attemptNumber" = ordered.rn
      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY "examId", "userId"
            ORDER BY "finishedAt", id
          ) AS rn
        FROM attempts
      ) AS ordered
      WHERE a.id = ordered.id
    `);

    await queryRunner.query(`
      ALTER TABLE attempts
      ALTER COLUMN "attemptNumber" SET NOT NULL
    `);

    // El prefijo (examId, userId) de este índice cubre además el filtro más
    // frecuente de la tabla, que hasta ahora hacía sequential scan.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_attempts_exam_user_number"
      ON attempts ("examId", "userId", "attemptNumber")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_attempts_exam_user_number"`);
    await queryRunner.query(`ALTER TABLE attempts DROP COLUMN IF EXISTS "attemptNumber"`);
  }
}
