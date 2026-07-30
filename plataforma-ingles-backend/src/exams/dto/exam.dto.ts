import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const QUESTION_TYPES = ['multiple_choice', 'true_false', 'gap_fill'] as const;
export type QuestionTypeDto = (typeof QUESTION_TYPES)[number];

export class ExamOptionDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

export class ExamQuestionDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsIn(QUESTION_TYPES)
  type?: QuestionTypeDto;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  audioUrl?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  wordBank?: string[];

  @IsOptional()
  @IsObject()
  correctBlanks?: Record<string, string>;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamOptionDto)
  options?: ExamOptionDto[];
}

export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  courseId!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passThreshold?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamQuestionDto)
  questions!: ExamQuestionDto[];
}

export class UpdateExamDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  courseId?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passThreshold?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamQuestionDto)
  questions?: ExamQuestionDto[];
}

export class SubmitExamDto {
  @IsObject()
  answers!: Record<string, number | Record<string, string>>;
}
