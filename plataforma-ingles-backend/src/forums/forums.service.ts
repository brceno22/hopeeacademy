import { ForbiddenException, HttpException, Injectable, Logger } from '@nestjs/common';
import { MoodleService } from '../moodle/moodle.service';

interface MoodleForum {
  id: number;
  cmid?: number;
  course?: number;
  groupmode?: number;
  cancreatediscussions?: boolean | number;
  type?: string;
  name?: string;
}

interface MoodleGroup {
  id: number;
  name?: string;
  courseid?: number;
}

@Injectable()
export class ForumsService {
  private readonly logger = new Logger(ForumsService.name);

  constructor(private readonly moodleService: MoodleService) {}

  async getForumsByCourse(courseId: number, token: string) {
    const params = { 'courseids[0]': courseId };
    const response = await this.moodleService.request('mod_forum_get_forums_by_courses', params, token);
    return response || [];
  }

  async getForumDiscussions(forumId: number, token: string) {
    const resolved = await this.resolveForum(forumId, token);
    const params = { forumid: resolved.forumId };
    const response = await this.moodleService.request<{ discussions?: unknown[] }>(
      'mod_forum_get_forum_discussions',
      params,
      token,
    );

    return response.discussions || [];
  }

  async getDiscussionPosts(discussionId: number, token: string) {
    const params = { discussionid: discussionId };
    const response = await this.moodleService.request<{ posts?: unknown[] }>(
      'mod_forum_get_discussion_posts',
      params,
      token,
    );

    return response.posts || [];
  }

  /**
   * Accepts forum instance id OR course-module id (cmid) and returns the real forum id.
   */
  private async resolveForum(
    forumIdOrCmid: number,
    token: string,
  ): Promise<{ forumId: number; forum: MoodleForum | null }> {
    try {
      const userId = await this.moodleService.getUserIdFromToken(token);
      const courses = await this.moodleService.getUserCourses(token, userId);

      for (const course of courses) {
        const forums = (await this.getForumsByCourse(course.id, token)) as MoodleForum[];
        const list = Array.isArray(forums) ? forums : [];
        const byId = list.find((f) => Number(f.id) === Number(forumIdOrCmid));
        if (byId) return { forumId: Number(byId.id), forum: byId };
        const byCmid = list.find((f) => Number(f.cmid) === Number(forumIdOrCmid));
        if (byCmid) return { forumId: Number(byCmid.id), forum: byCmid };
      }
    } catch (err) {
      this.logger.warn(
        `resolveForum failed for ${forumIdOrCmid}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return { forumId: forumIdOrCmid, forum: null };
  }

  private async listUserGroupIds(courseId: number, userId: number, token: string): Promise<number[]> {
    try {
      const groupsPayload = await this.moodleService.request<
        { groups?: MoodleGroup[] } | MoodleGroup[]
      >('core_group_get_course_user_groups', { courseid: courseId, userid: userId }, token);

      const groups = Array.isArray(groupsPayload)
        ? groupsPayload
        : Array.isArray(groupsPayload?.groups)
          ? groupsPayload.groups
          : [];
      return groups.map((g) => Number(g.id)).filter((id) => Number.isFinite(id));
    } catch {
      return [];
    }
  }

  /** Build groupid candidates: explicit → user groups → -1 → 0 */
  private async resolveGroupCandidates(
    forum: MoodleForum | null,
    token: string,
    explicitGroupId?: number,
  ): Promise<number[]> {
    if (explicitGroupId != null && Number.isFinite(explicitGroupId)) {
      return [explicitGroupId];
    }

    const out: number[] = [];
    const groupmode = Number(forum?.groupmode || 0);

    if (forum?.course && groupmode) {
      try {
        const userId = await this.moodleService.getUserIdFromToken(token);
        const groupIds = await this.listUserGroupIds(Number(forum.course), userId, token);
        if (!groupIds.length) {
          throw new ForbiddenException(
            'This forum uses groups and you are not in any group. Ask an admin to add you to a Moodle group.',
          );
        }
        out.push(...groupIds);
      } catch (err) {
        if (err instanceof ForbiddenException) throw err;
      }
    }

    // Always try all-participants / default last
    out.push(-1, 0);
    return Array.from(new Set(out));
  }

  private moodleErrorBlob(err: unknown): string {
    if (!(err instanceof HttpException)) {
      return err instanceof Error ? err.message : '';
    }
    const body = err.getResponse();
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object') {
      const o = body as { message?: string; errorcode?: string };
      return `${o.errorcode || ''} ${o.message || ''}`;
    }
    return err.message;
  }

  private isCreateDiscussionFailure(err: unknown): boolean {
    const blob = this.moodleErrorBlob(err).toLowerCase();
    return (
      blob.includes('cannotcreatediscussion') ||
      blob.includes('cannotadddiscussion') ||
      blob.includes('could not create new discussion')
    );
  }

  async addDiscussion(
    forumIdOrCmid: number,
    subject: string,
    message: string,
    token: string,
    groupId?: number,
  ) {
    const { forumId, forum } = await this.resolveForum(forumIdOrCmid, token);

    if (forum) {
      const canCreate = forum.cancreatediscussions;
      if (canCreate === false || canCreate === 0) {
        throw new ForbiddenException(
          'You cannot start discussions in this forum (permissions or news/announcements forum). In Moodle, enable mod/forum:startdiscussion for students or use a standard forum.',
        );
      }
      if ((forum.type || '').toLowerCase() === 'news') {
        throw new ForbiddenException(
          'This is a Moodle announcements (news) forum — students cannot create topics. Use a standard forum activity.',
        );
      }
    }

    const groupCandidates = await this.resolveGroupCandidates(forum, token, groupId);
    let lastErr: unknown;

    for (const groupid of groupCandidates) {
      try {
        return await this.moodleService.requestPostForm(
          'mod_forum_add_discussion',
          {
            forumid: forumId,
            subject: subject.trim(),
            message: message.trim(),
            groupid,
          },
          token,
        );
      } catch (err: unknown) {
        lastErr = err;
        if (!this.isCreateDiscussionFailure(err)) throw err;
        this.logger.warn(
          `add_discussion failed forum=${forumId} groupid=${groupid}: ${this.moodleErrorBlob(err)}`,
        );
      }
    }

    if (lastErr instanceof ForbiddenException) throw lastErr;
    throw new ForbiddenException(
      'Could not create the discussion. Check Moodle: forum permissions (start discussion), group membership if the forum uses groups, and that it is not a news-only forum.',
    );
  }

  async addDiscussionPost(postId: number, message: string, token: string) {
    return this.moodleService.requestPostForm(
      'mod_forum_add_discussion_post',
      {
        postid: postId,
        message: message.trim(),
      },
      token,
    );
  }
}
