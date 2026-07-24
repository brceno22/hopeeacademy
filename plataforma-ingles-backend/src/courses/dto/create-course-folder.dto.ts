import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateCourseFolderDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  parentId?: number | null;

  @IsOptional()
  @IsString()
  slug?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
