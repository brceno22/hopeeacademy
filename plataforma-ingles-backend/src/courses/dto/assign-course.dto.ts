import { IsInt, IsOptional, Min } from 'class-validator';

export class AssignCourseToFolderDto {
  @IsInt()
  @Min(1)
  moodleCourseId!: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
