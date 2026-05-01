begin;

alter table public.ledger_entries
  drop constraint if exists ledger_entries_entry_type_known;

alter table public.ledger_entries
  add constraint ledger_entries_entry_type_known
  check (
    entry_type in (
      'daily_player_payout',
      'daily_org_payout',
      'manual_adjustment',
      'tax',
      'fee',
      'property_sale',
      'property_transfer',
      'auction_settlement',
      'system_adjustment',
      'government_fine'
    )
  );

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid references public.profiles(id) on delete cascade,
  recipient_organization_id uuid references public.organizations(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_single_recipient check (
    ((recipient_profile_id is not null)::int + (recipient_organization_id is not null)::int) = 1
  ),
  constraint notifications_title_length check (char_length(title) between 3 and 140),
  constraint notifications_body_length check (char_length(body) between 3 and 1000)
);

create index if not exists notifications_profile_created_at_idx
  on public.notifications (recipient_profile_id, created_at desc)
  where recipient_profile_id is not null;

create index if not exists notifications_organization_created_at_idx
  on public.notifications (recipient_organization_id, created_at desc)
  where recipient_organization_id is not null;

alter table public.notifications enable row level security;

drop policy if exists "Recipients can read their notifications" on public.notifications;
create policy "Recipients can read their notifications"
on public.notifications
for select
using (
  recipient_profile_id = auth.uid()
  or exists (
    select 1
    from public.organization_members memberships
    where memberships.organization_id = notifications.recipient_organization_id
      and memberships.profile_id = auth.uid()
      and memberships.is_active = true
  )
  or public.is_government_member()
  or public.is_global_admin()
);

create table if not exists public.government_fines (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_profile_id uuid references public.profiles(id) on delete restrict,
  target_organization_id uuid references public.organizations(id) on delete restrict,
  amount numeric(16,2) not null,
  paid_amount numeric(16,2) not null default 0,
  outstanding_amount numeric(16,2) not null default 0,
  status text not null default 'pending',
  reason text not null,
  ledger_entry_id uuid references public.ledger_entries(id) on delete set null,
  notification_id uuid references public.notifications(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint government_fines_target_type_known check (target_type in ('profile', 'organization')),
  constraint government_fines_single_target check (
    (
      target_type = 'profile'
      and target_profile_id is not null
      and target_organization_id is null
    )
    or (
      target_type = 'organization'
      and target_organization_id is not null
      and target_profile_id is null
    )
  ),
  constraint government_fines_amount_positive check (amount > 0),
  constraint government_fines_paid_non_negative check (paid_amount >= 0),
  constraint government_fines_outstanding_non_negative check (outstanding_amount >= 0),
  constraint government_fines_status_known check (status in ('paid', 'debt')),
  constraint government_fines_reason_length check (char_length(reason) between 3 and 1000)
);

create trigger government_fines_set_updated_at
before update on public.government_fines
for each row
execute function public.set_updated_at();

create index if not exists government_fines_profile_created_at_idx
  on public.government_fines (target_profile_id, created_at desc)
  where target_profile_id is not null;

create index if not exists government_fines_organization_created_at_idx
  on public.government_fines (target_organization_id, created_at desc)
  where target_organization_id is not null;

alter table public.government_fines enable row level security;

drop policy if exists "Government fines readable by involved actors" on public.government_fines;
create policy "Government fines readable by involved actors"
on public.government_fines
for select
using (
  public.is_government_member()
  or public.is_global_admin()
  or target_profile_id = auth.uid()
  or exists (
    select 1
    from public.organization_members memberships
    where memberships.organization_id = government_fines.target_organization_id
      and memberships.profile_id = auth.uid()
      and memberships.is_active = true
  )
);

create or replace function public.apply_government_fine(
  p_target_type text,
  p_target_profile_id uuid,
  p_target_organization_id uuid,
  p_amount numeric,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  normalized_target_type text := lower(coalesce(nullif(p_target_type, ''), ''));
  normalized_amount numeric(16,2) := round(coalesce(p_amount, 0), 2);
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
  target_wallet_id uuid;
  target_balance numeric(16,2);
  government_wallet_id uuid;
  created_fine_id uuid;
  created_ledger_id uuid;
  created_notification_id uuid;
  fine_status text;
  paid_value numeric(16,2);
  outstanding_value numeric(16,2);
begin
  if actor_id is null or not public.is_government_member(actor_id) then
    raise exception 'Only government members can apply fines'
      using errcode = '42501';
  end if;

  if normalized_target_type not in ('profile', 'organization') then
    raise exception 'Invalid fine target type'
      using errcode = '23514';
  end if;

  if normalized_amount <= 0 then
    raise exception 'Fine amount must be greater than zero'
      using errcode = '23514';
  end if;

  if normalized_reason is null or char_length(normalized_reason) < 3 or char_length(normalized_reason) > 1000 then
    raise exception 'Fine reason is required'
      using errcode = '23514';
  end if;

  if normalized_target_type = 'profile' then
    if p_target_profile_id is null or p_target_organization_id is not null then
      raise exception 'Profile fine requires profile target only'
        using errcode = '23514';
    end if;

    select id, balance
      into target_wallet_id, target_balance
    from public.wallets
    where owner_profile_id = p_target_profile_id
    for update;
  else
    if p_target_organization_id is null or p_target_profile_id is not null then
      raise exception 'Organization fine requires organization target only'
        using errcode = '23514';
    end if;

    select id, balance
      into target_wallet_id, target_balance
    from public.wallets
    where owner_organization_id = p_target_organization_id
    for update;
  end if;

  if target_wallet_id is null then
    raise exception 'Target wallet does not exist'
      using errcode = '23503';
  end if;

  select wallets.id
    into government_wallet_id
  from public.wallets
  join public.organizations orgs on orgs.id = wallets.owner_organization_id
  where orgs.type = 'government'
  for update;

  if government_wallet_id is null then
    raise exception 'Government wallet does not exist'
      using errcode = '23503';
  end if;

  if target_balance >= normalized_amount then
    fine_status := 'paid';
    paid_value := normalized_amount;
    outstanding_value := 0;

    update public.wallets
    set balance = balance - normalized_amount,
        currency_symbol = 'CC$',
        updated_at = now()
    where id = target_wallet_id;

    update public.wallets
    set balance = balance + normalized_amount,
        currency_symbol = 'CC$',
        updated_at = now()
    where id = government_wallet_id;

    insert into public.ledger_entries (
      entry_type,
      amount,
      currency_symbol,
      from_wallet_id,
      to_wallet_id,
      reference_type,
      description,
      metadata,
      created_by
    )
    values (
      'government_fine',
      normalized_amount,
      'CC$',
      target_wallet_id,
      government_wallet_id,
      'government_fine',
      normalized_reason,
      jsonb_build_object(
        'target_type', normalized_target_type,
        'target_profile_id', p_target_profile_id,
        'target_organization_id', p_target_organization_id
      ),
      actor_id
    )
    returning id into created_ledger_id;
  else
    fine_status := 'debt';
    paid_value := 0;
    outstanding_value := normalized_amount;
  end if;

  insert into public.notifications (
    recipient_profile_id,
    recipient_organization_id,
    type,
    title,
    body,
    metadata
  )
  values (
    case when normalized_target_type = 'profile' then p_target_profile_id else null end,
    case when normalized_target_type = 'organization' then p_target_organization_id else null end,
    'government_fine',
    'Multa del gobierno',
    case
      when fine_status = 'paid' then 'El gobierno aplico una multa y el monto fue cobrado de tu wallet.'
      else 'El gobierno aplico una multa y quedo como adeudo por saldo insuficiente.'
    end,
    jsonb_build_object(
      'amount', normalized_amount,
      'status', fine_status,
      'reason', normalized_reason
    )
  )
  returning id into created_notification_id;

  insert into public.government_fines (
    target_type,
    target_profile_id,
    target_organization_id,
    amount,
    paid_amount,
    outstanding_amount,
    status,
    reason,
    ledger_entry_id,
    notification_id,
    created_by
  )
  values (
    normalized_target_type,
    case when normalized_target_type = 'profile' then p_target_profile_id else null end,
    case when normalized_target_type = 'organization' then p_target_organization_id else null end,
    normalized_amount,
    paid_value,
    outstanding_value,
    fine_status,
    normalized_reason,
    created_ledger_id,
    created_notification_id,
    actor_id
  )
  returning id into created_fine_id;

  if created_ledger_id is not null then
    update public.ledger_entries
    set reference_id = created_fine_id,
        metadata = metadata || jsonb_build_object('government_fine_id', created_fine_id)
    where id = created_ledger_id;
  end if;

  update public.notifications
  set metadata = metadata || jsonb_build_object('government_fine_id', created_fine_id)
  where id = created_notification_id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    actor_id,
    'government.fine_applied',
    'government_fine',
    created_fine_id,
    jsonb_build_object(
      'target_type', normalized_target_type,
      'target_profile_id', p_target_profile_id,
      'target_organization_id', p_target_organization_id,
      'amount', normalized_amount,
      'status', fine_status,
      'paid_amount', paid_value,
      'outstanding_amount', outstanding_value,
      'ledger_entry_id', created_ledger_id,
      'notification_id', created_notification_id,
      'reason', normalized_reason
    )
  );

  return created_fine_id;
end;
$$;

revoke all on function public.apply_government_fine(text, uuid, uuid, numeric, text) from public;
grant execute on function public.apply_government_fine(text, uuid, uuid, numeric, text) to authenticated;

comment on table public.government_fines is
  'Multas aplicadas por gobierno a jugadores u organizaciones. Si no hay saldo suficiente, queda adeudo.';

comment on table public.notifications is
  'Bandeja de notificaciones del sistema para jugadores y organizaciones.';

comment on function public.apply_government_fine(text, uuid, uuid, numeric, text) is
  'Applies a government fine. If target has enough balance, transfers money to government and writes ledger; otherwise creates debt.';

commit;
