import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { CourseFolder } from './course-folder.entity';

/** Asigna un curso Moodle (creado en Moodle) a una carpeta de la plataforma. */
@Entity('course_folder_links')
@Unique(['folderId', 'moodleCourseId'])
export class CourseFolderLink {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  folderId!: number;

  @ManyToOne(() => CourseFolder, (folder) => folder.courseLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'folderId' })
  folder!: CourseFolder;

  @Column({ type: 'int' })
  moodleCourseId!: number;

  @Column({ default: 0 })
  sortOrder!: number;
}
