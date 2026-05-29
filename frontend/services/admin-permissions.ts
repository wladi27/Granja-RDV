import { AdminPermission } from '@/types/domain';

export type AdminModuleKey = 'home' | 'orders' | 'inventory' | 'withdrawals' | 'config';

const modulePermissionAny: Record<AdminModuleKey, AdminPermission[]> = {
	home: ['dashboard.view'],
	orders: ['orders.view', 'orders.manage'],
	inventory: ['inventory.manage'],
	withdrawals: ['withdrawals.manage'],
	config: ['config.manage'],
};

const moduleRoute: Record<AdminModuleKey, string> = {
	home: '/admin',
	orders: '/admin/orders',
	inventory: '/admin/inventory',
	withdrawals: '/admin/withdrawals',
	config: '/admin/config',
};

const moduleOrder: AdminModuleKey[] = ['home', 'orders', 'inventory', 'withdrawals', 'config'];

export function hasAdminPermission(permissions: AdminPermission[] | undefined, permission: AdminPermission): boolean {
	if (!permissions || permissions.length === 0) {
		return false;
	}

	return permissions.includes('*') || permissions.includes(permission);
}

export function canAccessAdminModule(
	permissions: AdminPermission[] | undefined,
	module: AdminModuleKey,
): boolean {
	const requiredAny = modulePermissionAny[module];
	return requiredAny.some((permission) => hasAdminPermission(permissions, permission));
}

export function getAdminModuleRoute(module: AdminModuleKey): string {
	return moduleRoute[module];
}

export function getFirstAccessibleAdminRoute(permissions: AdminPermission[] | undefined): string {
	for (const module of moduleOrder) {
		if (canAccessAdminModule(permissions, module)) {
			return moduleRoute[module];
		}
	}

	return '/admin';
}
