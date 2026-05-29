import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth.types';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { DomainService } from '../../common/domain.service';

@Controller('public/orders')
@UseGuards(JwtAuthGuard)
export class PublicOrdersController {
  constructor(private readonly domainService: DomainService) {}

  @Get('delivery-confirmation')
  previewDeliveryConfirmation(@Query('token') token: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.domainService.previewDeliveryConfirmation(token ?? '', user.sub);
  }

  @Post('delivery-confirmation')
  confirmDeliveryByToken(@Body() body: { token: string }, @CurrentUser() user: AuthenticatedUser) {
    return this.domainService.confirmDeliveryByToken(body.token, user.sub);
  }
}