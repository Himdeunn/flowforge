import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  @Length(3, 100)
  tenantName: string;

  @IsNotEmpty()
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'tenantSlug can only contain lowercase letters, numbers, and hyphens',
  })
  tenantSlug: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 100, { message: 'Password must be at least 6 characters long' })
  password: string;
}
