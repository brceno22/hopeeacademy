import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProgress } from './user-progress.entity';
import { MoodleService } from '../moodle/moodle.service';
import { CoursesService } from '../courses/courses.service';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(UserProgress)
    private readonly progressRepository: Repository<UserProgress>,
    private readonly moodleService: MoodleService,
    private readonly coursesService: CoursesService,
  ) {}

  async markAsCompleted(
    token: string,
    courseId: number,
    moduleId: number,
    type: string,
    knownUserId?: number,
  ) {
    const userId = knownUserId ?? (await this.moodleService.getUserIdFromToken(token));

    const enrolled = await this.moodleService.isEnrolledInCourse(token, courseId, userId);
    if (!enrolled) {
      throw new ForbiddenException('No estás matriculado en este curso');
    }

    const sections = await this.coursesService.getCourseContents(courseId, token);
    const moduleExists = sections.some((s) => s.modules?.some((m) => m.id === moduleId));
    if (!moduleExists) {
      throw new BadRequestException('El módulo no pertenece a este curso');
    }

    const existing = await this.progressRepository.findOne({
      where: { userId, courseId, moduleId },
    });

    if (existing) {
      return { success: true, message: 'Ya estaba marcado como completado', data: existing };
    }

    try {
      const newProgress = this.progressRepository.create({
        userId,
        courseId,
        moduleId,
        type,
      });
      const saved = await this.progressRepository.save(newProgress);
      return { success: true, message: 'Marcado como completado', data: saved };
    } catch {
      const race = await this.progressRepository.findOne({
        where: { userId, courseId, moduleId },
      });
      if (race) {
        return { success: true, message: 'Ya estaba marcado como completado', data: race };
      }
      throw new BadRequestException('No se pudo guardar el progreso');
    }
  }

  async getCourseProgress(token: string, courseId: number, knownUserId?: number) {
    const userId = knownUserId ?? (await this.moodleService.getUserIdFromToken(token));

    const sections = await this.coursesService.getCourseContents(courseId, token);

    let totalModulesCount = 0;
    const validModulesIds: number[] = [];

    sections.forEach((section) => {
      if (section.modules) {
        section.modules.forEach((mod) => {
          if (mod.type !== 'forum') {
            totalModulesCount++;
            validModulesIds.push(mod.id);
          }
        });
      }
    });

    const completedRecords = await this.progressRepository.find({
      where: { userId, courseId },
    });

    const completedModuleIds = completedRecords
      .map((record) => record.moduleId)
      .filter((id) => validModulesIds.includes(id));

    const completedModulesCount = completedModuleIds.length;
    const percentage =
      totalModulesCount > 0
        ? Math.round((completedModulesCount / totalModulesCount) * 100)
        : 0;

    return {
      courseId,
      totalModules: totalModulesCount,
      completedModules: completedModulesCount,
      percentage,
      completedModuleIds,
    };
  }

  async getGlobalProgress(token: string, knownUserId?: number) {
    const userId = knownUserId ?? (await this.moodleService.getUserIdFromToken(token));

    const enrolledCourses = await this.moodleService.request(
      'core_enrol_get_users_courses',
      { userid: userId },
      token,
    );

    const coursesList = Array.isArray(enrolledCourses) ? enrolledCourses : [];
    const validCourses = coursesList.filter((c: { id?: number }) => c.id && c.id > 1);

    const totalCourses = validCourses.length;
    let totalCompletedCourses = 0;
    const coursesProgress: Array<{
      courseId: number;
      name: string;
      percentage: number;
    }> = [];

    const concurrency = 4;
    for (let i = 0; i < validCourses.length; i += concurrency) {
      const batch = validCourses.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map(async (course: { id: number; fullname?: string; displayname?: string }) => {
          try {
            const courseProgress = await this.getCourseProgress(token, course.id, userId);
            return {
              courseId: course.id,
              name: course.fullname || course.displayname || `Curso ${course.id}`,
              percentage: courseProgress.percentage,
            };
          } catch {
            return null;
          }
        }),
      );

      for (const row of results) {
        if (!row) continue;
        coursesProgress.push(row);
        if (row.percentage === 100) totalCompletedCourses++;
      }
    }

    const globalPercentage =
      totalCourses > 0 ? Math.round((totalCompletedCourses / totalCourses) * 100) : 0;

    return {
      totalCourses,
      completedCourses: totalCompletedCourses,
      globalPercentage,
      details: coursesProgress,
    };
  }
}
