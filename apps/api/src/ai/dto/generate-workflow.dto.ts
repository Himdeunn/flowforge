import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateWorkflowDto {
  @ApiProperty({
    description: 'Natural language description/prompt describing the workflow steps to build or modify',
    example: 'Wait 3 seconds, then fetch data from https://api.example.com/users, then use a script to transform the data.',
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiProperty({
    description: 'Optional existing workflow DAG JSON definition to modify or extend',
    example: {
      nodes: [
        { id: 'fetchData', type: 'http', config: { method: 'GET', url: 'https://api.example.com/data' } }
      ],
      edges: []
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  currentDefinition?: any;
}
