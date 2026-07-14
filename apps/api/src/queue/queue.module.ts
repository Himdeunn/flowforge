import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { WorkflowProcessor } from './workflow.processor';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [ExecutionModule],
  providers: [QueueService, WorkflowProcessor],
  exports: [QueueService],
})
export class QueueModule {}
