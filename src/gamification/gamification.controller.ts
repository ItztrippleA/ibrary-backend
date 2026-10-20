import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { GamificationService } from './gamification.service';

@ApiTags('gamification')
@ApiBearerAuth()
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('points')
  @ApiOperation({
    summary: 'Point balance and leaderboard rank',
    description: 'Powers the 560 Pts chip and the Leader\'s Board 12/50 chip on home.',
  })
  points(@CurrentUser() user: User) {
    return this.gamification.summary(user.id);
  }

  @Get('leaderboard')
  @ApiOperation({
    summary: 'iBrary leadership board',
    description: 'Top 50 students by points, plus the signed-in student\'s rank.',
  })
  leaderboard(@CurrentUser() user: User) {
    return this.gamification.leaderboard(user.id);
  }

  @Get('badges')
  @ApiOperation({
    summary: 'Badges',
    description:
      'Includes Most Dedicated. A badge is earned when the student\'s points reach pointsRequired.',
  })
  badges(@CurrentUser() user: User) {
    return this.gamification.badges(user.id);
  }

  @Get('incentives')
  @ApiOperation({ summary: 'Point incentives' })
  incentives() {
    return this.gamification.incentives();
  }
}
