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

@Entity('shift_teachers')
@Unique(['shiftId', 'moodleUserId'])
@Index(['moodleUserId'])
export class ShiftTeacher {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  shiftId!: number;

  @ManyToOne(() => ScheduleShift, (s) => s.teachers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shiftId' })
  shift!: ScheduleShift;

  @Column({ type: 'int' })
  moodleUserId!: number;

  @Column({ type: 'int', nullable: true })
  assignedByUserId!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
