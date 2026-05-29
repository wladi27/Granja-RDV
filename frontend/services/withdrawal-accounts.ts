export type WithdrawalAccountType = 'bank' | 'nequi' | 'daviplata' | 'other';

export interface WithdrawalAccount {
  id: string;
  type: WithdrawalAccountType;
  label: string;
  holderName: string;
  identifier: string;
  notes?: string;
  isDefault: boolean;
  createdAt: string;
}

const STORAGE_PREFIX = 'grv_withdrawal_accounts';

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

function readAccounts(userId: string): WithdrawalAccount[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(getStorageKey(userId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as WithdrawalAccount[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => item && typeof item.id === 'string' && typeof item.label === 'string');
  } catch {
    return [];
  }
}

function writeAccounts(userId: string, accounts: WithdrawalAccount[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(accounts));
}

function ensureSingleDefault(accounts: WithdrawalAccount[]): WithdrawalAccount[] {
  if (accounts.length === 0) {
    return [];
  }

  const hasDefault = accounts.some((account) => account.isDefault);
  if (hasDefault) {
    return accounts;
  }

  return accounts.map((account, index) => ({
    ...account,
    isDefault: index === 0,
  }));
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `acc-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function getWithdrawalAccounts(userId: string): WithdrawalAccount[] {
  const accounts = readAccounts(userId);
  return ensureSingleDefault(accounts);
}

export function upsertWithdrawalAccount(
  userId: string,
  accountInput: Omit<WithdrawalAccount, 'id' | 'createdAt'> & { id?: string },
): WithdrawalAccount[] {
  const current = readAccounts(userId);
  const id = accountInput.id ?? createId();
  const existing = current.find((account) => account.id === id);

  const nextAccount: WithdrawalAccount = {
    id,
    type: accountInput.type,
    label: accountInput.label.trim(),
    holderName: accountInput.holderName.trim(),
    identifier: accountInput.identifier.trim(),
    notes: accountInput.notes?.trim() || undefined,
    isDefault: accountInput.isDefault,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  let updated = existing
    ? current.map((account) => (account.id === id ? nextAccount : account))
    : [nextAccount, ...current];

  if (nextAccount.isDefault) {
    updated = updated.map((account) => ({
      ...account,
      isDefault: account.id === nextAccount.id,
    }));
  }

  updated = ensureSingleDefault(updated);
  writeAccounts(userId, updated);
  return updated;
}

export function removeWithdrawalAccount(userId: string, accountId: string): WithdrawalAccount[] {
  const current = readAccounts(userId);
  const updated = ensureSingleDefault(current.filter((account) => account.id !== accountId));
  writeAccounts(userId, updated);
  return updated;
}

export function setDefaultWithdrawalAccount(userId: string, accountId: string): WithdrawalAccount[] {
  const current = readAccounts(userId);
  const updated = ensureSingleDefault(
    current.map((account) => ({
      ...account,
      isDefault: account.id === accountId,
    })),
  );

  writeAccounts(userId, updated);
  return updated;
}

export function getDefaultWithdrawalAccount(userId: string): WithdrawalAccount | null {
  const accounts = getWithdrawalAccounts(userId);
  return accounts.find((account) => account.isDefault) ?? accounts[0] ?? null;
}

export function formatWithdrawalDestination(account: WithdrawalAccount): string {
  const base = `${account.label} - ${account.identifier}`;
  return account.holderName ? `${base} (${account.holderName})` : base;
}
