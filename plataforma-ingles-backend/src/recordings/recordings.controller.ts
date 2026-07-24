import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { extractBearerToken } from '../auth/auth-token.util';
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

  // ——— Student (Bearer) ———

  @Get()
  async listGrouped(@Headers('authorization') authHeader: string) {
    extractBearerToken(authHeader); // exige sesión Moodle
    return this.recordingsService.listGroupedForStudents();
  }

  @Get('folder/:folderId')
  async listByFolder(
    @Headers('authorization') authHeader: string,
    @Param('folderId', ParseIntPipe) folderId: number,
  ) {
    extractBearerToken(authHeader);
    return this.recordingsService.listByFolder(folderId);
  }

  @Get(':id')
  async getOne(
    @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    extractBearerToken(authHeader);
    return this.recordingsService.getOneForStudent(id);
  }
}
