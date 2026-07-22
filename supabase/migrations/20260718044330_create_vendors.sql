create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  email text,
  phone text,
  tax_id_last_four text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vendors_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint vendors_name_not_blank
    check (char_length(btrim(name)) > 0),

  constraint vendors_email_not_blank
    check (
      email is null
      or char_length(btrim(email)) > 0
    ),

  constraint vendors_phone_not_blank
    check (
      phone is null
      or char_length(btrim(phone)) > 0
    ),

  constraint vendors_tax_id_last_four_valid
    check (
      tax_id_last_four is null
      or tax_id_last_four ~ '^[0-9]{4}$'
    ),

  constraint vendors_status_valid
    check (status in ('active', 'inactive')),

  constraint vendors_organization_name_key
    unique (organization_id, name)
);

alter table public.vendors enable row level security;
