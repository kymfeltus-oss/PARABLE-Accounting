create table public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null,
  account_id uuid not null,
  fund_id uuid,
  line_number integer not null,
  description text,
  debit_amount numeric(18,2) not null default 0,
  credit_amount numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint journal_entry_lines_journal_entry_id_fkey
    foreign key (journal_entry_id)
    references public.journal_entries(id)
    on delete cascade,

  constraint journal_entry_lines_account_id_fkey
    foreign key (account_id)
    references public.accounts(id)
    on delete restrict,

  constraint journal_entry_lines_fund_id_fkey
    foreign key (fund_id)
    references public.funds(id)
    on delete restrict,

  constraint journal_entry_lines_line_number_positive
    check (line_number > 0),

  constraint journal_entry_lines_debit_nonnegative
    check (debit_amount >= 0),

  constraint journal_entry_lines_credit_nonnegative
    check (credit_amount >= 0),

  constraint journal_entry_lines_one_sided_amount
    check (
      (debit_amount > 0 and credit_amount = 0)
      or
      (credit_amount > 0 and debit_amount = 0)
    ),

  constraint journal_entry_lines_journal_line_key
    unique (journal_entry_id, line_number)
);

alter table public.journal_entry_lines enable row level security;
