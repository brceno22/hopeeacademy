import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** MC/TF → optionId; gap_fill → { blankIndex: word } */
export type AttemptAnswerValue = number | Record<string, string>;

@Entity('attempts')
export class Attempt {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  examId!: number;

  @Column()
  userId!: number; // ID del usuario en Moodle

  @Column({ type: 'float', default: 0 })
  score!: number; // porcentaje 0-100

  @Column({ type: 'jsonb' })
  answers!: Record<string, AttemptAnswerValue>;

  @CreateDateColumn()
  finishedAt!: Date;
}
