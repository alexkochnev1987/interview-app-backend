import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateInterviewDto } from './dto/create-interview.dto';
import {
  Interview,
  InterviewResult,
} from './interfaces/interview.interface';

@Injectable()
export class InterviewService {
  private readonly interviews: Interview[] = [];

  create(dto: CreateInterviewDto): Interview {
    const now = new Date();
    const interview: Interview = {
      id: randomUUID(),
      candidateName: dto.candidateName,
      position: dto.position,
      questions: dto.questions,
      answers: [],
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    this.interviews.push(interview);
    return interview;
  }

  findAll(): Interview[] {
    return this.interviews;
  }

  findOne(id: string): Interview {
    const interview = this.interviews.find((i) => i.id === id);
    if (!interview) {
      throw new NotFoundException(`Interview with id "${id}" not found`);
    }
    return interview;
  }

  complete(id: string): Interview {
    const interview = this.findOne(id);
    interview.status = 'processing';
    interview.updatedAt = new Date();

    // Simulate async processing (Step Functions trigger placeholder)
    this.simulateProcessing(interview);

    return interview;
  }

  getResults(id: string): InterviewResult {
    const interview = this.findOne(id);
    if (interview.status !== 'completed' || !interview.result) {
      throw new NotFoundException(
        `Results for interview "${id}" are not available yet (status: ${interview.status})`,
      );
    }
    return interview.result;
  }

  /**
   * Placeholder for Step Functions invocation.
   * Simulates async processing by completing after a short delay.
   */
  private simulateProcessing(interview: Interview): void {
    setTimeout(() => {
      interview.result = {
        overallScore: 75,
        summary: 'Simulated evaluation result',
        categoryScores: {
          technical: 80,
          communication: 70,
          problemSolving: 75,
        },
        completedAt: new Date(),
      };
      interview.status = 'completed';
      interview.updatedAt = new Date();
    }, 2000);
  }
}
