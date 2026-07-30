import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class SubmitLessonDto {
  @IsObject()
  respuestas!: Record<string, unknown>;
}

export class SubmitTaskDto {
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

  @IsOptional()
  @IsNumber()
  groupid?: number;
}

export class ReplyDiscussionDto {
  @IsString()
  @IsNotEmpty()
  message!: string;
}
