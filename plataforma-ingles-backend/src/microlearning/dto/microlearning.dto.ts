import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class CompleteMicrolearningDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contentId!: number;
}

export class CreateMicrolearningDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  translation?: string;

  @IsOptional()
  @IsString()
  audioUrl?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ValidateIf((_, v) => v !== '' && v != null)
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}
