create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null,
  account_id uuid not null,
  fund_id uuid,
  line_number integer not null,
  description text,
  amount numeric(18,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint budget_lines_budget_id_fkey
    foreign key (budget_id)
    references public.budgets(id)
    on delete cascade,

  constraint budget_lines_account_id_fkey
    foreign key (account_id)
    references public.accounts(id)
    on delete restrict,

  constraint budget_lines_fund_id_fkey
    foreign key (fund_id)
    references public.funds(id)
    on delete restrict,

  constraint budget_lines_line_number_positive
    check (line_number > 0),

  constraint budget_lines_description_not_blank
    check (
      description is null
      or char_length(btrim(description)) > 0
    ),

  constraint budget_lines_amount_nonnegative
    check (amount >= 0),

  constraint budget_lines_budget_line_key
    unique (budget_id, line_number)
);

alter table public.budget_lines enable row level security;
