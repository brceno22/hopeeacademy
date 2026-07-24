import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRecordingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  folderId!: number;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @IsUrl({ require_protocol: true }, { message: 'driveUrl debe ser una URL válida' })
  driveUrl!: string;

  @IsOptional()
  @IsString()
  recordedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateRecordingDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  folderId?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true }, { message: 'driveUrl debe ser una URL válida' })
  driveUrl?: string;

  @IsOptional()
  @IsString()
  recordedAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
