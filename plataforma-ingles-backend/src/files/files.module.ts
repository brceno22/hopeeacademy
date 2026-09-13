import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';
import { FileTicketService } from './file-ticket.service';
import { FilesController } from './files.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30_000,
      maxRedirects: 5,
    }),
    AuthModule,
  ],
  providers: [FileTicketService],
  controllers: [FilesController],
})
export class FilesModule {}
