import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators';
import { AccessService } from './access.service';
import {
  SaveSignPhraseDto,
  SaveVoiceCommandDto,
  UpdateAccessToolDto,
} from './dto/access.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/access')
export class AccessAdminController {
  constructor(private readonly access: AccessService) {}

  @Get()
  @ApiOperation({ summary: 'Tools, voice commands, sign phrases, and how many students use each setting' })
  async desk() {
    const [tools, commands, signs, usage] = await Promise.all([
      this.access.tools(),
      this.access.commands(),
      this.access.signs(),
      this.access.usage(),
    ]);
    return { tools, commands, signs, usage };
  }

  @Patch('tools/:id')
  @ApiOperation({ summary: 'Edit or switch an access tool' })
  updateTool(@Param('id') id: string, @Body() dto: UpdateAccessToolDto) {
    return this.access.updateTool(id, dto);
  }

  @Post('commands')
  @ApiOperation({ summary: 'Add a voice command' })
  createCommand(@Body() dto: SaveVoiceCommandDto) {
    return this.access.createCommand(dto);
  }

  @Patch('commands/:id')
  @ApiOperation({ summary: 'Edit a voice command' })
  updateCommand(@Param('id') id: string, @Body() dto: SaveVoiceCommandDto) {
    return this.access.updateCommand(id, dto);
  }

  @Delete('commands/:id')
  @ApiOperation({ summary: 'Remove a voice command' })
  removeCommand(@Param('id') id: string) {
    return this.access.removeCommand(id);
  }

  @Post('signs')
  @ApiOperation({ summary: 'Add a sign phrase' })
  createSign(@Body() dto: SaveSignPhraseDto) {
    return this.access.createSign(dto);
  }

  @Patch('signs/:id')
  @ApiOperation({ summary: 'Edit a sign phrase' })
  updateSign(@Param('id') id: string, @Body() dto: SaveSignPhraseDto) {
    return this.access.updateSign(id, dto);
  }

  @Delete('signs/:id')
  @ApiOperation({ summary: 'Remove a sign phrase' })
  removeSign(@Param('id') id: string) {
    return this.access.removeSign(id);
  }
}
