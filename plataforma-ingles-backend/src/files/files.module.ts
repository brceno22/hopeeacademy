import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FilesController } from './files.controller';

@Module({
  imports: [HttpModule],
  controllers: [FilesController],
})
export class FilesModule {}