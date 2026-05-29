import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth.types';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { PermissionsGuard } from '../../common/permissions.guard';
import { Permissions } from '../../common/permissions.decorator';
import { DomainService } from '../../common/domain.service';

@Controller('withdrawals')
@UseGuards(JwtAuthGuard)
export class WithdrawalsController {
  constructor(private readonly domainService: DomainService) {}

  @Post()
  createOwnRequest(
    @Body() body: { amountCop: number; destination?: string; notes?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.domainService.createWithdrawalRequest({
      userId: user.sub,
      amountCop: body.amountCop,
      destination: body.destination,
      notes: body.notes,
    });
  }

  @Get('me')
  getMyRequests(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.domainService.getUserWithdrawals(user.sub, limit ? Number(limit) : 30);
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('withdrawals.manage')
  getAdminRequests(@Query('status') status?: 'pending' | 'approved' | 'rejected', @Query('limit') limit?: string) {
    return this.domainService.getAdminWithdrawals(status, limit ? Number(limit) : 80);
  }

  @Patch(':id/review')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('withdrawals.manage')
  reviewRequest(
    @Param('id', new ParseUUIDPipe({ version: '4' })) withdrawalId: string,
    @Body() body: { decision: 'approved' | 'rejected'; notes?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.domainService.reviewWithdrawal({
      withdrawalId,
      adminUserId: user.sub,
      decision: body.decision,
      notes: body.notes,
    });
  }
}
