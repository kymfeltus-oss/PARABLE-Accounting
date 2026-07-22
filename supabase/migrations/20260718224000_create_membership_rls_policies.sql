-- Membership-backed read-only RLS policies for authenticated users.
-- Application repositories still use the service-role client until a later phase.
-- Writes remain service-role/admin only in this step.

create or replace function public.is_organization_member(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
  );
$$;

comment on function public.is_organization_member(uuid) is
  'Returns true when auth.uid() belongs to target_organization_id. SECURITY DEFINER bypasses organization_memberships RLS to avoid recursive policy evaluation.';

revoke all on function public.is_organization_member(uuid) from public;
revoke execute on function public.is_organization_member(uuid) from anon;
grant execute on function public.is_organization_member(uuid) to authenticated;

create policy organizations_select_member
  on public.organizations
  for select
  to authenticated
  using (public.is_organization_member(id));

create policy organization_memberships_select_self
  on public.organization_memberships
  for select
  to authenticated
  using (user_id = auth.uid());

create policy funds_select_member
  on public.funds
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy accounts_select_member
  on public.accounts
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy accounting_periods_select_member
  on public.accounting_periods
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy journal_entries_select_member
  on public.journal_entries
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy journal_entry_lines_select_member_via_journal
  on public.journal_entry_lines
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.journal_entries parent_entry
      where parent_entry.id = journal_entry_lines.journal_entry_id
        and public.is_organization_member(parent_entry.organization_id)
    )
  );

create policy bank_accounts_select_member
  on public.bank_accounts
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy bank_transactions_select_member
  on public.bank_transactions
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy vendors_select_member
  on public.vendors
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy bills_select_member
  on public.bills
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy bill_lines_select_member_via_bill
  on public.bill_lines
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.bills parent_bill
      where parent_bill.id = bill_lines.bill_id
        and public.is_organization_member(parent_bill.organization_id)
    )
  );

create policy bill_payments_select_member
  on public.bill_payments
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy expenses_select_member
  on public.expenses
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy expense_lines_select_member_via_expense
  on public.expense_lines
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.expenses parent_expense
      where parent_expense.id = expense_lines.expense_id
        and public.is_organization_member(parent_expense.organization_id)
    )
  );

create policy budgets_select_member
  on public.budgets
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy budget_lines_select_member_via_budget
  on public.budget_lines
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.budgets parent_budget
      where parent_budget.id = budget_lines.budget_id
        and public.is_organization_member(parent_budget.organization_id)
    )
  );

create policy members_select_member
  on public.members
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy giving_transactions_select_member
  on public.giving_transactions
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy compliance_items_select_member
  on public.compliance_items
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy exceptions_select_member
  on public.exceptions
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy audit_events_select_member
  on public.audit_events
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy audit_documents_select_member
  on public.audit_documents
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy reconciliations_select_member
  on public.reconciliations
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy reconciliation_items_select_member
  on public.reconciliation_items
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy bank_transaction_matches_select_member
  on public.bank_transaction_matches
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy close_sessions_select_member
  on public.close_sessions
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy close_tasks_select_member
  on public.close_tasks
  for select
  to authenticated
  using (public.is_organization_member(organization_id));
