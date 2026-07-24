import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { LessonsService } from '../lessons/lessons.service';
import { MoodleService } from '../moodle/moodle.service';
import { MoodleCourseRaw, MoodleModuleRaw, MoodleSectionRaw } from '../moodle/moodle.types';
import { TasksService } from '../tasks/tasks.service';

export interface MoodleCourseSummary {
  id: number;
  name: string;
  code: string;
  description: string;
}

export interface CourseModuleView {
  id: number;
  name: string;
  type: string;
  category: string;
  instanceId?: number;
  description: string;
  url: string;
  fileUrl: string | null;
}

export interface CourseSectionView {
  id: number;
  name: string;
  summary: string;
  modules: CourseModuleView[];
}

@Injectable()
export class CoursesService {
  private static readonly CONTENTS_TTL_MS = 90_000;
  private static readonly COURSES_TTL_MS = 90_000;

  constructor(
    private readonly moodleService: MoodleService,
    private readonly tasksService: TasksService,
    private readonly lessonsService: LessonsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** Todos los cursos académicos (token de servicio). Para admin. */
  async findAll(): Promise<MoodleCourseSummary[]> {
    const cacheKey = 'moodle:courses:all';
    const cached = await this.cache.get<MoodleCourseSummary[]>(cacheKey);
    if (cached) return cached;

    const data = await this.moodleService.request<{ courses?: MoodleCourseRaw[] }>(
      'core_course_get_courses_by_field',
    );
    const mapped = this.mapCourses(data.courses || []);
    await this.cache.set(cacheKey, mapped, CoursesService.COURSES_TTL_MS);
    return mapped;
  }

  /**
   * Cursos del alumno según inscripción en Moodle.
   * Si no hay token, devuelve el listado general (comportamiento anterior).
   */
  async findAllForUser(userToken?: string): Promise<MoodleCourseSummary[]> {
    if (userToken) {
      const cacheKey = `moodle:courses:user:${userToken.slice(0, 16)}`;
      const cached = await this.cache.get<MoodleCourseSummary[]>(cacheKey);
      if (cached) return cached;

      try {
        const userId = await this.moodleService.getUserIdFromToken(userToken);
        const data = await this.moodleService.request<MoodleCourseRaw[]>(
          'core_enrol_get_users_courses',
          { userid: userId },
          userToken,
        );
        const list = Array.isArray(data) ? data : [];
        if (list.length > 0) {
          const mapped = list
            .filter((c) => c.id && c.id > 1)
            .map((curso) => ({
              id: curso.id,
              name: curso.fullname || curso.displayname || '',
              code: curso.shortname || '',
              description: curso.summary
                ? String(curso.summary).replace(/<[^>]*>/g, '')
                : 'Sin descripción',
            }));
          await this.cache.set(cacheKey, mapped, CoursesService.COURSES_TTL_MS);
          return mapped;
        }
      } catch {
        // fallback al listado general si el token falla o no hay matrículas
      }
    }
    return this.findAll();
  }

  private mapCourses(cursos: MoodleCourseRaw[]): MoodleCourseSummary[] {
    return cursos
      .filter((curso) => curso.format !== 'site')
      .map((curso) => ({
        id: curso.id,
        name: (curso.fullname as string) || '',
        code: (curso.shortname as string) || '',
        description: curso.summary
          ? String(curso.summary).replace(/<[^>]*>/g, '')
          : 'Sin descripción',
      }));
  }

  async getCourseContents(courseId: number): Promise<CourseSectionView[]> {
    const cacheKey = `moodle:contents:${courseId}`;
    const cached = await this.cache.get<CourseSectionView[]>(cacheKey);
    if (cached) return cached;

    const data = await this.moodleService.request<MoodleSectionRaw[]>(
      'core_course_get_contents',
      { courseid: courseId },
    );

    if (!data || !Array.isArray(data)) {
      throw new NotFoundException(`No se pudieron cargar los contenidos del curso ${courseId}`);
    }

    const contenidosDidacticos = ['label', 'resource', 'book', 'lesson', 'glossary', 'page'];
    const tareas = ['assign'];
    const tests = ['quiz'];
    const foros = ['forum'];

    const sections: CourseSectionView[] = data.map((section) => {
      const modules = (section.modules || [])
        .filter((mod) =>
          [...contenidosDidacticos, ...tareas, ...tests, ...foros].includes(mod.modname),
        )
        .map((mod: MoodleModuleRaw) => {
          if (tareas.includes(mod.modname)) {
            return this.tasksService.formatTask(mod) as CourseModuleView;
          }

          if (contenidosDidacticos.includes(mod.modname)) {
            return this.lessonsService.formatLesson(mod) as CourseModuleView;
          }

          if (foros.includes(mod.modname)) {
            return {
              id: mod.id,
              name: mod.name,
              type: 'forum',
              category: 'foro',
              instanceId: mod.instance,
              description: mod.description || '',
              url: mod.url || '',
              fileUrl: null,
            };
          }

          return {
            id: mod.id,
            name: mod.name,
            type: mod.modname,
            category: 'test',
            description: mod.description || '',
            url: mod.url || '',
            fileUrl: null,
          };
        });

      return {
        id: section.id,
        name: section.name,
        summary: section.summary || '',
        modules,
      };
    });

    await this.cache.set(cacheKey, sections, CoursesService.CONTENTS_TTL_MS);
    return sections;
  }
}
