import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class MarkProgressDto {
  @IsInt()
  @Min(1)
  courseId!: number;

  @IsInt()
  @Min(1)
  moduleId!: number;

  @IsString()
  @IsNotEmpty()
  type!: string;
}
