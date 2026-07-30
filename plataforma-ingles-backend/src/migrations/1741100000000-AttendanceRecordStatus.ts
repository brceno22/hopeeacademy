import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceRecordStatus1741100000000 implements MigrationInterface {
  name = 'AttendanceRecordStatus1741100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attendance_checkins
      ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'present'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attendance_checkins
      DROP COLUMN IF EXISTS status
    `);
  }
}
