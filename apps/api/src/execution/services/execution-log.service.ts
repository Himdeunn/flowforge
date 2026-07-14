import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExecutionLog, ExecutionLogDocument } from '../schemas/execution-log.schema';

@Injectable()
export class ExecutionLogService {
  constructor(
    @InjectModel(ExecutionLog.name)
    private readonly logModel: Model<ExecutionLogDocument>,
  ) {}

  async log(
    tenantId: string,
    runId: string,
    stepKey: string,
    attempt: number,
    level: 'info' | 'warn' | 'error',
    message: string,
    payload: Record<string, any> = {},
  ): Promise<ExecutionLog> {
    const newLog = new this.logModel({
      tenantId,
      runId,
      stepKey,
      attempt,
      level,
      message,
      payload,
      timestamp: new Date(),
    });
    return newLog.save();
  }

  async getLogsForRun(runId: string): Promise<ExecutionLog[]> {
    return this.logModel
      .find({ runId })
      .sort({ timestamp: 1 })
      .exec();
  }
}
