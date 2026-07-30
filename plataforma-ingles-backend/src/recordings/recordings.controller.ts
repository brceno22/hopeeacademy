import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MoodleAuthGuard } from '../auth/moodle-auth.guard';
import type { MoodleUser } from '../auth/moodle-user.types';
import { CreateRecordingDto, UpdateRecordingDto } from './dto/recording.dto';
import { RecordingsService } from './recordings.service';

@Controller('recordings')
export class RecordingsController {
  constructor(private readonly recordingsService: RecordingsService) {}

  // ——— Admin ———

  @UseGuards(AdminGuard)
  @Get('admin')
  async adminList(@Query('folderId') folderId?: string) {
    const id = folderId ? parseInt(folderId, 10) : undefined;
    return this.recordingsService.adminList(id && !Number.isNaN(id) ? id : undefined);
  }

  @UseGuards(AdminGuard)
  @Post('admin')
  async adminCreate(@Body() body: CreateRecordingDto) {
    return this.recordingsService.adminCreate(body);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/:id')
  async adminUpdate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateRecordingDto,
  ) {
    return this.recordingsService.adminUpdate(id, body);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/:id')
  async adminDelete(@Param('id', ParseIntPipe) id: number) {
    return this.recordingsService.adminDelete(id);
  }

  // ——— Student (Bearer validado) ———

  @UseGuards(MoodleAuthGuard)
  @Get()
  async listGrouped(@CurrentUser() _user: MoodleUser) {
    return this.recordingsService.listGroupedForStudents();
  }

  @UseGuards(MoodleAuthGuard)
  @Get('folder/:folderId')
  async listByFolder(
    @CurrentUser() _user: MoodleUser,
    @Param('folderId', ParseIntPipe) folderId: number,
  ) {
    return this.recordingsService.listByFolder(folderId);
  }

  @UseGuards(MoodleAuthGuard)
  @Get(':id')
  async getOne(
    @CurrentUser() _user: MoodleUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.recordingsService.getOneForStudent(id);
  }
}
