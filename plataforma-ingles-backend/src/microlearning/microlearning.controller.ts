import {
  Body,
  Controller,
  Get,
  Headers,
  ParseArrayPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { extractBearerToken } from '../auth/auth-token.util';
import {
  CompleteMicrolearningDto,
  CreateMicrolearningDto,
} from './dto/microlearning.dto';
import { MicrolearningService } from './microlearning.service';

@Controller('microlearning')
export class MicrolearningController {
  constructor(private readonly microlearningService: MicrolearningService) {}

  @Get('today')
  async getTodayContent(@Headers('authorization') authHeader: string) {
    const token = extractBearerToken(authHeader);
    return this.microlearningService.getTodayContent(token);
  }

  @Post('complete')
  async markAsCompleted(
    @Body() body: CompleteMicrolearningDto,
    @Headers('authorization') authHeader: string,
  ) {
    const token = extractBearerToken(authHeader);
    return this.microlearningService.markAsCompleted(token, Number(body.contentId));
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
