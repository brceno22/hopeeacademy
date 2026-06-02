import { Injectable, NotFoundException } from '@nestjs/common';
import { LessonsService } from 'src/lessons/lessons.service';
import { MoodleService } from 'src/moodle/moodle.service';
import { TasksService } from 'src/tasks/tasks.service';

export interface MoodleCourseSummary {
  id: number;
  name: string;
  code: string;
  description: string;
}

@Injectable()
export class CoursesService {
  constructor(
    private readonly moodleService: MoodleService,
    private readonly tasksService: TasksService,     
    private readonly lessonsService: LessonsService,
  ) {}
  
  /** Todos los cursos académicos (token de servicio). Para admin. */
  async findAll(): Promise<MoodleCourseSummary[]> {
    const data = await this.moodleService.request('core_course_get_courses_by_field');
    return this.mapCourses(data.courses || []);
  }

  /**
   * Cursos del alumno según inscripción en Moodle.
   * Si no hay token, devuelve el listado general (comportamiento anterior).
   */
  async findAllForUser(userToken?: string): Promise<MoodleCourseSummary[]> {
    if (userToken) {
      try {
        const data = await this.moodleService.request(
          'core_enrol_get_users_courses',
          { userid: await this.resolveUserIdFromToken(userToken) },
          userToken,
        );
        const list = Array.isArray(data) ? data : [];
        if (list.length > 0) {
          return list
            .filter((c: { id?: number }) => c.id && c.id > 1)
            .map((curso: Record<string, unknown>) => ({
              id: curso.id as number,
              name: (curso.fullname as string) || (curso.displayname as string) || '',
              code: (curso.shortname as string) || '',
              description: curso.summary
                ? String(curso.summary).replace(/<[^>]*>/g, '')
                : 'Sin descripción',
            }));
        }
      } catch {
        // fallback al listado general
      }
    }
    return this.findAll();
  }

  private async resolveUserIdFromToken(userToken: string): Promise<number> {
    const info = await this.moodleService.request(
      'core_webservice_get_site_info',
      {},
      userToken,
    );
    return info.userid;
  }

  private mapCourses(cursos: Record<string, unknown>[]): MoodleCourseSummary[] {
    return cursos
      .filter((curso) => curso.format !== 'site')
      .map((curso) => ({
        id: curso.id as number,
        name: curso.fullname as string,
        code: curso.shortname as string,
        description: curso.summary
          ? String(curso.summary).replace(/<[^>]*>/g, '')
          : 'Sin descripción',
      }));
  }


  async getCourseContents(courseId: number) {
    // 1. Pedimos a Moodle los contenidos del curso
    const data = await this.moodleService.request('core_course_get_contents', {
      courseid: courseId,
    });

    if (!data || data.exception) {
      throw new NotFoundException(`No se pudieron cargar los contenidos del curso ${courseId}`);
    }

    const contenidosDidacticos = ['label', 'resource', 'book', 'lesson', 'glossary', 'page'];
    const tareas = ['assign'];
    const tests = ['quiz']; // El test lo podés dejar acá o después sacarlo a su propio módulo si querés

    return data.map((section: any) => {
      const contenidos = section.modules
        .filter((mod: any) => [...contenidosDidacticos, ...tareas, ...tests].includes(mod.modname))
        .map((mod: any) => {
          
          // 🧠 DELEGACIÓN MODULAR: Cada servicio se encarga de lo suyo
          if (tareas.includes(mod.modname)) {
            return this.tasksService.formatTask(mod);
          }
          
          if (contenidosDidacticos.includes(mod.modname)) {
            return this.lessonsService.formatLesson(mod);
          }

          // Fallback para los tests por ahora
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
        modules: contenidos,
      };
    });
  }
}
//     // 2. Definimos los recursos permitidos según tu regla
//     const modulosPermitidos = ['label', 'resource', 'quiz', 'book', 'lesson', 'glossary', 'assign', 'page'];

//     // 3. Limpiamos y clasificamos la data
//     const seccionesLimpias = data.map((section: any) => {
      
//       // Filtramos solo los módulos que nos interesan
//       const modulosFiltrados = section.modules.filter((mod: any) => 
//         modulosPermitidos.includes(mod.modname)
//       );

//       // Los mapeamos para que el Frontend los consuma fácil
//       const contenidos = modulosFiltrados.map((mod: any) => {
        
//         // Clasificamos el tipo para el Frontend (Didáctico, Tarea o Test)
//         let category = 'contenido_didactico';
//         if (mod.modname === 'assign') category = 'tarea';
//         if (mod.modname === 'quiz') category = 'test';

//         return {
//           id: mod.id,
//           name: mod.name,
//           type: mod.modname, // label, resource, quiz, etc.
//           category: category, 
//           description: mod.description || '', // Acá suelen venir los textos y multimedia (imágenes/audios embebidos)
//           url: mod.url || '', // La URL directa al recurso si hace falta
//           // Si es un archivo (como un PDF), Moodle lo manda adentro de 'contents'
//           fileUrl: mod.contents && mod.contents.length > 0 ? mod.contents[0].fileurl : null,
//         };
//       });

//       return {
//         id: section.id,
//         name: section.name, // Ej: "Unidad 1" o "Tema 1"
//         summary: section.summary || '',
//         modules: contenidos,
//       };
//     });

//     return seccionesLimpias;
//   }
// }

