begin;

create table if not exists public.organization_daily_payouts (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null references public.attendance_records(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  payout_date date not null,
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  ledger_entry_id uuid references public.ledger_entries(id) on delete restrict,
  gross_property_value numeric(16,2) not null default 0,
  payout_rate numeric(8,6) not null default 0.001,
  attendance_ownership_percent numeric(5,2) not null default 0,
  payout_amount numeric(16,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint organization_daily_payouts_amount_non_negative check (payout_amount >= 0),
  constraint organization_daily_payouts_gross_value_non_negative check (gross_property_value >= 0),
  constraint organization_daily_payouts_rate_non_negative check (payout_rate >= 0),
  constraint organization_daily_payouts_percent_range check (
    attendance_ownership_percent >= 0
    and attendance_ownership_percent <= 100
  ),
  constraint organization_daily_payouts_unique_attendance_org unique (attendance_record_id, organization_id),
  constraint organization_daily_payouts_unique_profile_org_date unique (profile_id, organization_id, payout_date)
);

create index if not exists organization_daily_payouts_organization_date_idx
  on public.organization_daily_payouts (organization_id, payout_date desc);

create index if not exists organization_daily_payouts_profile_date_idx
  on public.organization_daily_payouts (profile_id, payout_date desc);

create index if not exists organization_daily_payouts_wallet_idx
  on public.organization_daily_payouts (wallet_id);

alter table public.organization_daily_payouts enable row level security;

drop policy if exists "Members government and admins can read organization payouts" on public.organization_daily_payouts;
create policy "Members government and admins can read organization payouts"
on public.organization_daily_payouts
for select
using (
  profile_id = auth.uid()
  or public.is_active_organization_member(organization_id, auth.uid())
  or public.is_government_member()
  or public.is_global_admin()
);

drop policy if exists "Government can manage organization payouts" on public.organization_daily_payouts;
create policy "Government can manage organization payouts"
on public.organization_daily_payouts
for all
using (public.is_government_member() or public.is_global_admin())
with check (public.is_government_member() or public.is_global_admin());

create or replace function public.record_attendance_and_daily_payout(
  p_profile_id uuid,
  p_attendance_date date,
  p_minutes_played integer,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid := auth.uid();
  v_attendance_id uuid;
  v_wallet_id uuid;
  v_payout_id uuid;
  v_ledger_entry_id uuid;
  v_gross_property_value numeric(16,2) := 0;
  v_payout_rate numeric(8,6) := 0.001;
  v_payout_amount numeric(16,2) := 0;
  v_org_record record;
  v_org_wallet_id uuid;
  v_org_payout_id uuid;
  v_org_ledger_entry_id uuid;
  v_org_gross_property_value numeric(16,2) := 0;
  v_org_daily_return numeric(16,2) := 0;
  v_org_payout_amount numeric(16,2) := 0;
  v_org_payout_total numeric(16,2) := 0;
  v_org_payout_count integer := 0;
  v_org_payouts jsonb := '[]'::jsonb;
begin
  if not public.is_government_member(v_actor_profile_id) then
    raise exception 'Only government members can register daily payouts.'
      using errcode = '42501';
  end if;

  v_attendance_id := public.record_attendance(
    p_profile_id,
    p_attendance_date,
    p_minutes_played,
    p_notes
  );

  insert into public.wallets (owner_profile_id, currency_symbol)
  values (p_profile_id, 'CC$')
  on conflict do nothing;

  select id
    into v_wallet_id
  from public.wallets
  where owner_profile_id = p_profile_id;

  if v_wallet_id is null then
    raise exception 'Player wallet could not be resolved.'
      using errcode = '23503';
  end if;

  select coalesce(
    round(sum(properties.current_value * (owners.ownership_percent / 100.0)), 2),
    0
  )
    into v_gross_property_value
  from public.property_owners owners
  join public.properties properties on properties.id = owners.property_id
  where owners.owner_type = 'profile'
    and owners.profile_id = p_profile_id
    and properties.status = 'active';

  v_payout_amount := round(v_gross_property_value * v_payout_rate, 2);

  insert into public.daily_payouts (
    attendance_record_id,
    profile_id,
    payout_date,
    wallet_id,
    gross_property_value,
    payout_rate,
    payout_amount,
    metadata,
    created_by
  )
  values (
    v_attendance_id,
    p_profile_id,
    p_attendance_date,
    v_wallet_id,
    v_gross_property_value,
    v_payout_rate,
    v_payout_amount,
    jsonb_build_object(
      'source', 'direct_profile_property_ownership',
      'minutes_played', p_minutes_played
    ),
    v_actor_profile_id
  )
  returning id into v_payout_id;

  if v_payout_amount > 0 then
    v_ledger_entry_id := public.credit_wallet_with_ledger(
      v_wallet_id,
      v_payout_amount,
      'daily_player_payout',
      'daily_payout',
      v_payout_id,
      'Pago diario por asistencia valida',
      jsonb_build_object(
        'attendance_record_id', v_attendance_id,
        'profile_id', p_profile_id,
        'payout_date', p_attendance_date,
        'gross_property_value', v_gross_property_value,
        'payout_rate', v_payout_rate
      ),
      v_actor_profile_id
    );

    update public.daily_payouts
    set ledger_entry_id = v_ledger_entry_id
    where id = v_payout_id;
  end if;

  for v_org_record in
    select
      memberships.organization_id,
      organizations.name as organization_name,
      memberships.ownership_percent
    from public.organization_members memberships
    join public.organizations organizations on organizations.id = memberships.organization_id
    where memberships.profile_id = p_profile_id
      and memberships.is_active = true
      and memberships.ownership_percent > 0
    order by organizations.name asc
  loop
    insert into public.wallets (owner_organization_id, currency_symbol)
    values (v_org_record.organization_id, 'CC$')
    on conflict do nothing;

    select id
      into v_org_wallet_id
    from public.wallets
    where owner_organization_id = v_org_record.organization_id;

    if v_org_wallet_id is null then
      raise exception 'Organization wallet could not be resolved.'
        using errcode = '23503';
    end if;

    select coalesce(
      round(sum(properties.current_value * (owners.ownership_percent / 100.0)), 2),
      0
    )
      into v_org_gross_property_value
    from public.property_owners owners
    join public.properties properties on properties.id = owners.property_id
    where owners.owner_type = 'organization'
      and owners.organization_id = v_org_record.organization_id
      and properties.status = 'active';

    v_org_daily_return := round(v_org_gross_property_value * v_payout_rate, 2);
    v_org_payout_amount := round(v_org_daily_return * (v_org_record.ownership_percent / 100.0), 2);
    v_org_ledger_entry_id := null;

    insert into public.organization_daily_payouts (
      attendance_record_id,
      organization_id,
      profile_id,
      payout_date,
      wallet_id,
      gross_property_value,
      payout_rate,
      attendance_ownership_percent,
      payout_amount,
      metadata,
      created_by
    )
    values (
      v_attendance_id,
      v_org_record.organization_id,
      p_profile_id,
      p_attendance_date,
      v_org_wallet_id,
      v_org_gross_property_value,
      v_payout_rate,
      v_org_record.ownership_percent,
      v_org_payout_amount,
      jsonb_build_object(
        'source', 'organization_property_ownership_by_attending_member',
        'minutes_played', p_minutes_played,
        'organization_daily_return', v_org_daily_return
      ),
      v_actor_profile_id
    )
    returning id into v_org_payout_id;

    if v_org_payout_amount > 0 then
      v_org_ledger_entry_id := public.credit_wallet_with_ledger(
        v_org_wallet_id,
        v_org_payout_amount,
        'daily_org_payout',
        'organization_daily_payout',
        v_org_payout_id,
        'Pago diario proporcional por socio asistente',
        jsonb_build_object(
          'attendance_record_id', v_attendance_id,
          'profile_id', p_profile_id,
          'organization_id', v_org_record.organization_id,
          'payout_date', p_attendance_date,
          'gross_property_value', v_org_gross_property_value,
          'payout_rate', v_payout_rate,
          'organization_daily_return', v_org_daily_return,
          'attendance_ownership_percent', v_org_record.ownership_percent
        ),
        v_actor_profile_id
      );

      update public.organization_daily_payouts
      set ledger_entry_id = v_org_ledger_entry_id
      where id = v_org_payout_id;
    end if;

    insert into public.audit_logs (
      actor_profile_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      v_actor_profile_id,
      'organization_daily_payout.created',
      'organization_daily_payout',
      v_org_payout_id,
      jsonb_build_object(
        'attendance_record_id', v_attendance_id,
        'profile_id', p_profile_id,
        'organization_id', v_org_record.organization_id,
        'payout_date', p_attendance_date,
        'gross_property_value', v_org_gross_property_value,
        'payout_rate', v_payout_rate,
        'organization_daily_return', v_org_daily_return,
        'attendance_ownership_percent', v_org_record.ownership_percent,
        'payout_amount', v_org_payout_amount,
        'ledger_entry_id', v_org_ledger_entry_id
      )
    );

    v_org_payout_count := v_org_payout_count + 1;
    v_org_payout_total := v_org_payout_total + v_org_payout_amount;
    v_org_payouts := v_org_payouts || jsonb_build_array(
      jsonb_build_object(
        'organization_daily_payout_id', v_org_payout_id,
        'organization_id', v_org_record.organization_id,
        'organization_name', v_org_record.organization_name,
        'wallet_id', v_org_wallet_id,
        'ledger_entry_id', v_org_ledger_entry_id,
        'gross_property_value', v_org_gross_property_value,
        'payout_rate', v_payout_rate,
        'organization_daily_return', v_org_daily_return,
        'attendance_ownership_percent', v_org_record.ownership_percent,
        'payout_amount', v_org_payout_amount
      )
    );
  end loop;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_profile_id,
    'daily_payout.created',
    'daily_payout',
    v_payout_id,
    jsonb_build_object(
      'attendance_record_id', v_attendance_id,
      'profile_id', p_profile_id,
      'payout_date', p_attendance_date,
      'gross_property_value', v_gross_property_value,
      'payout_rate', v_payout_rate,
      'payout_amount', v_payout_amount,
      'ledger_entry_id', v_ledger_entry_id,
      'organization_payout_count', v_org_payout_count,
      'organization_payout_total', v_org_payout_total
    )
  );

  return jsonb_build_object(
    'attendance_record_id', v_attendance_id,
    'daily_payout_id', v_payout_id,
    'ledger_entry_id', v_ledger_entry_id,
    'wallet_id', v_wallet_id,
    'gross_property_value', v_gross_property_value,
    'payout_rate', v_payout_rate,
    'payout_amount', v_payout_amount,
    'organization_payout_count', v_org_payout_count,
    'organization_payout_total', v_org_payout_total,
    'organization_payouts', v_org_payouts
  );
end;
$$;

grant execute on function public.record_attendance_and_daily_payout(uuid, date, integer, text) to authenticated;

comment on table public.organization_daily_payouts is
  'Pagos diarios generados a organizaciones segun el porcentaje del socio que registro asistencia valida.';

comment on function public.record_attendance_and_daily_payout(uuid, date, integer, text) is
  'Registra asistencia valida, paga rendimiento directo del jugador y acredita organizaciones proporcionalmente por socio asistente en una sola transaccion.';

commit;
