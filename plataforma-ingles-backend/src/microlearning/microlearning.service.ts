import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MicrolearningContent } from './microlearning-content.entity';
import { UserMicrolearningHistory } from './user-microlearning-history.entity';
import { UserStreak } from './user-streak.entity';
import { MoodleService } from '../moodle/moodle.service';
import { CreateMicrolearningDto } from './dto/microlearning.dto';

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
  ) {}

  // Helper para obtener fecha local en formato YYYY-MM-DD
  private getLocalDateString(date: Date = new Date()): string {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().split('T')[0];
  }

  async createBulkContent(contents: CreateMicrolearningDto[]) {
    return this.contentRepo.save(contents);
  }

  async getTodayContent(token: string) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const todayStr = this.getLocalDateString(); // YYYY-MM-DD

    // 1. Definimos el inicio y fin del día de hoy para buscar en el historial
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 2. Verificar si el usuario YA completó alguna píldora HOY
    const todayHistory = await this.historyRepo.createQueryBuilder('history')
      .where('history.userId = :userId', { userId })
      .andWhere('history.viewedAt >= :start AND history.viewedAt <= :end', { start: startOfDay, end: endOfDay })
      .getOne();

    let content: MicrolearningContent | null = null;
    let todayCompleted = false;

    if (todayHistory) {
      // SI YA COMPLETÓ: Traemos exactamente la píldora que resolvió hoy
      todayCompleted = true;
      content = await this.contentRepo.findOne({ where: { id: todayHistory.contentId } });
    } else {
      // NO COMPLETÓ: Elegimos una al azar del catálogo que todavía NO HAYA VISTO
      todayCompleted = false;

      // Buscamos todo lo que ya vio en su historia para excluirlo
      const allHistory = await this.historyRepo.find({ where: { userId } });
      const viewedIds = allHistory.map(h => h.contentId);

      // Traemos las píldoras que NO están en esa lista
      let allUnseen = await this.contentRepo.createQueryBuilder('content')
        .where('content.id NOT IN (:...viewedIds)', { viewedIds: viewedIds.length > 0 ? viewedIds : [0] })
        .getMany();

      // Si ya vio absolutamente todo el catálogo, reiniciamos y le permitimos ver cualquiera
      if (allUnseen.length === 0) {
        allUnseen = await this.contentRepo.find();
      }

      if (allUnseen.length > 0) {
        // Generamos un índice "aleatorio pero fijo por día" usando su userId y la fecha.
        // Esto evita que cambie de palabra cada vez que refresca la pantalla.
        let hash = 0;
        const seedStr = todayStr + userId;
        for (let i = 0; i < seedStr.length; i++) {
          hash += seedStr.charCodeAt(i);
        }
        const randomIndex = hash % allUnseen.length;
        content = allUnseen[randomIndex];
      }
    }

    // Si la base de datos está completamente vacía, tiramos el error
    if (!content) {
      throw new NotFoundException('No hay contenidos cargados en el catálogo de Microlearning.');
    }

    // 3. CÁLCULO DE LA RACHA (Misma lógica sólida de antes)
    let currentStreak = 0;
    const streakRecord = await this.streakRepo.findOne({ where: { userId } });
    
    if (streakRecord) {
      currentStreak = streakRecord.currentStreak;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = this.getLocalDateString(yesterday);

      // Si no completó hoy y la última actividad fue antes de ayer, la racha visual se muestra en 0
      if (!todayCompleted && streakRecord.lastActiveDate && streakRecord.lastActiveDate < yesterdayStr) {
        currentStreak = 0;
      }
    }

    return {
      content,
      todayCompleted,
      currentStreak,
    };
  }

  async markAsCompleted(token: string, contentId: number) {
    const userId = await this.moodleService.getUserIdFromToken(token);
    const todayStr = this.getLocalDateString();

    // Verificamos si ya existe (idempotente)
    const existingHistory = await this.historyRepo.findOne({
      where: { userId, contentId },
    });

    if (existingHistory) {
      const streak = await this.streakRepo.findOne({ where: { userId } });
      return { success: true, currentStreak: streak?.currentStreak || 1, message: 'Ya estaba completado' };
    }

    // Guardar en el historial
    const newHistory = this.historyRepo.create({ userId, contentId });
    await this.historyRepo.save(newHistory);

    // Lógica de Racha
    let streak = await this.streakRepo.findOne({ where: { userId } });
    
    if (!streak) {
      // Primera vez en su vida
      streak = this.streakRepo.create({ userId, currentStreak: 1, lastActiveDate: todayStr });
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = this.getLocalDateString(yesterday);

      if (streak.lastActiveDate === yesterdayStr) {
        // Racha mantenida
        streak.currentStreak += 1;
      } else if (streak.lastActiveDate !== todayStr) {
        // Racha rota (pasó más de un día sin entrar)
        streak.currentStreak = 1;
      }
      // Actualizamos la fecha a hoy
      streak.lastActiveDate = todayStr;
    }

    await this.streakRepo.save(streak);

    return { success: true, currentStreak: streak.currentStreak };
  }

  async createAdminContent(data: CreateMicrolearningDto) {
    const newContent = this.contentRepo.create(data);
    return this.contentRepo.save(newContent);
  }
}