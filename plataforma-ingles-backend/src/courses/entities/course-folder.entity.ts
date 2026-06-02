import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CourseFolderLink } from './course-folder-link.entity';

/** Carpeta virtual: solo organiza cursos Moodle (no reemplaza el curso). */
@Entity('course_folders')
export class CourseFolder {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', nullable: true })
  parentId!: number | null;

  @ManyToOne(() => CourseFolder, (folder) => folder.children, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent?: CourseFolder;

  @OneToMany(() => CourseFolder, (folder) => folder.parent)
  children!: CourseFolder[];

  @OneToMany(() => CourseFolderLink, (link) => link.folder)
  courseLinks!: CourseFolderLink[];

  @Column()
  name!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  slug!: string | null;

  @Column({ default: 0 })
  sortOrder!: number;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
