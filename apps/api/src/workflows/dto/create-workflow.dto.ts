import { IsNotEmpty, IsOptional, IsString, IsObject, Length } from 'class-validator';

export class CreateWorkflowDto {
  @IsNotEmpty()
  @IsString()
  @Length(3, 255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsObject()
  definitionJson: Record<string, any>;

  @IsOptional()
  @IsString()
  cronExpression?: string;
}
