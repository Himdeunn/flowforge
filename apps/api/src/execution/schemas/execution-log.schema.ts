import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ExecutionLogDocument = ExecutionLog & Document;

@Schema({ collection: 'execution_logs', timestamps: false })
export class ExecutionLog {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  runId: string;

  @Prop({ required: true, index: true })
  stepKey: string;

  @Prop({ required: true })
  attempt: number;

  @Prop({ required: true, enum: ['info', 'warn', 'error'] })
  level: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  payload: Record<string, any>;

  @Prop({ required: true, default: Date.now, index: true })
  timestamp: Date;
}

export const ExecutionLogSchema = SchemaFactory.createForClass(ExecutionLog);

// Composite indexes as specified in PRD §11
ExecutionLogSchema.index({ runId: 1, stepKey: 1, timestamp: 1 });
ExecutionLogSchema.index({ tenantId: 1, timestamp: -1 });
