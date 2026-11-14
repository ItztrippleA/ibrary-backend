import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ContentQuery {
  @ApiPropertyOptional({ example: 'SS1', description: 'Nigerian curriculum class, as stored in the content API (SS1–SS3)' })
  @IsOptional()
  @IsString()
  class_name?: string;

  @ApiPropertyOptional({ example: 1, description: 'Theme number, 1–4 for the published biology modules' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  theme_number?: number;

  @ApiPropertyOptional({ example: 'Biology' })
  @IsOptional()
  @IsString()
  subject?: string;
}
