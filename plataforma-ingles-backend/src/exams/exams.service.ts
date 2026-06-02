import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exam } from './entities/exam.entity';
import { Attempt } from './entities/attempt.entity';

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(Exam)
    private readonly examRepo: Repository<Exam>,
    @InjectRepository(Attempt)
    private readonly attemptRepo: Repository<Attempt>,
  ) {}

  // Traer todos los exámenes de un curso
  async getExamsByCourse(courseId: number): Promise<Exam[]> {
    return this.examRepo.find({ where: { courseId, active: true } });
  }

  // Traer un examen con sus preguntas y opciones
  async getExamById(id: number): Promise<Exam> {
    const exam = await this.examRepo.findOne({ where: { id } });
    if (!exam) throw new NotFoundException('Examen no encontrado');
    return exam;
  }

  // Crear un examen completo con preguntas y opciones
  async createExam(data: any): Promise<Exam> {
    const exam = this.examRepo.create(data as Exam);
    return this.examRepo.save(exam) as Promise<Exam>;
  }

  // Procesar y guardar el intento del alumno
  async submitAttempt(examId: number, userId: number, answers: Record<number, number>) {
    const exam = await this.getExamById(examId);

    let correct = 0;
    const total = exam.questions.length;

    // Calcular puntaje
    for (const question of exam.questions) {
      const selectedOptionId = answers[question.id];
      if (!selectedOptionId) continue;

      const selectedOption = question.options.find(o => o.id === selectedOptionId);
      if (selectedOption?.isCorrect) correct++;
    }

    const score = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Guardar intento
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

  // Historial de intentos de un alumno
  async getAttemptsByUser(examId: number, userId: number) {
    return this.attemptRepo.find({
      where: { examId, userId },
      order: { finishedAt: 'DESC' },
    });
  }
  // Traer todos los exámenes
async getAllExams(): Promise<Exam[]> {
  return this.examRepo.find({ order: { createdAt: 'DESC' } });
}

// Actualizar examen completo
async updateExam(id: number, data: any): Promise<Exam> {
  const exam = await this.getExamById(id);
  
  // Actualizamos campos básicos
  exam.title = data.title ?? exam.title;
  exam.description = data.description ?? exam.description;
  exam.active = data.active ?? exam.active;
  exam.courseId = data.courseId ?? exam.courseId;

  // Si vienen preguntas nuevas, reemplazamos todo
  if (data.questions) {
    exam.questions = data.questions;
  }

  return this.examRepo.save(exam);
}

// Eliminar examen
async deleteExam(id: number): Promise<{ success: boolean }> {
  const exam = await this.getExamById(id);
  await this.examRepo.remove(exam);
  return { success: true };
}
}