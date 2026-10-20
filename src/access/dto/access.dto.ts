import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClassLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateAccessProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  readAloud?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bionicReading?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dyslexiaMode?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  visualAlerts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  gazeNavigation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  voiceCommands?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  signInterpreter?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  signAvatar?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.6)
  @Max(1.6)
  speechRate?: number;
}

export class UpdateAccessToolDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  group?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(240)
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(600)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;
}

export class SaveVoiceCommandDto {
  @ApiProperty({ example: 'read this' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  phrase!: string;

  @ApiProperty({ example: 'read-aloud' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  action!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  detail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;
}

export class SaveSignPhraseDto {
  @ApiProperty({ example: 'MATHEMATICS' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  gloss!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  meaning!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  videoUrl?: string;

  @ApiPropertyOptional({ enum: ClassLevel })
  @IsOptional()
  @IsEnum(ClassLevel)
  classLevel?: ClassLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
