import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export const DEFAULT_AVATAR_COLOR = '#0071BC';

@Entity('user_profile_prefs')
export class UserProfilePrefs {
  @PrimaryColumn({ type: 'int' })
  moodleUserId!: number;

  @Column({ type: 'varchar', length: 7, default: DEFAULT_AVATAR_COLOR })
  avatarColor!: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}
