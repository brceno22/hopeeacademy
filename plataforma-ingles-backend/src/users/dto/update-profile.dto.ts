import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstname!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastname!: string;
}
