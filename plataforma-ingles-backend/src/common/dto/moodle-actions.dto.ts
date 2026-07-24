import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class SubmitLessonDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsObject()
  respuestas!: Record<string, unknown>;
}

export class SubmitTaskDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  userId?: number;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  fileBase64?: string;

  @IsOptional()
  @IsString()
  fileMimeType?: string;
}

export class CreateDiscussionDto {
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class ReplyDiscussionDto {
  @IsString()
  @IsNotEmpty()
  message!: string;
}
