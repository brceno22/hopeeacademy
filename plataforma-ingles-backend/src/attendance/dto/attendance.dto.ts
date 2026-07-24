import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateAttendanceSessionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  moodleCourseId!: number;

  /** YYYY-MM-DD; si no se envía, usa hoy (UTC-3 / local server date) */
  @IsOptional()
  @IsString()
  sessionDate?: string;

  @IsOptional()
  @IsString()
  title?: string;

  /** Si true, crea (o reutiliza) y deja la sesión abierta */
  @IsOptional()
  @IsBoolean()
  open?: boolean;
}
