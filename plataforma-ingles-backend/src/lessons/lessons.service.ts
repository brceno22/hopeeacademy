import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { MoodleService } from '../moodle/moodle.service';

@Injectable()
export class LessonsService {
  // Inyectamos el servicio de Moodle
  constructor(private readonly moodleService: MoodleService) {}

  formatLesson(mod: any) {
    return {
      id: mod.id,
      name: mod.name,
      type: mod.modname?.replace(/"/g, '').trim(),
      category: 'contenido_didactico',
      description: mod.description || '',
      url: mod.url || '',
      fileUrl: mod.contents && mod.contents.length > 0 ? mod.contents[0].fileurl : null,
      instanceId: mod.instance, // 💡 MUY IMPORTANTE: Este es el ID real de la lección para buscar sus preguntas
    };
  }

  // 👇 NUEVA FUNCIÓN: Trae las páginas y preguntas de la lección
 async getLessonPages(instanceId: number) {
    // 1. Pedimos el esqueleto (las páginas)
    const data = await this.moodleService.request('mod_lesson_get_pages', {
      lessonid: instanceId,
    });

    
    

    if (!data || data.exception) {
      throw new NotFoundException(`No se pudieron cargar las páginas. Moodle dice: ${data?.message}`);
    }

    // 2. Buscamos la "carne" (las opciones) de cada página simultáneamente
    const paginasCompletas = await Promise.all(
      data.pages.map(async (item: any) => {
        try {
          const pageData = await this.moodleService.request('mod_lesson_get_page_data', {
            lessonid: instanceId,
            pageid: item.page.id,
          });
          console.log(`📄 Page ${item.page.id} type:`, item.page.type, '| answers:', JSON.stringify(pageData.answers));

          return {
            ...item,
            // 💡 Inyectamos las opciones reales que Moodle nos devuelve en el array 'answers'
            opciones: pageData.answers || [],
          };
        } catch (error) {
          console.error(`Error al traer datos de la página ${item.page.id}:`, error);
          return { ...item, opciones: [] };
        }
      })
    );

    return paginasCompletas; // Devolvemos el JSON enriquecido a React
  }
  // 👇 NUEVA FUNCIÓN: Procesa las respuestas
  // 👇 VERSIÓN DEFINITIVA CON APERTURA DE INTENTO
  // 👇 Recibe el token del alumno como tercer parámetro
  async submitLessonAnswers(
    instanceId: number,
    respuestas: Record<number, number>,
    userToken: string,
    ) {
    try {
    // 1. Abrir intento
      const launch = await this.moodleService.request(
        'mod_lesson_launch_attempt',
        { lessonid: instanceId },
        userToken,
      );
      if (launch?.exception) {
        throw new Error(`No se pudo iniciar: ${launch.message}`);
      }

      // 2. Enviar respuestas secuencialmente
      for (const [pageId, opcionId] of Object.entries(respuestas)) {
      console.log(`📤 Enviando → pageId: ${pageId}, opcionId: ${opcionId}`);

      const result = await this.moodleService.request(
        'mod_lesson_process_page',
        {
          lessonid: instanceId,
          pageid: parseInt(pageId),
          // ✅ El ID de la opción va como NOMBRE del campo, no como valor
          [`data[0][name]`]: opcionId.toString(),
          [`data[0][value]`]: opcionId.toString(),
        },
        userToken,
      );

      console.log(`📥 Resultado página ${pageId}:`, JSON.stringify(result));

      if (result?.exception) {
        throw new Error(`Error en página ${pageId}: ${result.message}`);
      }
    }

    // 3. ✅ NUEVO: Cerrar el intento correctamente
      const finish = await this.moodleService.request(
        'mod_lesson_finish_attempt',
        {
          lessonid: instanceId,
          password: '',
          review: 0,
          outoftime: 0,
        },
        userToken,
      );
      if (finish?.exception) {
        throw new Error(`No se pudo cerrar el intento: ${finish.message}`);
      }

      return { success: true, message: 'Examen guardado correctamente' };

    } catch (error: any) {
      console.error('🚨 Error al enviar a Moodle:', error.message);
      // Propagamos el mensaje real en lugar de uno genérico
      throw new HttpException(
        error.message || 'No se pudo guardar el examen en Moodle.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

}