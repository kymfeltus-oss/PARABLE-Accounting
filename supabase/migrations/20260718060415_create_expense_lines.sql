create table public.expense_lines (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null,
  account_id uuid not null,
  fund_id uuid,
  line_number integer not null,
  description text,
  amount numeric(18,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expense_lines_expense_id_fkey
    foreign key (expense_id)
    references public.expenses(id)
    on delete cascade,

  constraint expense_lines_account_id_fkey
    foreign key (account_id)
    references public.accounts(id)
    on delete restrict,

  constraint expense_lines_fund_id_fkey
    foreign key (fund_id)
    references public.funds(id)
    on delete restrict,

  constraint expense_lines_line_number_positive
    check (line_number > 0),

  constraint expense_lines_description_not_blank
    check (
      description is null
      or char_length(btrim(description)) > 0
    ),

  constraint expense_lines_amount_positive
    check (amount > 0),

  constraint expense_lines_expense_line_key
    unique (expense_id, line_number)
);

alter table public.expense_lines enable row level security;
