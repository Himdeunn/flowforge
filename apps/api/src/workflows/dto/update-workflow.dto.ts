import { IsOptional, IsString, IsObject, Length } from 'class-validator';

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  @Length(3, 255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  definitionJson?: Record<string, any>;

  @IsOptional()
  @IsString()
  cronExpression?: string;
}
