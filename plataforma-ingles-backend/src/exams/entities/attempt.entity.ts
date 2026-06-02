import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

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
  answers!: Record<number, number>; // { questionId: optionId }

  @CreateDateColumn()
  finishedAt!: Date;
}