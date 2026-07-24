import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { extractOptionalBearerToken } from '../auth/auth-token.util';
import { SubmitTaskDto } from '../common/dto/moodle-actions.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get(':assignId')
  getTask(@Param('assignId', ParseIntPipe) assignId: number) {
    return this.tasksService.getTask(assignId);
  }

  @Get(':assignId/status')
  getSubmissionStatus(
    @Param('assignId', ParseIntPipe) assignId: number,
    @Headers('authorization') authHeader: string,
    @Headers('x-user-token') legacyToken?: string,
  ) {
    const token = extractOptionalBearerToken(authHeader) || legacyToken;
    if (!token) {
      throw new UnauthorizedException('Falta el token de autenticación');
    }
    return this.tasksService.getSubmissionStatus(assignId, token);
  }

  @Post(':assignId/submit')
  submitTask(
    @Param('assignId', ParseIntPipe) assignId: number,
    @Body() body: SubmitTaskDto,
    @Headers('authorization') authHeader?: string,
  ) {
    const token = body.token || extractOptionalBearerToken(authHeader);
    if (!token) {
      throw new UnauthorizedException('Falta el token de autenticación');
    }
    return this.tasksService.submitTask(assignId, token, {
      userId: body.userId,
      text: body.text,
      fileName: body.fileName,
      fileBase64: body.fileBase64,
      fileMimeType: body.fileMimeType,
    });
  }
}
