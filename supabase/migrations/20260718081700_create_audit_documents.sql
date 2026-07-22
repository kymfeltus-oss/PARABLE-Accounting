create table public.audit_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  audit_event_id uuid,
  name text not null,
  document_type text not null default 'other',
  document_date date,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint audit_documents_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint audit_documents_audit_event_id_fkey
    foreign key (audit_event_id)
    references public.audit_events(id)
    on delete set null,

  constraint audit_documents_name_not_blank
    check (char_length(btrim(name)) > 0),

  constraint audit_documents_document_type_valid
    check (
      document_type in (
        'financial',
        'banking',
        'giving',
        'compliance',
        'governance',
        'exception',
        'other'
      )
    ),

  constraint audit_documents_description_not_blank
    check (
      description is null
      or char_length(btrim(description)) > 0
    ),

  constraint audit_documents_status_valid
    check (
      status in (
        'active',
        'archived'
      )
    )
);

alter table public.audit_documents enable row level security;
