import { Injectable, UnauthorizedException } from '@nestjs/common';
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

  // Helper para sacar el userId de Moodle usando el token
  private async getUserIdFromToken(token: string): Promise<number> {
    try {
      const info = await this.moodleService.request('core_webservice_get_site_info', {}, token);
      if (!info || !info.userid) throw new Error();
      return info.userid;
    } catch (error) {
      throw new UnauthorizedException('Token de Moodle inválido o expirado');
    }
  }

  async markAsCompleted(token: string, courseId: number, moduleId: number, type: string) {
    const userId = await this.getUserIdFromToken(token);

    // Verificamos si ya existe para hacerlo idempotente
    const existing = await this.progressRepository.findOne({
      where: { userId, courseId, moduleId },
    });

    if (existing) {
      return { success: true, message: 'Ya estaba marcado como completado', data: existing };
    }

    const newProgress = this.progressRepository.create({
      userId,
      courseId,
      moduleId,
      type,
    });

    const saved = await this.progressRepository.save(newProgress);
    return { success: true, message: 'Marcado como completado', data: saved };
  }

  async getCourseProgress(token: string, courseId: number) {
    const userId = await this.getUserIdFromToken(token);

    // 1. Traemos los contenidos del curso usando el servicio que ya tenés armado
    const sections = await this.coursesService.getCourseContents(courseId);

    // 2. Aplanamos y filtramos los foros
    let totalModulesCount = 0;
    const validModulesIds: number[] = [];

    sections.forEach((section: any) => {
      if (section.modules) {
        section.modules.forEach((mod: any) => {
          if (mod.type !== 'forum' && mod.modname !== 'forum') {
            totalModulesCount++;
            validModulesIds.push(mod.id);
          }
        });
      }
    });

    // 3. Consultamos cuántos de esos módulos el alumno ya completó en Postgres
    const completedRecords = await this.progressRepository.find({
      where: { userId, courseId },
    });

    // Filtramos por las dudas de que haya quedado algún registro huérfano de un módulo borrado en Moodle
    const completedModuleIds = completedRecords
      .map(record => record.moduleId)
      .filter(id => validModulesIds.includes(id));

    const completedModulesCount = completedModuleIds.length;
    const percentage = totalModulesCount > 0 ? Math.round((completedModulesCount / totalModulesCount) * 100) : 0;

    return {
      courseId,
      totalModules: totalModulesCount,
      completedModules: completedModulesCount,
      percentage,
      completedModuleIds,
    };
  }

  async getGlobalProgress(token: string) {
    const userId = await this.getUserIdFromToken(token);

    // 1. Traemos a qué clases/cursos tiene acceso
    const enrolledCourses = await this.moodleService.request(
      'core_enrol_get_users_courses',
      { userid: userId },
      token
    );

    const coursesList = Array.isArray(enrolledCourses) ? enrolledCourses : [];
    const validCourses = coursesList.filter((c: any) => c.id && c.id > 1);
    
    const totalCourses = validCourses.length;
    let totalCompletedCourses = 0;
    const coursesProgress: any[] = [];

    // 2. Calculamos el progreso curso por curso para armar la vista global
    for (const course of validCourses) {
      try {
        const courseProgress = await this.getCourseProgress(token, course.id);
        coursesProgress.push({
          courseId: course.id,
          name: course.fullname || course.displayname,
          percentage: courseProgress.percentage
        });
        
        // Si el curso está al 100%, suma uno al total de cursos completados
        if (courseProgress.percentage === 100) {
          totalCompletedCourses++;
        }
      } catch (e) {
        // Si falla un curso (ej: no tiene contenidos aún), lo ignoramos y seguimos
        continue;
      }
    }

    const globalPercentage = totalCourses > 0 ? Math.round((totalCompletedCourses / totalCourses) * 100) : 0;

    return {
      totalCourses,
      completedCourses: totalCompletedCourses,
      globalPercentage,
      details: coursesProgress,
    };
  }
}