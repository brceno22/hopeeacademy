/** Usuario Moodle autenticado adjunto a la request por MoodleAuthGuard. */
export interface MoodleUser {
  userId: number;
  token: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: MoodleUser;
    }
  }
}

export {};
