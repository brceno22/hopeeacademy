import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { addDaysInAppTz, dateStringInAppTz } from '../common/timezone.util';
import { MoodleService } from '../moodle/moodle.service';
import { CreateMicrolearningDto } from './dto/microlearning.dto';
import { MicrolearningContent } from './microlearning-content.entity';
import { UserMicrolearningHistory } from './user-microlearning-history.entity';
import { UserStreak } from './user-streak.entity';

@Injectable()
export class MicrolearningService {
  constructor(
    @InjectRepository(MicrolearningContent)
    private contentRepo: Repository<MicrolearningContent>,
    @InjectRepository(UserMicrolearningHistory)
    private historyRepo: Repository<UserMicrolearningHistory>,
    @InjectRepository(UserStreak)
    private streakRepo: Repository<UserStreak>,
    private moodleService: MoodleService,
    private dataSource: DataSource,
  ) {}

  private getLocalDateString(date: Date = new Date()): string {
    return dateStringInAppTz(date);
  }

  async createBulkContent(contents: CreateMicrolearningDto[]) {
    return this.contentRepo.save(contents);
  }

  /** Contenido asignado hoy (seed estable por userId+fecha). */
  async resolveTodayContentId(userId: number): Promise<number | null> {
    const todayStr = this.getLocalDateString();
    const startOfDay = new Date(`${todayStr}T00:00:00`);
    const endOfDay = new Date(`${todayStr}T23:59:59.999`);

    const todayHistory = await this.historyRepo
      .createQueryBuilder('history')
      .where('history.userId = :userId', { userId })
      .andWhere('history.viewedAt >= :start AND history.viewedAt <= :end', {
        start: startOfDay,
        end: endOfDay,
      })
      .getOne();

    if (todayHistory) return todayHistory.contentId;

    const allHistory = await this.historyRepo.find({ where: { userId } });
    const viewedIds = allHistory.map((h) => h.contentId);

    let allUnseen = await this.contentRepo
      .createQueryBuilder('content')
      .where('content.id NOT IN (:...viewedIds)', {
        viewedIds: viewedIds.length > 0 ? viewedIds : [0],
      })
      .getMany();

    if (allUnseen.length === 0) {
      allUnseen = await this.contentRepo.find();
    }

    if (allUnseen.length === 0) return null;

    let hash = 0;
    const seedStr = todayStr + userId;
    for (let i = 0; i < seedStr.length; i++) {
      hash += seedStr.charCodeAt(i);
    }
    return allUnseen[hash % allUnseen.length].id;
  }

  async getTodayContent(token: string, knownUserId?: number) {
    const userId = knownUserId ?? (await this.moodleService.getUserIdFromToken(token));
    const todayStr = this.getLocalDateString();
    const startOfDay = new Date(`${todayStr}T00:00:00`);
    const endOfDay = new Date(`${todayStr}T23:59:59.999`);

    const todayHistory = await this.historyRepo
      .createQueryBuilder('history')
      .where('history.userId = :userId', { userId })
      .andWhere('history.viewedAt >= :start AND history.viewedAt <= :end', {
        start: startOfDay,
        end: endOfDay,
      })
      .getOne();

    let content: MicrolearningContent | null = null;
    let todayCompleted = false;

    if (todayHistory) {
      todayCompleted = true;
      content = await this.contentRepo.findOne({ where: { id: todayHistory.contentId } });
    } else {
      const assignedId = await this.resolveTodayContentId(userId);
      if (assignedId) {
        content = await this.contentRepo.findOne({ where: { id: assignedId } });
      }
    }

    if (!content) {
      throw new NotFoundException('No hay contenidos cargados en el catálogo de Microlearning.');
    }

    let currentStreak = 0;
    const streakRecord = await this.streakRepo.findOne({ where: { userId } });

    if (streakRecord) {
      currentStreak = streakRecord.currentStreak;
      const yesterdayStr = addDaysInAppTz(new Date(), -1);

      if (
        !todayCompleted &&
        streakRecord.lastActiveDate &&
        streakRecord.lastActiveDate < yesterdayStr
      ) {
        currentStreak = 0;
      }
    }

    return {
      content,
      todayCompleted,
      currentStreak,
    };
  }

  async markAsCompleted(token: string, contentId: number, knownUserId?: number) {
    const userId = knownUserId ?? (await this.moodleService.getUserIdFromToken(token));
    const todayStr = this.getLocalDateString();

    const assignedId = await this.resolveTodayContentId(userId);
    if (assignedId == null || assignedId !== contentId) {
      throw new BadRequestException('Solo podés completar la píldora asignada para hoy');
    }

    const existingHistory = await this.historyRepo.findOne({
      where: { userId, contentId },
    });

    if (existingHistory) {
      const streak = await this.streakRepo.findOne({ where: { userId } });
      return {
        success: true,
        currentStreak: streak?.currentStreak || 1,
        message: 'Ya estaba completado',
      };
    }

    return this.dataSource.transaction(async (manager) => {
      const historyRepo = manager.getRepository(UserMicrolearningHistory);
      const streakRepo = manager.getRepository(UserStreak);

      await historyRepo.save(historyRepo.create({ userId, contentId }));

      let streak = await streakRepo.findOne({ where: { userId } });
      const yesterdayStr = addDaysInAppTz(new Date(), -1);

      if (!streak) {
        streak = streakRepo.create({ userId, currentStreak: 1, lastActiveDate: todayStr });
      } else if (streak.lastActiveDate === yesterdayStr) {
        streak.currentStreak += 1;
        streak.lastActiveDate = todayStr;
      } else if (streak.lastActiveDate !== todayStr) {
        streak.currentStreak = 1;
        streak.lastActiveDate = todayStr;
      } else {
        streak.lastActiveDate = todayStr;
      }

      await streakRepo.save(streak);
      return { success: true, currentStreak: streak.currentStreak };
    });
  }

  async createAdminContent(data: CreateMicrolearningDto) {
    const newContent = this.contentRepo.create(data);
    return this.contentRepo.save(newContent);
  }
}
