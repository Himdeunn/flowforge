import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'Name of the organization/tenant',
    example: 'Acme Corp',
    minLength: 3,
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @Length(3, 100)
  tenantName: string;

  @ApiProperty({
    description: 'Unique URL slug for the tenant (lowercase, numbers, and hyphens only)',
    example: 'acme-corp',
    minLength: 3,
    maxLength: 50,
  })
  @IsNotEmpty()
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'tenantSlug can only contain lowercase letters, numbers, and hyphens',
  })
  tenantSlug: string;

  @ApiProperty({
    description: 'Email of the administrator user',
    example: 'admin@acme.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Password for the administrator user',
    example: 'StrongPassword123!',
    minLength: 6,
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @Length(6, 100, { message: 'Password must be at least 6 characters long' })
  password: string;
}
