import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** MC/TF → optionId; gap_fill → { blankIndex: word } */
export type AttemptAnswerValue = number | Record<string, string>;

@Entity('attempts')
@Index('UQ_attempts_exam_user_number', ['examId', 'userId', 'attemptNumber'], { unique: true })
export class Attempt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  examId!: number;

  @Column()
  userId!: number; // ID del usuario en Moodle

  /** 1-based. El índice único impide superar maxAttempts en submits concurrentes. */
  @Column()
  attemptNumber!: number;

  @Column({ type: 'float', default: 0 })
  score!: number; // porcentaje 0-100

  @Column({ type: 'jsonb' })
  answers!: Record<string, AttemptAnswerValue>;

  @CreateDateColumn()
  finishedAt!: Date;
}
