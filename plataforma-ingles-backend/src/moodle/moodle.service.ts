import { Injectable } from '@nestjs/common';
import { MoodleClientService } from './moodle-client.service';
import { MoodleEnrolmentService } from './moodle-enrolment.service';
import { MoodleDirectoryUser, MoodleUsersService } from './moodle-users.service';
import { MoodleParams } from './moodle.types';

export type { MoodleDirectoryUser };

@Injectable()
export class MoodleService {
  constructor(
    private readonly client: MoodleClientService,
    private readonly users: MoodleUsersService,
    private readonly enrolment: MoodleEnrolmentService,
  ) {}

  request<T = unknown>(wsFunction: string, extraParams: MoodleParams = {}, userToken?: string) {
    return this.client.request<T>(wsFunction, extraParams, userToken);
  }

  requestPostForm<T = unknown>(
    wsFunction: string,
    extraParams: MoodleParams = {},
    userToken?: string,
  ) {
    return this.client.requestPostForm<T>(wsFunction, extraParams, userToken);
  }

  getUserIdFromToken(userToken: string) {
    return this.enrolment.getUserIdFromToken(userToken);
  }

  getSiteInfo(userToken: string) {
    return this.enrolment.getSiteInfo(userToken);
  }

  getUserCourses(userToken: string, userId: number) {
    return this.enrolment.getUserCourses(userToken, userId);
  }

  getEnrolledUsers(userToken: string, courseId: number) {
    return this.enrolment.getEnrolledUsers(userToken, courseId);
  }

  hasTeacherRole(roles?: { shortname?: string }[]) {
    return this.enrolment.hasTeacherRole(roles);
  }

  isStudentRole(roles?: { shortname?: string }[]) {
    return this.enrolment.isStudentRole(roles);
  }

  isTeacherInCourse(userToken: string, courseId: number, userId?: number) {
    return this.enrolment.isTeacherInCourse(userToken, courseId, userId);
  }

  isEnrolledInCourse(userToken: string, courseId: number, userId?: number) {
    return this.enrolment.isEnrolledInCourse(userToken, courseId, userId);
  }

  getUsersByIds(userIds: number[], userToken?: string) {
    return this.users.getUsersByIds(userIds, userToken);
  }

  searchUsers(query: string, limit = 20) {
    return this.users.searchUsers(query, limit);
  }

  getStudentRoleId() {
    return this.enrolment.getStudentRoleId();
  }

  getTeacherRoleId() {
    return this.enrolment.getTeacherRoleId();
  }

  enrolUsers(enrolments: Array<{ courseId: number; userId: number; roleId: number }>) {
    return this.enrolment.enrolUsers(enrolments);
  }

  unenrolUsers(enrolments: Array<{ courseId: number; userId: number }>) {
    return this.enrolment.unenrolUsers(enrolments);
  }
}
