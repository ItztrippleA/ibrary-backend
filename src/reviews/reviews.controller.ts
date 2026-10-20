import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('subjects/:subjectId/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @ApiOperation({
    summary: 'Reviews for a subject',
    description: 'Average rating, review count, and the written reviews. Matches the 4.5/5 review screen.',
  })
  list(@Param('subjectId') subjectId: string) {
    return this.reviews.list(subjectId);
  }

  @Post()
  @ApiOperation({
    summary: 'Write or update your review',
    description: 'One review per student per subject. The first review awards 10 points.',
  })
  create(
    @CurrentUser() user: User,
    @Param('subjectId') subjectId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviews.create(user.id, subjectId, dto.rating, dto.body);
  }
}
