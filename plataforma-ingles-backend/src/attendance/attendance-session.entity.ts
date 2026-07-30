import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ScheduleShift } from '../calendar/schedule-shift.entity';
import { AttendanceCheckIn } from './attendance-checkin.entity';

export type AttendanceSessionStatus = 'open' | 'closed';

@Entity('attendance_sessions')
@Index(['shiftId', 'sessionDate'], { unique: true })
export class AttendanceSession {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  shiftId!: number;

  @ManyToOne(() => ScheduleShift, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shiftId' })
  shift!: ScheduleShift;

  /** @deprecated Prefer shiftId; kept nullable for legacy rows */
  @Column({ type: 'int', nullable: true })
  moodleCourseId!: number | null;

  /** YYYY-MM-DD (fecha de la clase) */
  @Column({ type: 'date' })
  sessionDate!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'closed' })
  status!: AttendanceSessionStatus;

  @Column({ type: 'int', nullable: true })
  openedByUserId!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  openedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @OneToMany(() => AttendanceCheckIn, (c) => c.session)
  checkIns!: AttendanceCheckIn[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
