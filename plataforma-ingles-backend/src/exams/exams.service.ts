import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateExamDto, UpdateExamDto } from './dto/exam.dto';
import { Attempt } from './entities/attempt.entity';
import { Exam } from './entities/exam.entity';

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(Exam)
    private readonly examRepo: Repository<Exam>,
    @InjectRepository(Attempt)
    private readonly attemptRepo: Repository<Attempt>,
  ) {}

  async getExamsByCourse(courseId: number): Promise<Exam[]> {
    return this.examRepo.find({ where: { courseId, active: true } });
  }

  async getExamById(id: number): Promise<Exam> {
    const exam = await this.examRepo.findOne({ where: { id } });
    if (!exam) throw new NotFoundException('Examen no encontrado');
    return exam;
  }

  async createExam(data: CreateExamDto): Promise<Exam> {
    const exam = this.examRepo.create(data as Exam);
    return this.examRepo.save(exam) as Promise<Exam>;
  }

  async submitAttempt(examId: number, userId: number, answers: Record<number, number>) {
    const exam = await this.getExamById(examId);

    let correct = 0;
    const total = exam.questions.length;

    for (const question of exam.questions) {
      const selectedOptionId = answers[question.id];
      if (!selectedOptionId) continue;

      const selectedOption = question.options.find((o) => o.id === selectedOptionId);
      if (selectedOption?.isCorrect) correct++;
    }

    const score = total > 0 ? Math.round((correct / total) * 100) : 0;

    const attempt = this.attemptRepo.create({
      examId,
      userId,
      score,
      answers,
    });
    await this.attemptRepo.save(attempt);

    return {
      success: true,
      score,
      correct,
      total,
      message: score >= 60 ? '¡Aprobado! 🎉' : 'No aprobado. Podés intentarlo de nuevo.',
    };
  }

  async getAttemptsByUser(examId: number, userId: number) {
    return this.attemptRepo.find({
      where: { examId, userId },
      order: { finishedAt: 'DESC' },
    });
  }

  async getAllExams(): Promise<Exam[]> {
    return this.examRepo.find({ order: { createdAt: 'DESC' } });
  }

  async updateExam(id: number, data: UpdateExamDto): Promise<Exam> {
    const exam = await this.getExamById(id);

    exam.title = data.title ?? exam.title;
    exam.description = data.description ?? exam.description;
    exam.active = data.active ?? exam.active;
    exam.courseId = data.courseId ?? exam.courseId;

    if (data.questions) {
      exam.questions = data.questions as Exam['questions'];
    }

    return this.examRepo.save(exam);
  }

  async deleteExam(id: number): Promise<{ message: string }> {
    const exam = await this.getExamById(id);
    await this.examRepo.remove(exam);
    return { message: 'Examen eliminado' };
  }
}
