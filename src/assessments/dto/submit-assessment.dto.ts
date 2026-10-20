import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

export class AssessmentAnswerDto {
  @ApiProperty({ example: 'question id' })
  @IsString()
  questionId: string;

  @ApiProperty({ example: 0, description: 'Index into the question options array' })
  @IsInt()
  @Min(0)
  selected: number;
}

export class SubmitAssessmentDto {
  @ApiProperty({ type: [AssessmentAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssessmentAnswerDto)
  answers: AssessmentAnswerDto[];
}
