import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateExamDto, ExamQuestionDto, UpdateExamDto } from './dto/exam.dto';
import {
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_PASS_THRESHOLD,
  extractBlankKeys,
  normalizeWord,
  resolveType,
} from './exam.helpers';
import { Exam } from './entities/exam.entity';
import { Question } from './entities/question.entity';
import { ExamMediaService } from './exam-media.service';

@Injectable()
export class ExamAdminService {
  constructor(
    @InjectRepository(Exam)
    private readonly examRepo: Repository<Exam>,
    private readonly examMedia: ExamMediaService,
  ) {}

  async getExamById(id: number): Promise<Exam> {
    const exam = await this.examRepo.findOne({ where: { id } });
    if (!exam) throw new NotFoundException('Examen no encontrado');
    return exam;
  }

  async getAllExams(): Promise<Exam[]> {
    return this.examRepo.find({ order: { createdAt: 'DESC' } });
  }

  normalizeQuestions(questions: ExamQuestionDto[]): Question[] {
    return questions.map((q, index) => {
      const type = resolveType(q);
      const order = q.order ?? q.sortOrder ?? index + 1;
      const imageUrl = this.examMedia.normalizeMediaPath(q.imageUrl);
      const audioUrl = this.examMedia.normalizeMediaPath(q.audioUrl);

      if (type === 'true_false') {
        const opts = q.options?.length
          ? q.options
          : [
              { text: 'True', isCorrect: true },
              { text: 'False', isCorrect: false },
            ];
        if (opts.length !== 2) {
          throw new BadRequestException('true_false requires exactly 2 options');
        }
        const correctCount = opts.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
          throw new BadRequestException('true_false requires exactly one correct option');
        }
        return {
          id: q.id,
          text: q.text.trim(),
          type,
          imageUrl,
          audioUrl,
          wordBank: null,
          correctBlanks: null,
          order,
          options: opts.map((o) => ({
            id: o.id,
            text: o.text.trim(),
            isCorrect: o.isCorrect,
          })),
        } as unknown as Question;
      }

      if (type === 'gap_fill') {
        const blanks = extractBlankKeys(q.text);
        if (!blanks.length) {
          throw new BadRequestException('gap_fill text must include at least one blank like {{1}}');
        }
        const correctBlanks = q.correctBlanks || {};
        for (const key of blanks) {
          if (!correctBlanks[key]?.trim()) {
            throw new BadRequestException(`gap_fill missing correct answer for blank {{${key}}}`);
          }
        }
        const wordBank = (q.wordBank || []).map((w) => w.trim()).filter(Boolean);
        const needed = blanks.map((k) => normalizeWord(correctBlanks[k]));
        const bankNorm = wordBank.map(normalizeWord);
        for (const w of needed) {
          if (!bankNorm.includes(w)) {
            throw new BadRequestException(
              `gap_fill wordBank must include all correct answers (missing "${w}")`,
            );
          }
        }
        return {
          id: q.id,
          text: q.text.trim(),
          type,
          imageUrl,
          audioUrl,
          wordBank,
          correctBlanks: Object.fromEntries(blanks.map((k) => [k, correctBlanks[k].trim()])),
          order,
          options: [],
        } as unknown as Question;
      }

      const options = q.options || [];
      if (options.length < 2) {
        throw new BadRequestException('multiple_choice requires at least 2 options');
      }
      if (!options.some((o) => o.isCorrect)) {
        throw new BadRequestException('multiple_choice requires at least one correct option');
      }
      return {
        id: q.id,
        text: q.text.trim(),
        type: 'multiple_choice' as const,
        imageUrl,
        audioUrl,
        wordBank: null,
        correctBlanks: null,
        order,
        options: options.map((o) => ({
          id: o.id,
          text: o.text.trim(),
          isCorrect: o.isCorrect,
        })),
      } as unknown as Question;
    });
  }

  async createExam(data: CreateExamDto): Promise<Exam> {
    const questions = this.normalizeQuestions(data.questions);
    const exam = this.examRepo.create({
      title: data.title,
      description: data.description ?? '',
      courseId: data.courseId,
      active: data.active ?? true,
      maxAttempts: data.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      passThreshold: data.passThreshold ?? DEFAULT_PASS_THRESHOLD,
      questions: questions,
    });
    return this.examRepo.save(exam);
  }

  async updateExam(id: number, data: UpdateExamDto): Promise<Exam> {
    const exam = await this.getExamById(id);
    if (data.title != null) exam.title = data.title;
    if (data.description !== undefined) exam.description = data.description;
    if (data.courseId != null) exam.courseId = data.courseId;
    if (data.active != null) exam.active = data.active;
    if (data.maxAttempts != null) exam.maxAttempts = data.maxAttempts;
    if (data.passThreshold != null) exam.passThreshold = data.passThreshold;
    if (data.questions) {
      exam.questions = this.normalizeQuestions(data.questions);
    }
    return this.examRepo.save(exam);
  }

  async deleteExam(id: number): Promise<{ message: string }> {
    const exam = await this.getExamById(id);
    await this.examRepo.remove(exam);
    return { message: 'Examen eliminado' };
  }
}
