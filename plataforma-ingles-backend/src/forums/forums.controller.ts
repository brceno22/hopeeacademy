import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MoodleAuthGuard } from '../auth/moodle-auth.guard';
import type { MoodleUser } from '../auth/moodle-user.types';
import {
  CreateDiscussionDto,
  ReplyDiscussionDto,
} from '../common/dto/moodle-actions.dto';
import { MoodleService } from '../moodle/moodle.service';
import { MoodleModuleRaw, MoodleSectionRaw } from '../moodle/moodle.types';
import { ForumsService } from './forums.service';

@Controller('forums')
@UseGuards(MoodleAuthGuard)
export class ForumsController {
  constructor(
    private readonly forumsService: ForumsService,
    private readonly moodleService: MoodleService,
  ) {}

  @Get('course/:courseId')
  async getForumsByCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
    @CurrentUser() user: MoodleUser,
  ) {
    return this.forumsService.getForumsByCourse(courseId, user.token);
  }

  @Get('general-discussions/auto')
  async getAutoForumDiscussions(@CurrentUser() user: MoodleUser) {
    const { token, userId: moodleUserId } = user;

    const enrolledCourses = await this.moodleService.request<Array<{ id: number }>>(
      'core_enrol_get_users_courses',
      { userid: moodleUserId },
      token,
    );

    if (!enrolledCourses || enrolledCourses.length === 0) {
      throw new NotFoundException('El estudiante no está inscrito en ningún curso.');
    }

    let forumInstanceId: number | null = null;

    for (const course of enrolledCourses) {
      try {
        const sections = await this.moodleService.request<MoodleSectionRaw[]>(
          'core_course_get_contents',
          { courseid: course.id },
          token,
        );

        for (const section of sections) {
          const forumModule = section.modules?.find(
            (mod: MoodleModuleRaw) => mod.modname === 'forum',
          );
          if (forumModule?.instance) {
            forumInstanceId = forumModule.instance;
            break;
          }
        }

        if (forumInstanceId) break;
      } catch {
        continue;
      }
    }

    if (!forumInstanceId) {
      throw new NotFoundException(
        'No se encontró ningún foro activo en los cursos del estudiante.',
      );
    }

    return this.moodleService.request(
      'mod_forum_get_forum_discussions',
      { forumid: forumInstanceId },
      token,
    );
  }

  @Get(':forumId/discussions')
  async getForumDiscussions(
    @Param('forumId', ParseIntPipe) forumId: number,
    @CurrentUser() user: MoodleUser,
  ) {
    return this.forumsService.getForumDiscussions(forumId, user.token);
  }

  @Get('discussions/:discussionId/posts')
  async getDiscussionPosts(
    @Param('discussionId', ParseIntPipe) discussionId: number,
    @CurrentUser() user: MoodleUser,
  ) {
    return this.forumsService.getDiscussionPosts(discussionId, user.token);
  }

  @Post(':forumId/discussions')
  async addDiscussion(
    @Param('forumId', ParseIntPipe) forumId: number,
    @Body() body: CreateDiscussionDto,
    @CurrentUser() user: MoodleUser,
  ) {
    return this.forumsService.addDiscussion(
      forumId,
      body.subject,
      body.message,
      user.token,
      body.groupid,
    );
  }

  @Post('discussions/posts/:postId/reply')
  async addDiscussionPost(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() body: ReplyDiscussionDto,
    @CurrentUser() user: MoodleUser,
  ) {
    return this.forumsService.addDiscussionPost(postId, body.message, user.token);
  }
}
