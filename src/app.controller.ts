import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { readEnv } from './config/env';
import { Public } from './common/decorators';

@ApiTags('meta')
@Controller()
export class AppController {
  @Public()
  @Get()
  @ApiOperation({
    summary: 'API index',
    description: 'Points clients at the Swagger UI and the OpenAPI document.',
  })
  index() {
    const env = readEnv();
    return {
      name: 'iBrary API',
      docs: `${env.appUrl}/docs`,
      openapi: `${env.appUrl}/docs-json`,
    };
  }
}
