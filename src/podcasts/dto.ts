import { ApiPropertyOptional } from '@nestjs/swagger';
import { SkillLevel } from '@prisma/client';
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
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RequestPodcastDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subtopicId?: string;

  @ApiPropertyOptional({ description: 'What the hosts should stay on. Blank means a full overview.' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  focus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class GlossaryItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  term!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  meaning!: string;
}

export class SaveTopicDto {
  @IsString()
  subjectId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(600)
  summary!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(180, { each: true })
  objectives!: string[];

  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => GlossaryItemDto)
  glossary!: GlossaryItemDto[];
}

export class SaveSubtopicDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(1200)
  body!: string;

  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(180, { each: true })
  objectives!: string[];

  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => GlossaryItemDto)
  glossary!: GlossaryItemDto[];
}

export class SavePromptDto {
  @IsString()
  topicId!: string;

  @IsEnum(SkillLevel)
  difficulty!: SkillLevel;

  @IsString()
  @MinLength(8)
  @MaxLength(400)
  prompt!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(180, { each: true })
  options!: string[];

  @IsInt()
  @Min(0)
  correctIndex!: number;

  @IsString()
  @MinLength(8)
  @MaxLength(400)
  hint!: string;
}

export class AnswerPromptDto {
  @IsString()
  promptId!: string;

  @IsInt()
  @Min(0)
  selected!: number;

  @IsInt()
  @Min(0)
  @Max(600)
  seconds!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  confidence?: number;
}

export class CoachDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  note?: string;
}
