-- Controlled vendor create write path via SECURITY DEFINER RPC.

create or replace function public.create_vendor(
  target_organization_id uuid,
  vendor_name text,
  vendor_email text default null,
  vendor_phone text default null,
  vendor_tax_id_last_four text default null
)
returns public.vendors
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text;
  normalized_email text;
  normalized_phone text;
  normalized_tax_id_last_four text;
  created_vendor public.vendors;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to create vendor';
  end if;

  normalized_name := btrim(vendor_name);

  if normalized_name = '' then
    raise exception 'Vendor name is required';
  end if;

  normalized_email := nullif(btrim(vendor_email), '');
  normalized_phone := nullif(btrim(vendor_phone), '');
  normalized_tax_id_last_four := nullif(btrim(vendor_tax_id_last_four), '');

  if normalized_tax_id_last_four is not null
    and normalized_tax_id_last_four !~ '^[0-9]{4}$' then
    raise exception 'Invalid vendor tax ID last four';
  end if;

  insert into public.vendors (
    organization_id,
    name,
    email,
    phone,
    tax_id_last_four,
    status
  )
  values (
    target_organization_id,
    normalized_name,
    normalized_email,
    normalized_phone,
    normalized_tax_id_last_four,
    'active'
  )
  returning *
  into created_vendor;

  insert into public.audit_events (
    organization_id,
    event_type,
    source_type,
    source_id,
    actor_type,
    actor_user_id,
    description,
    occurred_at
  )
  values (
    target_organization_id,
    'vendor.created',
    'vendor',
    created_vendor.id,
    'user',
    auth.uid(),
    format('Vendor "%s" created', normalized_name),
    now()
  );

  return created_vendor;
end;
$$;

comment on function public.create_vendor(uuid, text, text, text, text) is
  'Creates an active vendor for staff+ members and appends an audit_events row with actor_user_id attribution atomically. SECURITY DEFINER is the sole authenticated write path; no direct table INSERT RLS.';

revoke all on function public.create_vendor(uuid, text, text, text, text) from public;
revoke execute on function public.create_vendor(uuid, text, text, text, text) from anon;
grant execute on function public.create_vendor(uuid, text, text, text, text) to authenticated;
