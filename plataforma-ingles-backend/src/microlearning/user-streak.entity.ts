import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('user_streak')
export class UserStreak {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', unique: true })
  userId!: number;

  @Column({ type: 'int', default: 0 })
  currentStreak! : number;

  // Fecha del último día que completó la píldora (YYYY-MM-DD)
  @Column({ type: 'date', nullable: true })
  lastActiveDate!: string;
}