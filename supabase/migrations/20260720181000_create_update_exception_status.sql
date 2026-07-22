-- Controlled exception status write path via SECURITY DEFINER RPC.

create or replace function public.update_exception_status(
  target_organization_id uuid,
  target_exception_id uuid,
  next_status text
)
returns public.exceptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_status text;
  current_exception public.exceptions;
  updated_exception public.exceptions;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to update exception status';
  end if;

  normalized_status := btrim(next_status);

  if normalized_status not in ('open', 'resolved', 'dismissed') then
    raise exception 'Invalid exception status: %', normalized_status;
  end if;

  select *
  into current_exception
  from public.exceptions
  where id = target_exception_id
    and organization_id = target_organization_id
  for update;

  if not found then
    raise exception 'Exception not found for organization';
  end if;

  if current_exception.status = normalized_status then
    raise exception 'Exception status is already %', normalized_status;
  end if;

  update public.exceptions
  set
    status = normalized_status,
    updated_at = now()
  where id = target_exception_id
    and organization_id = target_organization_id
  returning *
  into updated_exception;

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
    'exception.status_updated',
    'exception',
    target_exception_id,
    'user',
    auth.uid(),
    format(
      'Exception "%s" status changed from %s to %s',
      current_exception.title,
      current_exception.status,
      normalized_status
    ),
    now()
  );

  return updated_exception;
end;
$$;

comment on function public.update_exception_status(uuid, uuid, text) is
  'Updates exceptions.status for staff+ members and appends an audit_events row with actor_user_id attribution atomically. SECURITY DEFINER is the sole authenticated write path; no direct table UPDATE/INSERT RLS.';

revoke all on function public.update_exception_status(uuid, uuid, text) from public;
revoke execute on function public.update_exception_status(uuid, uuid, text) from anon;
grant execute on function public.update_exception_status(uuid, uuid, text) to authenticated;
