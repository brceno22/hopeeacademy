import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MoodleAuthGuard } from '../auth/moodle-auth.guard';
import type { MoodleUser } from '../auth/moodle-user.types';
import {
  CreateDiscussionDto,
  ReplyDiscussionDto,
} from '../common/dto/moodle-actions.dto';
import { ForumsService } from './forums.service';

@Controller('forums')
@UseGuards(MoodleAuthGuard)
export class ForumsController {
  constructor(private readonly forumsService: ForumsService) {}

  @Get('course/:courseId')
  async getForumsByCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
    @CurrentUser() user: MoodleUser,
  ) {
    return this.forumsService.getForumsByCourse(courseId, user.token);
  }

  @Get('general-discussions/auto')
  async getAutoForumDiscussions(@CurrentUser() user: MoodleUser) {
    return this.forumsService.getAutoCommunityForum(user.token, user.userId);
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
    return this.forumsService.addDiscussionPost(
      postId,
      body.message,
      user.token,
      body.subject,
    );
  }
}
