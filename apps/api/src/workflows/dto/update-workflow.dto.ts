import { IsOptional, IsString, IsObject, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWorkflowDto {
  @ApiProperty({
    description: 'Updated name for the workflow',
    example: 'Process Customer Orders v2',
    minLength: 3,
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(3, 255)
  name?: string;

  @ApiProperty({
    description: 'Updated detailed description',
    example: 'New version with additional error checks',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Updated Directed Acyclic Graph (DAG) JSON definition',
    example: {
      nodes: [
        {
          id: 'fetchData',
          type: 'http',
          config: { method: 'GET', url: 'https://api.example.com/data' },
        },
      ],
      edges: [],
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  definitionJson?: Record<string, any>;

  @ApiProperty({
    description: 'Updated cron expression schedule',
    example: '0 0 * * *',
    required: false,
  })
  @IsOptional()
  @IsString()
  cronExpression?: string;
}
