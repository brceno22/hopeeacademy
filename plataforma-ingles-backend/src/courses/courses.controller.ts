import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { extractOptionalBearerToken } from '../auth/auth-token.util';
import { CoursesCatalogService } from './courses-catalog.service';
import { CoursesService } from './courses.service';
import { AssignCourseToFolderDto } from './dto/assign-course.dto';
import { CreateCourseFolderDto } from './dto/create-course-folder.dto';
import { UpdateCourseFolderDto } from './dto/update-course-folder.dto';

@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly catalogService: CoursesCatalogService,
  ) {}

  /** Listado plano. Token opcional: Bearer del alumno. */
  @Get()
  findAll(@Headers('authorization') auth?: string) {
    return this.coursesService.findAllForUser(extractOptionalBearerToken(auth));
  }

  /**
   * Mis Cursos en jerarquía: carpetas + cursos Moodle asignados.
   * El contenido del curso sigue en GET /courses/:id/contents
   */
  @Get('tree')
  getTree(@Headers('authorization') auth?: string) {
    return this.catalogService.getTreeForStudent(extractOptionalBearerToken(auth));
  }

  @UseGuards(AdminGuard)
  @Get('admin/tree')
  getAdminTree() {
    return this.catalogService.getTreeForAdmin();
  }

  @UseGuards(AdminGuard)
  @Get('admin/moodle-courses')
  listMoodleCourses() {
    return this.coursesService.findAll();
  }

  @UseGuards(AdminGuard)
  @Post('admin/folders')
  createFolder(@Body() body: CreateCourseFolderDto) {
    return this.catalogService.createFolder(body);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/folders/:id')
  updateFolder(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCourseFolderDto,
  ) {
    return this.catalogService.updateFolder(id, body);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/folders/:id')
  deleteFolder(@Param('id', ParseIntPipe) id: number) {
    return this.catalogService.deleteFolder(id);
  }

  @UseGuards(AdminGuard)
  @Post('admin/folders/:folderId/courses')
  assignCourse(
    @Param('folderId', ParseIntPipe) folderId: number,
    @Body() body: AssignCourseToFolderDto,
  ) {
    return this.catalogService.assignCourse(folderId, body);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/links/:linkId')
  unassignCourse(@Param('linkId', ParseIntPipe) linkId: number) {
    return this.catalogService.unassignCourse(linkId);
  }

  @UseGuards(AdminGuard)
  @Post('admin/seed-folders')
  seedFolders() {
    return this.catalogService.seedDefaultFolders();
  }

  @Get(':id/contents')
  getCourseContents(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.getCourseContents(id);
  }
}
