import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdminSessionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  key!: string;
}
