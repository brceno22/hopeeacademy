import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('user_microlearning_history')
export class UserMicrolearningHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  userId!: number;

  @Column({ type: 'int' })
  contentId!: number;

  @CreateDateColumn()
  viewedAt!: Date;
}