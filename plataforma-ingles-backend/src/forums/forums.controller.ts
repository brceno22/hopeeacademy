import { Controller, Get, Post, Param, Body, Headers, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { ForumsService } from './forums.service';
import { MoodleService } from '../moodle/moodle.service';

@Controller('forums')
export class ForumsController {
  constructor(
    private readonly forumsService: ForumsService,
    private readonly moodleService: MoodleService,
  ) {}

  // Helper para sacar el token del header Authorization
  private extractToken(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta el token de autenticación de Moodle');
    }
    return authHeader.split(' ')[1];
  }

  @Get('course/:courseId')
  async getForumsByCourse(
    @Param('courseId') courseId: number,
    @Headers('authorization') authHeader: string,
  ) {
    const token = this.extractToken(authHeader);
    return this.forumsService.getForumsByCourse(courseId, token);
  }

  @Get(':forumId/discussions')
  async getForumDiscussions(
    @Param('forumId') forumId: number,
    @Headers('authorization') authHeader: string,
  ) {
    const token = this.extractToken(authHeader);
    return this.forumsService.getForumDiscussions(forumId, token);
  }

  @Get('discussions/:discussionId/posts')
  async getDiscussionPosts(
    @Param('discussionId') discussionId: number,
    @Headers('authorization') authHeader: string,
  ) {
    const token = this.extractToken(authHeader);
    return this.forumsService.getDiscussionPosts(discussionId, token);
  }

  @Post(':forumId/discussions')
  async addDiscussion(
    @Param('forumId') forumId: number,
    @Body('subject') subject: string,
    @Body('message') message: string,
    @Headers('authorization') authHeader: string,
  ) {
    const token = this.extractToken(authHeader);
    return this.forumsService.addDiscussion(forumId, subject, message, token);
  }

  @Get('general-discussions/auto')
  async getAutoForumDiscussions(@Headers('Authorization') authHeader: string) {
    const token = authHeader.replace('Bearer ', '');
    
    // 1. Primero le pedimos a Moodle la info del sitio para obtener el userid de forma segura
    const siteInfo = await this.moodleService.request('core_webservice_get_site_info', {}, token);
    const moodleUserId = siteInfo.userid;

    if (!moodleUserId) {
      throw new NotFoundException('No se pudo recuperar el ID de usuario desde Moodle.');
    }

    // 2. Ahora sí le pedimos los cursos pasándole el userid obligatorio que nos pedía
    const enrolledCourses = await this.moodleService.request(
      'core_enrol_get_users_courses', 
      { userid: moodleUserId }, 
      token
    );
    
    if (!enrolledCourses || enrolledCourses.length === 0) {
      throw new NotFoundException('El estudiante no está inscrito en ningún curso.');
    }

    let forumInstanceId: number | null = null;

    // 3. Recorremos los cursos del alumno hasta encontrar uno que tenga un foro
    for (const course of enrolledCourses) {
      try {
        const sections = await this.moodleService.request('core_course_get_contents', { courseid: course.id }, token);
        
        for (const section of sections) {
          const forumModule = section.modules?.find((mod: any) => mod.modname === 'forum');
          if (forumModule) {
            forumInstanceId = forumModule.instance;
            break;
          }
        }
        
        if (forumInstanceId) break; 
      } catch (e) {
        continue; // Si algún curso viejo da error de permisos, salta al siguiente
      }
    }

    if (!forumInstanceId) {
      throw new NotFoundException('No se encontró ningún foro activo en los cursos del estudiante.');
    }

    // 4. Devolvemos las discusiones del foro encontrado
    return await this.moodleService.request('mod_forum_get_forum_discussions', { forumid: forumInstanceId }, token);
  }

  @Post('discussions/posts/:postId/reply')
  async addDiscussionPost(
    @Param('postId') postId: number,
    @Body('message') message: string,
    @Headers('authorization') authHeader: string,
  ) {
    const token = this.extractToken(authHeader);
    return this.forumsService.addDiscussionPost(postId, message, token);
  }
}