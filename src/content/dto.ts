import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ContentQuery {
  @ApiPropertyOptional({
    example: 'SS1',
    description: 'App class label SS1–SS3. Mapped to content API values SSS 1–SSS 3.',
  })
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
