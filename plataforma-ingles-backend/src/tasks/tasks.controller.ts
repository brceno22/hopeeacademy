import { Controller, Get, Post, Param, Body, ParseIntPipe, Headers } from '@nestjs/common';
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
    @Headers('x-user-token') userToken: string,
  ) {
    return this.tasksService.getSubmissionStatus(assignId, userToken);
  }

  @Post(':assignId/submit')
  submitTask(
    @Param('assignId', ParseIntPipe) assignId: number,
    @Body() body: { token: string; userId?: number; text?: string; fileName?: string; fileBase64?: string; fileMimeType?: string },
  ) {
    return this.tasksService.submitTask(assignId, body.token, {
      userId: body.userId,
      text: body.text,
      fileName: body.fileName,
      fileBase64: body.fileBase64,
      fileMimeType: body.fileMimeType,
    });
  }
  
}