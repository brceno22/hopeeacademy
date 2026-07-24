import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CourseFolder } from '../courses/entities/course-folder.entity';

@Entity('class_recordings')
@Index(['folderId', 'sortOrder'])
export class ClassRecording {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  folderId!: number;

  @ManyToOne(() => CourseFolder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'folderId' })
  folder!: CourseFolder;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  driveUrl!: string;

  /** Fecha de la clase grabada (YYYY-MM-DD), opcional */
  @Column({ type: 'date', nullable: true })
  recordedAt!: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
