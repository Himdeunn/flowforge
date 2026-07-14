import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExecutionEngine } from './execution-engine';
import { StepExecutor } from './step-executor';
import { ExecutionLogService } from './services/execution-log.service';
import { ExecutionLog, ExecutionLogSchema } from './schemas/execution-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ExecutionLog.name, schema: ExecutionLogSchema }]),
  ],
  providers: [
    ExecutionEngine,
    StepExecutor,
    ExecutionLogService,
  ],
  exports: [
    ExecutionEngine,
    StepExecutor,
    ExecutionLogService,
  ],
})
export class ExecutionModule {}
