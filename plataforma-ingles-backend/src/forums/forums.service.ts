import { Injectable } from '@nestjs/common';
import { MoodleService } from '../moodle/moodle.service';

@Injectable()
export class ForumsService {
  constructor(private readonly moodleService: MoodleService) {}

  async getForumsByCourse(courseId: number, token: string) {
    // Moodle pide los IDs de curso como array en esta función
    const params = { 'courseids[0]': courseId };
    const response = await this.moodleService.request('mod_forum_get_forums_by_courses', params, token);
    
    // Devolvemos el array limpio
    return response || [];
  }

  async getForumDiscussions(forumId: number, token: string) {
    const params = { forumid: forumId };
    const response = await this.moodleService.request('mod_forum_get_forum_discussions', params, token);
    
    // Moodle suele devolver las discusiones adentro del objeto "discussions"
    return response.discussions || [];
  }

  async getDiscussionPosts(discussionId: number, token: string) {
    const params = { discussionid: discussionId };
    const response = await this.moodleService.request('mod_forum_get_discussion_posts', params, token);
    
    // Moodle devuelve los mensajes adentro de "posts"
    return response.posts || [];
  }

  async addDiscussion(forumId: number, subject: string, message: string, token: string) {
    const data = {
      forumid: forumId,
      subject: subject,
      message: message,
    };
    // Usamos el post form porque Moodle requiere mandar estos datos como formulario
    const response = await this.moodleService.requestPostForm('mod_forum_add_discussion', data, token);
    return response;
  }

  async addDiscussionPost(postId: number, message: string, token: string) {
    const data = {
      postid: postId,
      message: message,
    };
    const response = await this.moodleService.requestPostForm('mod_forum_add_discussion_post', data, token);
    return response;
  }
}