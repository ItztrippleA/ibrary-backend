import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClassLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CatalogQuery {
  @ApiPropertyOptional({ enum: ClassLevel, example: ClassLevel.SS2 })
  @IsOptional()
  @IsEnum(ClassLevel)
  classLevel?: ClassLevel;

  @ApiPropertyOptional({ example: 1, description: '1st, 2nd, or 3rd term' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  term?: number;

  @ApiPropertyOptional({ example: 'physics' })
  @IsOptional()
  @IsString()
  q?: string;
}
