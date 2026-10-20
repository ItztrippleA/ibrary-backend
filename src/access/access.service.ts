import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  SaveSignPhraseDto,
  SaveVoiceCommandDto,
  UpdateAccessProfileDto,
  UpdateAccessToolDto,
} from './dto/access.dto';

const FLAGS = [
  'readAloud',
  'bionicReading',
  'dyslexiaMode',
  'visualAlerts',
  'gazeNavigation',
  'voiceCommands',
  'signInterpreter',
  'signAvatar',
] as const;

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  tools(enabledOnly = false) {
    return this.prisma.accessTool.findMany({
      where: enabledOnly ? { enabled: true } : undefined,
      orderBy: { sort: 'asc' },
    });
  }

  commands(enabledOnly = false) {
    return this.prisma.voiceCommand.findMany({
      where: enabledOnly ? { enabled: true } : undefined,
      orderBy: [{ sort: 'asc' }, { phrase: 'asc' }],
    });
  }

  signs(enabledOnly = false) {
    return this.prisma.signPhrase.findMany({
      where: enabledOnly ? { enabled: true } : undefined,
      orderBy: { gloss: 'asc' },
    });
  }

  async profile(userId: string) {
    return this.prisma.userAccess.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updateProfile(userId: string, dto: UpdateAccessProfileDto) {
    await this.profile(userId);
    return this.prisma.userAccess.update({
      where: { userId },
      data: dto,
    });
  }

  async updateTool(id: string, dto: UpdateAccessToolDto) {
    try {
      return await this.prisma.accessTool.update({ where: { id }, data: dto });
    } catch {
      throw new NotFoundException('Tool not found');
    }
  }

  createCommand(dto: SaveVoiceCommandDto) {
    return this.prisma.voiceCommand.create({
      data: {
        phrase: dto.phrase.trim(),
        action: dto.action.trim(),
        detail: dto.detail?.trim() ?? '',
        enabled: dto.enabled ?? true,
        sort: dto.sort ?? 0,
      },
    });
  }

  async updateCommand(id: string, dto: SaveVoiceCommandDto) {
    try {
      return await this.prisma.voiceCommand.update({
        where: { id },
        data: {
          phrase: dto.phrase.trim(),
          action: dto.action.trim(),
          detail: dto.detail?.trim() ?? '',
          ...(dto.enabled === undefined ? {} : { enabled: dto.enabled }),
          ...(dto.sort === undefined ? {} : { sort: dto.sort }),
        },
      });
    } catch {
      throw new NotFoundException('Command not found');
    }
  }

  async removeCommand(id: string) {
    try {
      await this.prisma.voiceCommand.delete({ where: { id } });
      return { deleted: true };
    } catch {
      throw new NotFoundException('Command not found');
    }
  }

  createSign(dto: SaveSignPhraseDto) {
    return this.prisma.signPhrase.create({
      data: {
        gloss: dto.gloss.trim(),
        meaning: dto.meaning.trim(),
        videoUrl: dto.videoUrl,
        classLevel: dto.classLevel,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async updateSign(id: string, dto: SaveSignPhraseDto) {
    try {
      return await this.prisma.signPhrase.update({
        where: { id },
        data: {
          gloss: dto.gloss.trim(),
          meaning: dto.meaning.trim(),
          videoUrl: dto.videoUrl ?? null,
          classLevel: dto.classLevel ?? null,
          ...(dto.enabled === undefined ? {} : { enabled: dto.enabled }),
        },
      });
    } catch {
      throw new NotFoundException('Sign phrase not found');
    }
  }

  async removeSign(id: string) {
    try {
      await this.prisma.signPhrase.delete({ where: { id } });
      return { deleted: true };
    } catch {
      throw new NotFoundException('Sign phrase not found');
    }
  }

  async usage() {
    const [tools, commands, signs, profiles, counts] = await Promise.all([
      this.prisma.accessTool.count({ where: { enabled: true } }),
      this.prisma.voiceCommand.count({ where: { enabled: true } }),
      this.prisma.signPhrase.count({ where: { enabled: true } }),
      this.prisma.userAccess.count(),
      Promise.all(
        FLAGS.map(async (flag) => {
          const count = await this.prisma.userAccess.count({
            where: { [flag]: true } as Prisma.UserAccessWhereInput,
          });
          return [flag, count] as const;
        }),
      ),
    ]);
    return {
      enabledTools: tools,
      enabledCommands: commands,
      enabledSigns: signs,
      profiles,
      flags: Object.fromEntries(counts),
    };
  }
}
