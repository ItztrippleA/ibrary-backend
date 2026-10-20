import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { CatalogQuery } from './dto/catalog.dto';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('terms')
  @ApiOperation({
    summary: 'Secondary school terms',
    description:
      '1st, 2nd, and 3rd term for a class. Defaults to the signed-in student\'s class level. Each card includes a subject count and how many people are participating.',
  })
  terms(@CurrentUser() user: User, @Query() query: CatalogQuery) {
    const classLevel = query.classLevel ?? user.classLevel;
    if (!classLevel) return [];
    return this.catalog.terms(classLevel);
  }

  @Get('subjects')
  @ApiOperation({
    summary: 'Search and filter subjects',
    description:
      'Powers Search for Classes and Apply Filter. An empty list is the “No filtered result” state. q matches the subject name or description.',
  })
  subjects(@CurrentUser() user: User, @Query() query: CatalogQuery) {
    return this.catalog.subjects({
      classLevel: query.classLevel ?? user.classLevel ?? undefined,
      term: query.term,
      q: query.q,
    });
  }

  @Get('subjects/:id')
  @ApiOperation({ summary: 'Subject detail, including books and average rating' })
  subject(@Param('id') id: string) {
    return this.catalog.subject(id);
  }

  @Get('subjects/:id/participants')
  @ApiOperation({ summary: 'Students taking this subject' })
  participants(@Param('id') id: string) {
    return this.catalog.participants(id);
  }
}
