import { ApiProperty } from '@nestjs/swagger';
import { FavouriteTarget } from '@prisma/client';
import { IsEnum, IsInt, IsString, Max, Min } from 'class-validator';

export class UpdateProgressDto {
  @ApiProperty({ example: 'subject id' })
  @IsString()
  subjectId: string;

  @ApiProperty({ example: 40, minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  percent: number;
}

export class FavouriteDto {
  @ApiProperty({ enum: FavouriteTarget, example: FavouriteTarget.SUBJECT })
  @IsEnum(FavouriteTarget)
  targetType: FavouriteTarget;

  @ApiProperty({ example: 'subject or book id' })
  @IsString()
  targetId: string;
}
