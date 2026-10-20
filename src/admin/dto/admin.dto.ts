import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ClassLevel,
  CourseStatus,
  NotificationType,
  UserRole,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

export class UserQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;
}

export class CatalogAdminQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: ClassLevel })
  @IsOptional()
  @IsEnum(ClassLevel)
  classLevel?: ClassLevel;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  term?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}

export class UpsertSubjectDto {
  @ApiProperty({ example: 'chemistry' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  slug!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiProperty({ example: 180 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  term!: number;

  @ApiProperty({ enum: ClassLevel })
  @IsEnum(ClassLevel)
  classLevel!: ClassLevel;
}

export class CreateBookDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiProperty({ example: 45 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes!: number;
}

export class CourseAdminQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: CourseStatus })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;
}

export class ReviewCourseDto {
  @ApiProperty({ enum: CourseStatus })
  @IsEnum(CourseStatus)
  status!: CourseStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}

export class BroadcastNotificationDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  body!: string;

  @ApiPropertyOptional({ enum: NotificationType, default: NotificationType.GENERAL })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}

export class BannerDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  linkUrl?: string;

  @ApiPropertyOptional({ example: 'home' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  placement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endsAt?: string;
}

export class QuizQuestionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  prompt!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  options!: string[];

  @ApiProperty({ description: 'Zero-based option index. -1 leaves the question ungraded.' })
  @IsInt()
  @Min(-1)
  @Max(5)
  correctIndex!: number;
}

export class SaveQuizDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional({ enum: ClassLevel, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(ClassLevel)
  classLevel?: ClassLevel | null;

  @ApiProperty({ type: [QuizQuestionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  questions!: QuizQuestionDto[];
}

export class ImportQuizCsvDto {
  @ApiProperty({
    description:
      'Quiz bank CSV. Required columns: topic_id, title, question, option_a, option_b, option_c, option_d, correct_answer.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(8_000_000)
  csv!: string;

  @ApiPropertyOptional({ enum: ClassLevel, description: 'Applied to every quiz in the file. Omit to read the class from topic ids such as sss1.' })
  @IsOptional()
  @IsEnum(ClassLevel)
  classLevel?: ClassLevel;

  @ApiPropertyOptional({ example: 'Biology' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  subject?: string;
}

export class AdjustWalletDto {
  @ApiProperty({
    example: 50000,
    description: 'Signed amount in kobo. 50000 credits ₦500. A negative amount debits the purse.',
  })
  @Type(() => Number)
  @IsInt()
  amountKobo!: number;

  @ApiProperty({ example: 'Welcome credit' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason!: string;
}
