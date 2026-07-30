/** Respuesta de error estándar de Moodle Web Services */
export interface MoodleExceptionPayload {
  exception?: string;
  errorcode?: string;
  message?: string;
  debuginfo?: string;
}

export interface MoodleSiteInfo {
  userid: number;
  username: string;
  fullname: string;
  sitename?: string;
  userpictureurl?: string;
  [key: string]: unknown;
}

export interface MoodleCourseRaw {
  id: number;
  fullname?: string;
  displayname?: string;
  shortname?: string;
  summary?: string;
  format?: string;
  [key: string]: unknown;
}

export interface MoodleModuleRaw {
  id: number;
  name: string;
  modname: string;
  instance?: number;
  description?: string;
  url?: string;
  contents?: Array<{
    fileurl?: string;
    filename?: string;
    mimetype?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface MoodleSectionRaw {
  id: number;
  name: string;
  summary?: string;
  modules?: MoodleModuleRaw[];
  [key: string]: unknown;
}

export type MoodleParams = Record<string, string | number | boolean | undefined | null>;

export interface MoodleRole {
  roleid: number;
  name?: string;
  shortname: string;
  sortorder?: number;
}

export interface MoodleEnrolledUser {
  id: number;
  username?: string;
  firstname?: string;
  lastname?: string;
  fullname?: string;
  email?: string;
  roles?: MoodleRole[];
}

export interface MoodleUserCourse {
  id: number;
  fullname?: string;
  displayname?: string;
  shortname?: string;
}
