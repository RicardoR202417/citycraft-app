create or replace function public.calculate_organization_market_value(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_wallet_balance numeric(14, 2) := 0;
  v_property_value numeric(14, 2) := 0;
  v_property_count integer := 0;
  v_stability_adjustment numeric(14, 2) := 0;
  v_activity_adjustment numeric(14, 2) := 0;
  v_market_value numeric(14, 2) := 0;
  v_is_service_role boolean := auth.role() = 'service_role';
  v_is_member boolean := false;
  v_is_admin boolean := false;
begin
  if not exists (
    select 1
    from public.organizations organization_record
    where organization_record.id = p_organization_id
  ) then
    raise exception 'Organization not found'
      using errcode = 'P0002';
  end if;

  if auth.uid() is not null then
    v_is_member := public.is_active_organization_member(p_organization_id, auth.uid());
    v_is_admin := public.is_global_admin(auth.uid());
  end if;

  if not v_is_service_role and not v_is_member and not v_is_admin then
    raise exception 'Not allowed to calculate organization market value'
      using errcode = '42501';
  end if;

  select coalesce(
    (
      select wallet_record.balance
      from public.wallets wallet_record
      where wallet_record.owner_organization_id = p_organization_id
      limit 1
    ),
    0
  )
  into v_wallet_balance;

  select
    coalesce(round(sum(property_record.current_value * owner_record.ownership_percent / 100.0), 2), 0),
    count(owner_record.id)
  into v_property_value, v_property_count
  from public.property_owners owner_record
  join public.properties property_record on property_record.id = owner_record.property_id
  where owner_record.owner_type = 'organization'
    and owner_record.organization_id = p_organization_id
    and property_record.status = 'active';

  v_market_value := v_wallet_balance + v_property_value + v_stability_adjustment + v_activity_adjustment;

  return jsonb_build_object(
    'wallet_balance', v_wallet_balance,
    'property_value', v_property_value,
    'property_count', v_property_count,
    'stability_adjustment', v_stability_adjustment,
    'activity_adjustment', v_activity_adjustment,
    'market_value', v_market_value,
    'formula_version', 'org_market_value_v1'
  );
end;
$$;

grant execute on function public.calculate_organization_market_value(uuid) to authenticated;

comment on function public.calculate_organization_market_value(uuid)
  is 'Calcula el patrimonio inicial de una organizacion: wallet + valor proporcional de propiedades activas + ajustes futuros.';
