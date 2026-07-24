import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MoodleService } from '../moodle/moodle.service';
import { MoodleModuleRaw } from '../moodle/moodle.types';

interface MoodleAssignCourse {
  assignments?: Array<{ id: number; [key: string]: unknown }>;
}

interface MoodleUploadResult {
  itemid?: number;
  exception?: string;
  message?: string;
}

interface MoodleWarning {
  warningcode?: string;
  message?: string;
}

@Injectable()
export class TasksService {
  constructor(private readonly moodleService: MoodleService) {}

  formatTask(mod: MoodleModuleRaw) {
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

  async getTask(assignId: number) {
    const data = await this.moodleService.request<{ courses?: MoodleAssignCourse[] }>(
      'mod_assign_get_assignments',
      { 'courseids[0]': 0 },
    );

    if (!data?.courses) {
      throw new NotFoundException('No se pudieron cargar las tareas');
    }

    for (const course of data.courses) {
      const assign = course.assignments?.find((a) => a.id === assignId);
      if (assign) return assign;
    }

    throw new NotFoundException(`Tarea ${assignId} no encontrada`);
  }

  async getSubmissionStatus(assignId: number, userToken?: string) {
    return this.moodleService.request(
      'mod_assign_get_submission_status',
      { assignid: assignId },
      userToken,
    );
  }

  async submitTask(
    assignId: number,
    userToken: string,
    options: {
      userId?: number;
      text?: string;
      fileName?: string;
      fileBase64?: string;
      fileMimeType?: string;
    } = {},
  ) {
    const { userId, text, fileName, fileBase64 } = options;
    let fileItemId = '0';

    if (fileName && fileBase64) {
      const uploadData = await this.moodleService.requestPostForm<MoodleUploadResult>(
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

      if (uploadData?.itemid) {
        fileItemId = uploadData.itemid.toString();
      }
    }

    const data = await this.moodleService.request<MoodleWarning[] | Record<string, unknown>>(
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

    if (Array.isArray(data) && data.length > 0 && data[0].warningcode) {
      throw new BadGatewayException(data[0].message || 'Moodle rechazó la entrega');
    }

    return { success: true, message: 'Tarea entregada correctamente' };
  }
}
