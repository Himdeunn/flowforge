import { Module } from '@nestjs/common';
import { RunsService } from './runs.service';
import { RunsController } from './runs.controller';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [ExecutionModule],
  controllers: [RunsController],
  providers: [RunsService],
  exports: [RunsService],
})
export class RunsModule {}
