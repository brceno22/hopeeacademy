import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('microlearning_content')
export class MicrolearningContent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 50 })
  type!: string; // 'vocabulary' | 'phrasal_verb' | 'audio'

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'text', nullable: true })
  translation!: string;

  @Column({ type: 'varchar', nullable: true })
  audioUrl!: string;

  // Usamos 'date' para que Postgres guarde solo YYYY-MM-DD
  @Column({ type: 'date' })
  scheduledFor!: string; 
}