import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClassLevel } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Joel' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Adeyemi' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  lastName?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}

export class UpdateClassDto {
  @ApiProperty({ enum: ClassLevel, example: ClassLevel.SS2 })
  @IsEnum(ClassLevel)
  classLevel: ClassLevel;

  @ApiProperty({
    example: 'Science',
    description: 'Class path chosen during onboarding, such as Science, Commercial, or Arts.',
  })
  @IsString()
  @Length(1, 40)
  classPath: string;
}
