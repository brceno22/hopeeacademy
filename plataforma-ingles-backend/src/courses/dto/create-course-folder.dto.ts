export class CreateCourseFolderDto {
  name!: string;
  parentId?: number | null;
  slug?: string | null;
  sortOrder?: number;
}
