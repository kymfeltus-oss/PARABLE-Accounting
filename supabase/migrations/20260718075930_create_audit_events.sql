create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_type text not null,
  source_type text not null,
  source_id uuid,
  actor_type text not null default 'system',
  description text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint audit_events_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint audit_events_event_type_not_blank
    check (char_length(btrim(event_type)) > 0),

  constraint audit_events_source_type_not_blank
    check (char_length(btrim(source_type)) > 0),

  constraint audit_events_actor_type_valid
    check (
      actor_type in (
        'system',
        'user',
        'integration'
      )
    ),

  constraint audit_events_description_not_blank
    check (
      description is null
      or char_length(btrim(description)) > 0
    )
);

alter table public.audit_events enable row level security;
