import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ValidateReferralDto {
  @ApiProperty({ example: 'UJVHS65' })
  @IsString()
  @Length(4, 12)
  code: string;
}
