import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ScheduleShift } from './schedule-shift.entity';

@Entity('shift_enrollments')
@Unique(['shiftId', 'moodleUserId'])
@Index(['moodleUserId'])
export class ShiftEnrollment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  shiftId!: number;

  @ManyToOne(() => ScheduleShift, (s) => s.enrollments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shiftId' })
  shift!: ScheduleShift;

  @Column({ type: 'int' })
  moodleUserId!: number;

  @Column({ type: 'int', nullable: true })
  assignedByUserId!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
