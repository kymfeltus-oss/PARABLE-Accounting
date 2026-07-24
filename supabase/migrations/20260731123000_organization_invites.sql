-- Invite-token membership administration (token plaintext generated in app; only hash stored).

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  email text,
  role text not null,
  token_hash text not null,
  status text not null default 'pending',
  invited_by_user_id uuid not null,
  expires_at timestamptz not null,
  accepted_by_user_id uuid,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organization_invites_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint organization_invites_email_not_blank
    check (email is null or char_length(btrim(email)) > 0),

  constraint organization_invites_role_valid
    check (role in ('accountant', 'staff', 'viewer')),

  constraint organization_invites_status_valid
    check (status in ('pending', 'accepted', 'revoked', 'expired')),

  constraint organization_invites_token_hash_format
    check (token_hash ~ '^[a-f0-9]{64}$'),

  constraint organization_invites_token_hash_key
    unique (token_hash),

  constraint organization_invites_accepted_consistency
    check (
      (
        status = 'accepted'
        and accepted_by_user_id is not null
        and accepted_at is not null
      )
      or (
        status <> 'accepted'
        and accepted_by_user_id is null
        and accepted_at is null
      )
    )
);

create index organization_invites_organization_id_idx
  on public.organization_invites (organization_id);

create index organization_invites_status_expires_at_idx
  on public.organization_invites (status, expires_at);

alter table public.organization_invites enable row level security;

create policy organization_invites_select_owner
  on public.organization_invites
  for select
  to authenticated
  using (public.has_org_role(organization_id, array['owner']));

comment on table public.organization_invites is
  'Pending membership invites. App generates token plaintext and stores only sha256 hex hash. Writes via SECURITY DEFINER RPCs only.';

create or replace function public.create_organization_invite(
  target_organization_id uuid,
  invite_role text,
  invite_token_hash text,
  invite_email text default null,
  expires_in_days integer default 14
)
returns public.organization_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_role text;
  normalized_email text;
  normalized_token_hash text;
  normalized_expires_in_days integer;
  created_invite public.organization_invites;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if not public.has_org_role(target_organization_id, array['owner']) then
    raise exception 'Insufficient role to create invite';
  end if;

  normalized_role := lower(btrim(invite_role));

  if normalized_role not in ('accountant', 'staff', 'viewer') then
    raise exception 'Invite role is invalid';
  end if;

  normalized_token_hash := lower(btrim(invite_token_hash));

  if normalized_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invite token hash is invalid';
  end if;

  normalized_email := nullif(lower(btrim(invite_email)), '');
  normalized_expires_in_days := coalesce(expires_in_days, 14);

  if normalized_expires_in_days < 1 or normalized_expires_in_days > 90 then
    raise exception 'Invite expiration must be between 1 and 90 days';
  end if;

  insert into public.organization_invites (
    organization_id,
    email,
    role,
    token_hash,
    status,
    invited_by_user_id,
    expires_at
  )
  values (
    target_organization_id,
    normalized_email,
    normalized_role,
    normalized_token_hash,
    'pending',
    auth.uid(),
    now() + make_interval(days => normalized_expires_in_days)
  )
  returning *
  into created_invite;

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
    'organization_invite.created',
    'organization_invite',
    created_invite.id,
    'user',
    auth.uid(),
    format('Invite created for role %s', normalized_role),
    now()
  );

  return created_invite;
end;
$$;

comment on function public.create_organization_invite(uuid, text, text, text, integer) is
  'Owner-only invite creation. Stores sha256 hex token hash supplied by the app. SECURITY DEFINER write path.';

revoke all on function public.create_organization_invite(uuid, text, text, text, integer) from public;
revoke execute on function public.create_organization_invite(uuid, text, text, text, integer) from anon;
grant execute on function public.create_organization_invite(uuid, text, text, text, integer) to authenticated;

create or replace function public.accept_organization_invite(
  invite_token_hash text
)
returns public.organization_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_token_hash text;
  matched_invite public.organization_invites;
  created_membership public.organization_memberships;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  normalized_token_hash := lower(btrim(invite_token_hash));

  if normalized_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invite token is required';
  end if;

  select invite.*
  into matched_invite
  from public.organization_invites invite
  where invite.token_hash = normalized_token_hash
  for update;

  if matched_invite.id is null then
    raise exception 'Invite token is invalid';
  end if;

  if matched_invite.status = 'revoked' then
    raise exception 'Invite has been revoked';
  end if;

  if matched_invite.status = 'accepted' then
    raise exception 'Invite has already been accepted';
  end if;

  if matched_invite.status = 'expired'
    or matched_invite.expires_at <= now() then
    update public.organization_invites
    set
      status = 'expired',
      updated_at = now()
    where id = matched_invite.id
      and status = 'pending';

    raise exception 'Invite has expired';
  end if;

  if matched_invite.status <> 'pending' then
    raise exception 'Invite is not available';
  end if;

  if exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = matched_invite.organization_id
      and membership.user_id = auth.uid()
  ) then
    raise exception 'User is already a member of this organization';
  end if;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role
  )
  values (
    matched_invite.organization_id,
    auth.uid(),
    matched_invite.role
  )
  returning *
  into created_membership;

  update public.organization_invites
  set
    status = 'accepted',
    accepted_by_user_id = auth.uid(),
    accepted_at = now(),
    updated_at = now()
  where id = matched_invite.id;

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
    matched_invite.organization_id,
    'organization_invite.accepted',
    'organization_invite',
    matched_invite.id,
    'user',
    auth.uid(),
    format('Invite accepted for role %s', matched_invite.role),
    now()
  );

  return created_membership;
end;
$$;

comment on function public.accept_organization_invite(text) is
  'Accepts a pending invite for the authenticated user using the sha256 hex token hash.';

revoke all on function public.accept_organization_invite(text) from public;
revoke execute on function public.accept_organization_invite(text) from anon;
grant execute on function public.accept_organization_invite(text) to authenticated;

create or replace function public.revoke_organization_invite(
  target_organization_id uuid,
  target_invite_id uuid
)
returns public.organization_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_invite public.organization_invites;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if target_invite_id is null then
    raise exception 'Invite is required';
  end if;

  if not public.has_org_role(target_organization_id, array['owner']) then
    raise exception 'Insufficient role to revoke invite';
  end if;

  select invite.*
  into matched_invite
  from public.organization_invites invite
  where invite.id = target_invite_id
    and invite.organization_id = target_organization_id
  for update;

  if matched_invite.id is null then
    raise exception 'Invite not found';
  end if;

  if matched_invite.status <> 'pending' then
    raise exception 'Only pending invites can be revoked';
  end if;

  update public.organization_invites
  set
    status = 'revoked',
    updated_at = now()
  where id = matched_invite.id
  returning *
  into matched_invite;

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
    'organization_invite.revoked',
    'organization_invite',
    matched_invite.id,
    'user',
    auth.uid(),
    'Invite revoked',
    now()
  );

  return matched_invite;
end;
$$;

comment on function public.revoke_organization_invite(uuid, uuid) is
  'Owner-only revoke for pending invites.';

revoke all on function public.revoke_organization_invite(uuid, uuid) from public;
revoke execute on function public.revoke_organization_invite(uuid, uuid) from anon;
grant execute on function public.revoke_organization_invite(uuid, uuid) to authenticated;

create or replace function public.update_membership_role(
  target_organization_id uuid,
  target_membership_id uuid,
  new_role text
)
returns public.organization_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_role text;
  matched_membership public.organization_memberships;
  owner_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if target_membership_id is null then
    raise exception 'Membership is required';
  end if;

  if not public.has_org_role(target_organization_id, array['owner']) then
    raise exception 'Insufficient role to update membership role';
  end if;

  normalized_role := lower(btrim(new_role));

  if normalized_role not in ('owner', 'accountant', 'staff', 'viewer') then
    raise exception 'Membership role is invalid';
  end if;

  select membership.*
  into matched_membership
  from public.organization_memberships membership
  where membership.id = target_membership_id
    and membership.organization_id = target_organization_id
  for update;

  if matched_membership.id is null then
    raise exception 'Membership not found';
  end if;

  if matched_membership.role = 'owner' and normalized_role <> 'owner' then
    select count(*)::integer
    into owner_count
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.role = 'owner';

    if owner_count <= 1 then
      raise exception 'Cannot remove the last organization owner';
    end if;
  end if;

  update public.organization_memberships
  set
    role = normalized_role,
    updated_at = now()
  where id = matched_membership.id
  returning *
  into matched_membership;

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
    'organization_membership.role_updated',
    'organization_membership',
    matched_membership.id,
    'user',
    auth.uid(),
    format('Membership role updated to %s', normalized_role),
    now()
  );

  return matched_membership;
end;
$$;

comment on function public.update_membership_role(uuid, uuid, text) is
  'Owner-only membership role update. Protects against removing the last owner.';

revoke all on function public.update_membership_role(uuid, uuid, text) from public;
revoke execute on function public.update_membership_role(uuid, uuid, text) from anon;
grant execute on function public.update_membership_role(uuid, uuid, text) to authenticated;
