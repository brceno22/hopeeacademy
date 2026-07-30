import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MoodleAuthGuard } from '../auth/moodle-auth.guard';
import type { MoodleUser } from '../auth/moodle-user.types';
import { SubmitTaskDto } from '../common/dto/moodle-actions.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(MoodleAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get(':assignId')
  getTask(@Param('assignId', ParseIntPipe) assignId: number, @CurrentUser() user: MoodleUser) {
    return this.tasksService.getTask(assignId, user.token);
  }

  @Get(':assignId/status')
  getSubmissionStatus(
    @Param('assignId', ParseIntPipe) assignId: number,
    @CurrentUser() user: MoodleUser,
  ) {
    return this.tasksService.getSubmissionStatus(assignId, user.token);
  }

  @Post(':assignId/submit')
  submitTask(
    @Param('assignId', ParseIntPipe) assignId: number,
    @Body() body: SubmitTaskDto,
    @CurrentUser() user: MoodleUser,
  ) {
    return this.tasksService.submitTask(assignId, user.token, {
      userId: user.userId,
      text: body.text,
      fileName: body.fileName,
      fileBase64: body.fileBase64,
      fileMimeType: body.fileMimeType,
    });
  }
}
