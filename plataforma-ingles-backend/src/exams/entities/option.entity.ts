import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Question } from './question.entity';

@Entity('options')
export class Option {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  text!: string;

  @Column({ default: false })
  isCorrect!: boolean;

  @ManyToOne(() => Question, q => q.options, { onDelete: 'CASCADE' })
  question!: Question;
}