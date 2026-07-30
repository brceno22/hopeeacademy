import {
  Body,
  Controller,
  Get,
  ParseArrayPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MoodleAuthGuard } from '../auth/moodle-auth.guard';
import type { MoodleUser } from '../auth/moodle-user.types';
import {
  CompleteMicrolearningDto,
  CreateMicrolearningDto,
} from './dto/microlearning.dto';
import { MicrolearningService } from './microlearning.service';

@Controller('microlearning')
export class MicrolearningController {
  constructor(private readonly microlearningService: MicrolearningService) {}

  @UseGuards(MoodleAuthGuard)
  @Get('today')
  async getTodayContent(@CurrentUser() user: MoodleUser) {
    return this.microlearningService.getTodayContent(user.token, user.userId);
  }

  @UseGuards(MoodleAuthGuard)
  @Post('complete')
  async markAsCompleted(
    @Body() body: CompleteMicrolearningDto,
    @CurrentUser() user: MoodleUser,
  ) {
    return this.microlearningService.markAsCompleted(
      user.token,
      Number(body.contentId),
      user.userId,
    );
  }

  @UseGuards(AdminGuard)
  @Post('admin/create')
  async createContent(@Body() body: CreateMicrolearningDto) {
    return this.microlearningService.createAdminContent(body);
  }

  /** Acepta un array JSON (como envía el panel admin) */
  @UseGuards(AdminGuard)
  @Post('admin/bulk')
  async createBulkContent(
    @Body(new ParseArrayPipe({ items: CreateMicrolearningDto }))
    contents: CreateMicrolearningDto[],
  ) {
    return this.microlearningService.createBulkContent(contents);
  }
}
