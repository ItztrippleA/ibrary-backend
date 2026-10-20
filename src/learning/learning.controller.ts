import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { FavouriteDto, UpdateProgressDto } from './dto/learning.dto';
import { LearningService } from './learning.service';

@ApiTags('learning')
@ApiBearerAuth()
@Controller('learning')
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get('home')
  @ApiOperation({
    summary: 'Home screen',
    description:
      'Greeting, class chip, points, leaderboard rank, terms, subjects, books, and latest activity.',
  })
  home(@CurrentUser() user: User) {
    return this.learning.home(user);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Latest activity' })
  activity(@CurrentUser() user: User) {
    return this.learning.activity(user.id);
  }

  @Post('progress')
  @ApiOperation({
    summary: 'Update subject progress',
    description:
      'Sets the progress ring from 0 to 100. Reaching 100 awards 25 points. The student is counted as participating.',
  })
  progress(@CurrentUser() user: User, @Body() dto: UpdateProgressDto) {
    return this.learning.updateProgress(user.id, dto.subjectId, dto.percent);
  }

  @Get('favourites')
  @ApiOperation({ summary: 'Saved subjects and books' })
  favourites(@CurrentUser() user: User) {
    return this.learning.favourites(user.id);
  }

  @Post('favourites')
  @ApiOperation({ summary: 'Save a subject or book' })
  save(@CurrentUser() user: User, @Body() dto: FavouriteDto) {
    return this.learning.addFavourite(user.id, dto.targetType, dto.targetId);
  }

  @Delete('favourites/:id')
  @ApiOperation({ summary: 'Remove a saved item' })
  async unsave(@CurrentUser() user: User, @Param('id') id: string) {
    const result = await this.learning.removeFavourite(user.id, id);
    return { removed: result.count };
  }
}
