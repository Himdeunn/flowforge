import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkflowDto {
  @ApiProperty({
    description: 'A human-readable name for the workflow',
    example: 'Process Customer Orders',
    minLength: 3,
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @Length(3, 255)
  name: string;

  @ApiProperty({
    description: 'Detailed description of the workflow purpose',
    example: 'Validates and triggers fulfillment for pending orders',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description:
      'Directed Acyclic Graph (DAG) JSON definition of nodes and edges',
    example: {
      nodes: [
        {
          id: 'fetchData',
          type: 'http',
          config: { method: 'GET', url: 'https://api.example.com/data' },
        },
        { id: 'wait', type: 'delay', config: { durationMs: 2000 } },
        {
          id: 'checkStatus',
          type: 'condition',
          config: { expression: 'steps.fetchData.output.status == 200' },
        },
      ],
      edges: [
        { from: 'fetchData', to: 'wait' },
        { from: 'wait', to: 'checkStatus' },
      ],
    },
  })
  @IsNotEmpty()
  @IsObject()
  definitionJson: Record<string, any>;

  @ApiProperty({
    description:
      'Optional cron expression to trigger the workflow automatically on a schedule',
    example: '*/15 * * * *',
    required: false,
  })
  @IsOptional()
  @IsString()
  cronExpression?: string;
}
