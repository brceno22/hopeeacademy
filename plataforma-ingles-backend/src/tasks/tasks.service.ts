import { Injectable, NotFoundException } from '@nestjs/common';
import { MoodleService } from '../moodle/moodle.service';

@Injectable()
export class TasksService {
  constructor(private readonly moodleService: MoodleService) {}
  formatTask(mod: any) {
  return {
    id: mod.id,
    name: mod.name,
    type: mod.modname,
    category: 'tarea',
    description: mod.description || '',
    url: mod.url || '',
    fileUrl: mod.contents && mod.contents.length > 0 ? mod.contents[0].fileurl : null,
    instanceId: mod.instance,
  };
}

  // Traer detalle de la tarea
  async getTask(assignId: number) {
    const data = await this.moodleService.request('mod_assign_get_assignments', {
      'courseids[0]': 0, // 0 = todos los cursos
    });

    if (!data?.courses) {
      throw new NotFoundException('No se pudieron cargar las tareas');
    }

    // Buscamos la tarea por su instanceId
    for (const course of data.courses) {
      const assign = course.assignments?.find((a: any) => a.id === assignId);
      if (assign) return assign;
    }

    throw new NotFoundException(`Tarea ${assignId} no encontrada`);
  }

  // Estado de entrega del alumno
  async getSubmissionStatus(assignId: number, userToken?: string) {
    const data = await this.moodleService.request(
      'mod_assign_get_submission_status',
      { assignid: assignId },
      userToken,
    );
    return data;
  }

  // Entregar tarea con texto
  async submitTask(
      assignId: number,
      userToken: string,
      options: {
        userId?: number;
        text?: string;
        fileName?: string;
        fileBase64?: string;
        fileMimeType?: string;
      } = {}
    ) {
      const { userId, text, fileName, fileBase64 } = options;
      let fileItemId = '0';

      // 1. Si hay archivo, lo subimos primero
      if (fileName && fileBase64) {
        console.log('📎 Subiendo archivo:', fileName);
        
        const uploadData = await this.moodleService.requestPostForm(
          'core_files_upload',
          {
            component: 'user',
            filearea: 'draft',
            itemid: '0',
            filepath: '/',
            filename: fileName,
            filecontent: fileBase64,
            contextlevel: 'user',
            
            instanceid: String(userId ?? 0),
          },
          userToken,
        );
        
        
        console.log('📎 Upload respuesta COMPLETA:', JSON.stringify(uploadData));
        console.log('📎 Upload respuesta:', JSON.stringify(uploadData));

        if (uploadData?.itemid) {
          fileItemId = uploadData.itemid.toString();
        } else if (uploadData?.exception) {
          throw new Error(`Error al subir archivo: ${uploadData.message}`);
        }
      }

      // 2. Enviamos la entrega con texto y/o archivo
      const data = await this.moodleService.request(
        'mod_assign_save_submission',
        {
          assignmentid: assignId,
          'plugindata[onlinetext_editor][text]': text || '',
          'plugindata[onlinetext_editor][format]': '1',
          'plugindata[onlinetext_editor][itemid]': '0',
          'plugindata[files_filemanager]': fileItemId,
        },
        userToken,
      );

      console.log('📝 Submit respuesta:', JSON.stringify(data));
      

      if (Array.isArray(data) && data.length > 0 && data[0].warningcode) {
        throw new Error(data[0].message);
      }

      return { success: true, message: 'Tarea entregada correctamente' };
      
    }
    
}