import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth.types';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { PermissionsGuard } from '../../common/permissions.guard';
import { Permissions } from '../../common/permissions.decorator';
import { DomainService } from '../../common/domain.service';
import { DeliveryMethod, PaymentMethod } from '../../domain/models';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly domainService: DomainService) {}

  @Get('admin/overview')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('dashboard.view')
  getAdminOverview() {
    return this.domainService.getAdminOverview();
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('orders.view')
  getAdminOrders(@Query('limit') limit?: string) {
    return this.domainService.getAdminOrders(limit ? Number(limit) : 50);
  }

  @Get('admin/couriers')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('orders.view')
  getCouriers() {
    return this.domainService.getCouriers();
  }

  @Get('courier/my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('courier', 'admin')
  getCourierOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.domainService.getCourierOrdersPage(user.sub, page ? Number(page) : 1, pageSize ? Number(pageSize) : 10);
  }

  @Get('courier/route')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('courier', 'admin')
  getCourierRoute(@CurrentUser() user: AuthenticatedUser) {
    return this.domainService.getCourierRoute(user.sub);
  }

  @Get('courier/delivered')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('courier', 'admin')
  getCourierDeliveredOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('customerName') customerName?: string,
    @Query('phone') phone?: string,
    @Query('orderId') orderId?: string,
    @Query('q') q?: string,
  ) {
    return this.domainService.getCourierDeliveredOrdersPage(user.sub, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 10,
      fromDate,
      toDate,
      customerName,
      phone,
      orderId,
      q,
    });
  }

  @Post(':id/courier-route')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('courier', 'admin')
  addOrderToCourierRoute(@Param('id') orderId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.domainService.addOrderToCourierRoute(user.sub, orderId);
  }

  @Patch('courier/route')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('courier', 'admin')
  reorderCourierRoute(@CurrentUser() user: AuthenticatedUser, @Body() body: { orderIds: string[] }) {
    return this.domainService.reorderCourierRoute(user.sub, Array.isArray(body.orderIds) ? body.orderIds : []);
  }

  @Post()
  createOrder(
    @Body()
    body: {
      userId?: string;
      paymentMethod: PaymentMethod;
      deliveryMethod: DeliveryMethod;
      deliveryFeeCop?: number;
      address?: string;
      phone?: string;
      useWallet: boolean;
      paymentProofDataUrl?: string;
      items: Array<{ productId: string; quantity: number }>;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const targetUserId = body.userId ?? user.sub;
    if (user.role !== 'admin' && targetUserId !== user.sub) {
      throw new ForbiddenException('You can only create orders for your own account');
    }

    return this.domainService.createOrder({ ...body, userId: targetUserId });
  }

  @Patch(':id/confirm-payment')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('orders.manage')
  confirmPayment(@Param('id') orderId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.domainService.confirmPayment(orderId, user.sub);
  }

  @Patch(':id/reject-payment')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('orders.manage')
  rejectPayment(
    @Param('id') orderId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.domainService.rejectPayment(orderId, user.sub, body.reason);
  }

  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('orders.manage')
  confirmOrder(@Param('id') orderId: string) {
    return this.domainService.confirmOrder(orderId);
  }

  @Patch(':id/assign-courier')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('orders.manage')
  assignCourier(@Param('id') orderId: string, @Body() body: { courierId: string }) {
    return this.domainService.assignCourier(orderId, body.courierId);
  }

  @Patch(':id/courier-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('courier', 'admin')
  updateCourierStatus(
    @Param('id') orderId: string,
    @Body()
    body: {
      status: 'picked_up' | 'on_the_way';
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role === 'courier') {
      return this.domainService.getOrderById(orderId).then((order) => {
        if (order.courierId !== user.sub) {
          throw new ForbiddenException('You can only update your assigned deliveries');
        }

        return this.domainService.updateCourierStatus({
          orderId,
          status: body.status,
        });
      });
    }

    return this.domainService.updateCourierStatus({
      orderId,
      status: body.status,
    });
  }

  @Get(':id/delivery-qr')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('courier', 'admin')
  getDeliveryQr(@Param('id') orderId: string, @CurrentUser() user: AuthenticatedUser) {
    if (user.role === 'courier') {
      return this.domainService.getOrderById(orderId).then((order) => {
        if (order.courierId !== user.sub) {
          throw new ForbiddenException('You can only generate QR for your assigned deliveries');
        }

        return this.domainService.generateDeliveryConfirmationToken(orderId);
      });
    }

    return this.domainService.generateDeliveryConfirmationToken(orderId);
  }

  @Patch(':id/customer-receipt')
  confirmCustomerReceipt(
    @Param('id') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.domainService.getOrderById(orderId).then((order) => {
      if (user.role !== 'admin' && order.userId !== user.sub) {
        throw new ForbiddenException('You can only confirm receipt for your own order');
      }

      return this.domainService.confirmCustomerReceipt({
        orderId,
      });
    });
  }
}
