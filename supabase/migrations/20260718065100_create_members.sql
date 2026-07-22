create table public.members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint members_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint members_first_name_not_blank
    check (char_length(btrim(first_name)) > 0),

  constraint members_last_name_not_blank
    check (char_length(btrim(last_name)) > 0),

  constraint members_email_not_blank
    check (
      email is null
      or char_length(btrim(email)) > 0
    ),

  constraint members_phone_not_blank
    check (
      phone is null
      or char_length(btrim(phone)) > 0
    ),

  constraint members_status_valid
    check (
      status in (
        'active',
        'inactive'
      )
    )
);

alter table public.members enable row level security;
