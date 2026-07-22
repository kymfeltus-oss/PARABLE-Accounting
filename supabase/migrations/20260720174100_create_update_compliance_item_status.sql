-- Controlled compliance status write path via SECURITY DEFINER RPC.

create or replace function public.update_compliance_item_status(
  target_organization_id uuid,
  target_item_id uuid,
  next_status text
)
returns public.compliance_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_status text;
  current_item public.compliance_items;
  updated_item public.compliance_items;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to update compliance item status';
  end if;

  normalized_status := btrim(next_status);

  if normalized_status not in ('open', 'completed', 'not_applicable') then
    raise exception 'Invalid compliance item status: %', normalized_status;
  end if;

  select *
  into current_item
  from public.compliance_items
  where id = target_item_id
    and organization_id = target_organization_id
  for update;

  if not found then
    raise exception 'Compliance item not found for organization';
  end if;

  if current_item.status = normalized_status then
    raise exception 'Compliance item status is already %', normalized_status;
  end if;

  update public.compliance_items
  set
    status = normalized_status,
    updated_at = now()
  where id = target_item_id
    and organization_id = target_organization_id
  returning *
  into updated_item;

  insert into public.audit_events (
    organization_id,
    event_type,
    source_type,
    source_id,
    actor_type,
    description,
    occurred_at
  )
  values (
    target_organization_id,
    'compliance.status_updated',
    'compliance_item',
    target_item_id,
    'user',
    format(
      'Compliance item "%s" status changed from %s to %s',
      current_item.name,
      current_item.status,
      normalized_status
    ),
    now()
  );

  return updated_item;
end;
$$;

comment on function public.update_compliance_item_status(uuid, uuid, text) is
  'Updates compliance_items.status for staff+ members and appends an audit_events row atomically. SECURITY DEFINER is the sole authenticated write path; no direct table UPDATE/INSERT RLS.';

revoke all on function public.update_compliance_item_status(uuid, uuid, text) from public;
revoke execute on function public.update_compliance_item_status(uuid, uuid, text) from anon;
grant execute on function public.update_compliance_item_status(uuid, uuid, text) to authenticated;
