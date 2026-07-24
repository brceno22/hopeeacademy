import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateShiftDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  folderId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  moodleCourseId?: number | null;

  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek!: number[];

  @IsString()
  @Matches(TIME_RE, { message: 'startTime debe ser HH:mm' })
  startTime!: string;

  @IsString()
  @Matches(TIME_RE, { message: 'endTime debe ser HH:mm' })
  endTime!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  meetUrl?: string;

  @IsOptional()
  @IsString()
  validFrom?: string;

  @IsOptional()
  @IsString()
  validTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  folderId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  moodleCourseId?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  daysOfWeek?: number[];

  @IsOptional()
  @IsString()
  @Matches(TIME_RE)
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_RE)
  endTime?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  meetUrl?: string | null;

  @IsOptional()
  @IsString()
  validFrom?: string | null;

  @IsOptional()
  @IsString()
  validTo?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class EnrollDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  moodleUserId!: number;
}

export class CreateCalendarEventDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  meetUrl?: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  shiftId!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCalendarEventDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  meetUrl?: string | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  shiftId?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
