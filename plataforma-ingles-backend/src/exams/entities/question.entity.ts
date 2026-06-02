import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Exam } from './exam.entity';
import { Option} from './option.entity';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  text!: string;

  @Column({ default: 1 })
  order!: number;

  @ManyToOne(() => Exam, e => e.questions, { onDelete: 'CASCADE' })
  exam!: Exam;

  @OneToMany(() => Option, o => o.question, { cascade: true, eager: true })
  options!: Option[];
}