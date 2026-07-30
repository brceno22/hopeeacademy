import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Exam } from './exam.entity';
import { Option } from './option.entity';

export type QuestionType = 'multiple_choice' | 'true_false' | 'gap_fill';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  text!: string;

  @Column({ type: 'varchar', length: 32, default: 'multiple_choice' })
  type!: QuestionType;

  @Column({ type: 'text', nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  audioUrl!: string | null;

  /** Word bank for gap_fill (correct words + distractors). */
  @Column({ type: 'jsonb', nullable: true })
  wordBank!: string[] | null;

  /** Correct answers per blank index, e.g. { "1": "are", "2": "is" }. Admin/scoring only. */
  @Column({ type: 'jsonb', nullable: true })
  correctBlanks!: Record<string, string> | null;

  @Column({ default: 1 })
  order!: number;

  @ManyToOne(() => Exam, (e) => e.questions, { onDelete: 'CASCADE' })
  exam!: Exam;

  @OneToMany(() => Option, (o) => o.question, { cascade: true, eager: true })
  options!: Option[];
}
