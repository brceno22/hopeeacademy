import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('user_progress')
export class UserProgress {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  userId!: number;

  @Column({ type: 'int' })
  courseId!: number;

  @Column({ type: 'int' })
  moduleId!: number;

  @Column({ type: 'varchar', length: 50 })
  type!: string; // 'manual' | 'auto'

  @CreateDateColumn()
  completedAt!: Date;
}