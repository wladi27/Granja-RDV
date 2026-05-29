import {
  Body,
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth.types';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { DomainService } from '../../common/domain.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly domainService: DomainService) {}

  @Get(':id/dashboard')
  getDashboard(
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== 'admin' && user.sub !== userId) {
      throw new ForbiddenException('You can only access your own dashboard');
    }

    return this.domainService.getDashboard(userId);
  }

  @Get(':id/orders')
  getUserOrders(
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== 'admin' && user.sub !== userId) {
      throw new ForbiddenException('You can only access your own orders');
    }

    return this.domainService.getUserOrdersPage(userId, page, pageSize);
  }

  @Get(':id/network')
  getNetwork(
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== 'admin' && user.sub !== userId) {
      throw new ForbiddenException('You can only access your own referral network');
    }

    return this.domainService.getReferralNetwork(userId);
  }

  @Get(':id/network/summary')
  getNetworkSummary(
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Query('maxDepth', new DefaultValuePipe(7), ParseIntPipe) maxDepth: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== 'admin' && user.sub !== userId) {
      throw new ForbiddenException('You can only access your own referral network');
    }

    return this.domainService.getReferralNetworkSummary(userId, maxDepth);
  }

  @Get(':id/network/levels/:level/members')
  getNetworkLevelMembers(
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Param('level', ParseIntPipe) level: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
    @Query('maxDepth', new DefaultValuePipe(7), ParseIntPipe) maxDepth: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== 'admin' && user.sub !== userId) {
      throw new ForbiddenException('You can only access your own referral network');
    }

    return this.domainService.getReferralNetworkLevelMembers(userId, level, page, pageSize, maxDepth);
  }

  @Get(':id/wallet/summary')
  getWalletSummary(
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== 'admin' && user.sub !== userId) {
      throw new ForbiddenException('You can only access your own wallet summary');
    }

    return this.domainService.getWalletSummary(userId);
  }

  @Get(':id/wallet/movements')
  getWalletMovements(
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== 'admin' && user.sub !== userId) {
      throw new ForbiddenException('You can only access your own wallet movements');
    }

    return this.domainService.getWalletMovements(userId, page, pageSize);
  }

  @Post(':id/wallet/pay-admin')
  payAdminFromWallet(
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() body: { amountCop: number; notes?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== 'admin' && user.sub !== userId) {
      throw new ForbiddenException('You can only use your own wallet');
    }

    return this.domainService.payAdminFromWallet({
      userId,
      amountCop: body.amountCop,
      notes: body.notes,
    });
  }

  @Patch(':id/profile')
  updateProfile(
    @Param('id', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body()
    body: {
      username?: string;
      fullName?: string;
      email?: string;
      whatsappPhone?: string;
      currentPassword?: string;
      newPassword?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role !== 'admin' && user.sub !== userId) {
      throw new ForbiddenException('You can only update your own profile');
    }

    return this.domainService.updateUserProfile({
      userId,
      username: body.username,
      fullName: body.fullName,
      email: body.email,
      whatsappPhone: body.whatsappPhone,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
  }

  @Get('referral/:code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getUserByReferralCode(@Param('code') code: string) {
    return this.domainService.getUserByReferralCode(code);
  }
}
