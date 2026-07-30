import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { Question } from './question.entity';


@Entity('exams')
export class Exam {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  courseId!: number; // ID del curso en Moodle

  @Column()
  title!: string;

  @Column({ nullable: true })
  description!: string;

  @Column({ default: true })
  active!: boolean;

  /** Máximo de intentos por alumno (default 3). */
  @Column({ type: 'int', default: 3 })
  maxAttempts!: number;

  /** Umbral de aprobación 0–100 (default 60). */
  @Column({ type: 'int', default: 60 })
  passThreshold!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => Question, q => q.exam, { cascade: true, eager: true })
  questions!: Question[];
}