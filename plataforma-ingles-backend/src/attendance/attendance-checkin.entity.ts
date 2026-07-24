import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AttendanceSession } from './attendance-session.entity';

@Entity('attendance_checkins')
@Index(['sessionId', 'moodleUserId'], { unique: true })
export class AttendanceCheckIn {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  sessionId!: number;

  @ManyToOne(() => AttendanceSession, (s) => s.checkIns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session!: AttendanceSession;

  @Column({ type: 'int' })
  moodleUserId!: number;

  @CreateDateColumn({ name: 'checkedInAt' })
  checkedInAt!: Date;
}
