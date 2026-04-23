/**
 * Chart of Accounts: hierarchy, roll-up totals, and sub-account code suggestion.
 * Balances are passed as `Record<accountId, number>` when journal/GL lines exist.
 */

export type CoAAccount = {
  id: string;
  account_code: number;
  account_name: string;
  category: string;
  sub_category: string | null;
  is_restricted: boolean;
  parent_account_id: string | null;
};

export function collectByParent(accounts: CoAAccount[]) {
  const m = new Map<string | null, CoAAccount[]>();
  for (const a of accounts) {
    const p = a.parent_account_id;
    if (!m.has(p)) m.set(p, []);
    m.get(p)!.push(a);
  }
  for (const list of m.values()) {
    list.sort((x, y) => x.account_code - y.account_code);
  }
  return m;
}

/** Ids: this node first, then descendants, children sorted by account_code. */
export function collectAccountTreeIds(rootId: string, accounts: CoAAccount[]): string[] {
  const m = collectByParent(accounts);
  const out: string[] = [];
  const visit = (id: string) => {
    out.push(id);
    for (const c of m.get(id) ?? []) {
      visit(c.id);
    }
  };
  visit(rootId);
  return out;
}

/**
 * Sums the row for `accountCode` plus all descendant rows (e.g. 6100 + 6101 + 6102).
 * Missing balance ids are treated as 0.
 */
export function getAccountTotal(
  accountCode: number,
  accounts: CoAAccount[],
  balanceByAccountId: Record<string, number>
): number {
  const self = accounts.find((a) => a.account_code === accountCode);
  if (!self) return 0;
  const ids = collectAccountTreeIds(self.id, accounts);
  return ids.reduce((s, id) => s + (balanceByAccountId[id] ?? 0), 0);
}

/**
 * Suggest the next sub-account under `parent` (e.g. 6100 then 6101) without colliding
 * on any `account_code` in the same tenant.
 */
export function suggestNextSubAccountCode(parent: CoAAccount, accounts: CoAAccount[]): number {
  const used = new Set(accounts.map((a) => a.account_code));
  const myKids = accounts.filter((a) => a.parent_account_id === parent.id);
  let candidate = myKids.length > 0 ? Math.max(...myKids.map((k) => k.account_code)) : parent.account_code;
  candidate += 1;
  while (used.has(candidate)) {
    candidate += 1;
  }
  return candidate;
}

export type CoADisplayRow = { account: CoAAccount; depth: number };

export function flattenCoaForDisplay(accounts: CoAAccount[]): CoADisplayRow[] {
  const m = collectByParent(accounts);
  const out: CoADisplayRow[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const a of m.get(parentId) ?? []) {
      out.push({ account: a, depth });
      visit(a.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}
