import { Module } from '@nestjs/common';
import { ForumsController } from './forums.controller';
import { ForumsService } from './forums.service';
import { MoodleModule } from '../moodle/moodle.module'; // Ajustá la ruta si es necesario

@Module({
  imports: [MoodleModule],
  controllers: [ForumsController],
  providers: [ForumsService],
})
export class ForumsModule {}