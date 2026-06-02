import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseFolder } from './entities/course-folder.entity';
import { CourseFolderLink } from './entities/course-folder-link.entity';
import { CreateCourseFolderDto } from './dto/create-course-folder.dto';
import { UpdateCourseFolderDto } from './dto/update-course-folder.dto';
import { AssignCourseToFolderDto } from './dto/assign-course.dto';
import { CoursesService, MoodleCourseSummary } from './courses.service';

export interface CourseInTree extends MoodleCourseSummary {
  linkId: number;
  sortOrder: number;
}

export interface CourseFolderTreeNode {
  id: number;
  parentId: number | null;
  name: string;
  slug: string | null;
  sortOrder: number;
  children: CourseFolderTreeNode[];
  courses: CourseInTree[];
}

@Injectable()
export class CoursesCatalogService {
  constructor(
    @InjectRepository(CourseFolder)
    private readonly folderRepo: Repository<CourseFolder>,
    @InjectRepository(CourseFolderLink)
    private readonly linkRepo: Repository<CourseFolderLink>,
    private readonly coursesService: CoursesService,
  ) {}

  /**
   * Árbol para el alumno: carpetas + cursos Moodle asignados.
   * Solo incluye cursos a los que el usuario está inscripto (token Moodle).
   */
  async getTreeForStudent(moodleUserToken?: string): Promise<CourseFolderTreeNode[]> {
    const allCourses = await this.coursesService.findAllForUser(moodleUserToken);
    const allowedIds = new Set(allCourses.map((c) => c.id));
    return this.buildTree(allCourses, allowedIds);
  }

  /** Árbol completo para admin (todos los cursos Moodle). */
  async getTreeForAdmin(): Promise<CourseFolderTreeNode[]> {
    const allCourses = await this.coursesService.findAll();
    const allowedIds = new Set(allCourses.map((c) => c.id));
    return this.buildTree(allCourses, allowedIds);
  }

  async createFolder(dto: CreateCourseFolderDto): Promise<CourseFolder> {
    if (dto.parentId != null) await this.ensureFolder(dto.parentId);
    const folder = this.folderRepo.create({
      name: dto.name,
      parentId: dto.parentId ?? null,
      slug: dto.slug ?? null,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.folderRepo.save(folder);
  }

  async updateFolder(id: number, dto: UpdateCourseFolderDto): Promise<CourseFolder> {
    const folder = await this.ensureFolder(id);

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('Una carpeta no puede ser padre de sí misma');
      }
      if (dto.parentId != null) {
        await this.ensureFolder(dto.parentId);
        if (await this.isDescendant(dto.parentId, id)) {
          throw new BadRequestException('No se puede mover: crearía un ciclo en el árbol');
        }
      }
      folder.parentId = dto.parentId;
    }

    if (dto.name !== undefined) folder.name = dto.name;
    if (dto.slug !== undefined) folder.slug = dto.slug;
    if (dto.sortOrder !== undefined) folder.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) folder.isActive = dto.isActive;

    return this.folderRepo.save(folder);
  }

  async deleteFolder(id: number): Promise<{ message: string; deletedFolderId: number }> {
    await this.ensureFolder(id);
    const subfolders = await this.folderRepo.count({ where: { parentId: id } });
    const links = await this.linkRepo.count({ where: { folderId: id } });

    await this.folderRepo.delete(id);

    return {
      deletedFolderId: id,
      message:
        subfolders > 0 || links > 0
          ? `Carpeta eliminada junto con ${subfolders} subcarpeta(s) y ${links} enlace(s) a cursos. Los cursos en Moodle no se borraron.`
          : 'Carpeta eliminada correctamente.',
    };
  }

  async assignCourse(folderId: number, dto: AssignCourseToFolderDto): Promise<CourseFolderLink> {
    await this.ensureFolder(folderId);
    const moodleCourseId = Number(dto.moodleCourseId);
    if (!Number.isInteger(moodleCourseId) || moodleCourseId <= 0) {
      throw new BadRequestException('moodleCourseId inválido');
    }

    const existing = await this.linkRepo.findOne({ where: { folderId, moodleCourseId } });
    if (existing) return existing;

    const link = this.linkRepo.create({
      folderId,
      moodleCourseId,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.linkRepo.save(link);
  }

  async unassignCourse(linkId: number): Promise<void> {
    const result = await this.linkRepo.delete(linkId);
    if (!result.affected) throw new NotFoundException(`Enlace ${linkId} no encontrado`);
  }

  async seedDefaultFolders(): Promise<{ message: string }> {
    const existing = await this.folderRepo.findOne({ where: { slug: 'mis-cursos' } });
    if (existing) return { message: 'Las carpetas ya existen' };

    const root = await this.createFolder({ name: 'Mis Cursos', slug: 'mis-cursos' });
    await this.createFolder({ name: 'B1', parentId: root.id, slug: 'b1' });
    await this.createFolder({ name: 'B2', parentId: root.id, slug: 'b2', sortOrder: 1 });

    return {
      message:
        'Carpetas creadas. Asigná cursos Moodle desde el admin (cada curso se crea en Moodle).',
    };
  }

  private async buildTree(
    moodleCourses: MoodleCourseSummary[],
    allowedIds: Set<number>,
  ): Promise<CourseFolderTreeNode[]> {
    const folders = await this.folderRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    const links = await this.linkRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
    const courseMap = new Map(moodleCourses.map((c) => [c.id, c]));

    const build = (parentId: number | null): CourseFolderTreeNode[] =>
      folders
        .filter((f) => f.parentId === parentId)
        .map((folder) => {
          const folderLinks = links.filter((l) => l.folderId === folder.id);
          const courses: CourseInTree[] = folderLinks
            .filter((l) => allowedIds.has(l.moodleCourseId) && courseMap.has(l.moodleCourseId))
            .map((l) => ({
              ...courseMap.get(l.moodleCourseId)!,
              linkId: l.id,
              sortOrder: l.sortOrder,
            }))
            .sort((a, b) => a.sortOrder - b.sortOrder);

          return {
            id: folder.id,
            parentId: folder.parentId,
            name: folder.name,
            slug: folder.slug,
            sortOrder: folder.sortOrder,
            children: build(folder.id),
            courses,
          };
        });

    return build(null);
  }

  private async isDescendant(ancestorId: number, nodeId: number): Promise<boolean> {
    let current = await this.folderRepo.findOne({ where: { id: ancestorId } });
    while (current?.parentId != null) {
      if (current.parentId === nodeId) return true;
      current = await this.folderRepo.findOne({ where: { id: current.parentId } });
    }
    return false;
  }

  private async ensureFolder(id: number): Promise<CourseFolder> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('ID de carpeta inválido');
    }
    const folder = await this.folderRepo.findOne({ where: { id } });
    if (!folder) throw new NotFoundException(`Carpeta ${id} no encontrada`);
    return folder;
  }
}
