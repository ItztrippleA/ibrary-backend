import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateClassDto, UpdateProfileDto } from './dto/update-user.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Profile',
    description: 'Personal information shown on My Profile.',
  })
  me(@CurrentUser() user: User) {
    return this.present(user);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update personal information' })
  async update(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: dto,
    });
    return this.present(updated);
  }

  @Patch('me/class')
  @ApiOperation({
    summary: 'Set class level and class path',
    description:
      'Answers “What class are you currently in?” and “What is your class path?”. The SS 2 chip on home reads classLevel.',
  })
  async updateClass(@CurrentUser() user: User, @Body() dto: UpdateClassDto) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: dto,
    });
    return this.present(updated);
  }

  private present(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      classLevel: user.classLevel,
      classPath: user.classPath,
      points: user.points,
      referralCode: user.referralCode,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }
}
