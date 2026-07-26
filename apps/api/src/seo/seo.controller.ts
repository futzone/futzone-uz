import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SeoManifest } from '@futzone/contracts';
import { SeoService } from './seo.service';

@ApiTags('seo')
@Controller('seo')
export class SeoController {
  public constructor(private readonly seo: SeoService) {}

  @Get('sitemap')
  @ApiOperation({ summary: 'Get privacy-filtered sitemap source records' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/SeoManifest' } })
  public manifest(): Promise<SeoManifest> {
    return this.seo.manifest();
  }
}
