import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CourseFolder } from '../courses/entities/course-folder.entity';
import { ShiftEnrollment } from './shift-enrollment.entity';
import { ShiftTeacher } from './shift-teacher.entity';
import { CalendarEvent } from './calendar-event.entity';

@Entity('schedule_shifts')
export class ScheduleShift {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'int' })
  folderId!: number;

  @ManyToOne(() => CourseFolder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'folderId' })
  folder!: CourseFolder;

  /** Curso Moodle opcional (ej. Meetings) para validar rol profesor */
  @Column({ type: 'int', nullable: true })
  moodleCourseId!: number | null;

  /** 0=domingo … 6=sábado */
  @Column({ type: 'simple-json' })
  daysOfWeek!: number[];

  @Column({ type: 'varchar', length: 5 })
  startTime!: string; // HH:mm

  @Column({ type: 'varchar', length: 5 })
  endTime!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  meetUrl!: string | null;

  @Column({ type: 'date', nullable: true })
  validFrom!: string | null;

  @Column({ type: 'date', nullable: true })
  validTo!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => ShiftEnrollment, (e) => e.shift)
  enrollments!: ShiftEnrollment[];

  @OneToMany(() => ShiftTeacher, (t) => t.shift)
  teachers!: ShiftTeacher[];

  @OneToMany(() => CalendarEvent, (e) => e.shift)
  events!: CalendarEvent[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
