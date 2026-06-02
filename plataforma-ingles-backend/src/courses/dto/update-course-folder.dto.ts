export class UpdateCourseFolderDto {
  name?: string;
  parentId?: number | null;
  slug?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}
