import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PlanCodeDto {
  @ApiProperty({
    example: 'six_month',
    description: 'monthly, yearly, or six_month (₦6,000 for 6 months).',
  })
  @IsString()
  planCode: string;
}
