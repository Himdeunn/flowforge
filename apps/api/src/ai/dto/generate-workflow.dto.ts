import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateWorkflowDto {
  @ApiProperty({ description: 'Natural language instruction to build or edit a workflow' })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiProperty({ description: 'Optional current workflow DAG JSON to modify', required: false })
  @IsObject()
  @IsOptional()
  currentDefinition?: any;
}
