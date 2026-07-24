import { IsString, Matches } from 'class-validator';

export class UpdatePrefsDto {
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'avatarColor must be a hex color like #0071BC',
  })
  avatarColor!: string;
}
