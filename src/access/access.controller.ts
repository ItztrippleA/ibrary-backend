import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser, Public } from '../common/decorators';
import { AccessService } from './access.service';
import { UpdateAccessProfileDto } from './dto/access.dto';

@ApiTags('access')
@Controller('access')
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Public()
  @Get('tools')
  @ApiOperation({ summary: 'Access tools the school has switched on' })
  tools() {
    return this.access.tools(true);
  }

  @Public()
  @Get('commands')
  @ApiOperation({ summary: 'Voice phrases the school has published' })
  commands() {
    return this.access.commands(true);
  }

  @Public()
  @Get('signs')
  @ApiOperation({ summary: 'Sign phrases available to students' })
  signs() {
    return this.access.signs(true);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'This student’s access settings' })
  me(@CurrentUser() user: User) {
    return this.access.profile(user.id);
  }

  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({ summary: 'Update this student’s access settings' })
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateAccessProfileDto) {
    return this.access.updateProfile(user.id, dto);
  }
}
