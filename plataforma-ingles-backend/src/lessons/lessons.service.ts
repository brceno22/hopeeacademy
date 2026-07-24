import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { MoodleService } from '../moodle/moodle.service';
import { MoodleModuleRaw } from '../moodle/moodle.types';

interface MoodleLessonPagesResponse {
  pages?: Array<{
    page: { id: number; type?: number; [key: string]: unknown };
    [key: string]: unknown;
  }>;
}

@Injectable()
export class LessonsService {
  constructor(private readonly moodleService: MoodleService) {}

  formatLesson(mod: MoodleModuleRaw) {
    return {
      id: mod.id,
      name: mod.name,
      type: mod.modname?.replace(/"/g, '').trim(),
      category: 'contenido_didactico',
      description: mod.description || '',
      url: mod.url || '',
      fileUrl: mod.contents && mod.contents.length > 0 ? mod.contents[0].fileurl : null,
      instanceId: mod.instance,
    };
  }

  async getLessonPages(instanceId: number) {
    const data = await this.moodleService.request<MoodleLessonPagesResponse>(
      'mod_lesson_get_pages',
      { lessonid: instanceId },
    );

    if (!data?.pages) {
      throw new NotFoundException('No se pudieron cargar las páginas de la lección');
    }

    const paginasCompletas = await Promise.all(
      data.pages.map(async (item) => {
        try {
          const pageData = await this.moodleService.request<{ answers?: unknown[] }>(
            'mod_lesson_get_page_data',
            {
              lessonid: instanceId,
              pageid: item.page.id,
            },
          );

          return {
            ...item,
            opciones: pageData.answers || [],
          };
        } catch {
          return { ...item, opciones: [] };
        }
      }),
    );

    return paginasCompletas;
  }

  async submitLessonAnswers(
    instanceId: number,
    respuestas: Record<string, unknown>,
    userToken: string,
  ) {
    try {
      await this.moodleService.request(
        'mod_lesson_launch_attempt',
        { lessonid: instanceId },
        userToken,
      );

      for (const [pageId, opcionId] of Object.entries(respuestas)) {
        await this.moodleService.request(
          'mod_lesson_process_page',
          {
            lessonid: instanceId,
            pageid: parseInt(pageId, 10),
            'data[0][name]': String(opcionId),
            'data[0][value]': String(opcionId),
          },
          userToken,
        );
      }

      await this.moodleService.request(
        'mod_lesson_finish_attempt',
        {
          lessonid: instanceId,
          password: '',
          review: 0,
          outoftime: 0,
        },
        userToken,
      );

      return { success: true, message: 'Examen guardado correctamente' };
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      const message =
        error instanceof Error ? error.message : 'No se pudo guardar el examen en Moodle.';
      throw new NotFoundException(message);
    }
  }
}
