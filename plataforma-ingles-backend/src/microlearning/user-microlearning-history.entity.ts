import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique, Index } from 'typeorm';

@Entity('user_microlearning_history')
@Unique(['userId', 'contentId'])
@Index(['userId'])
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
