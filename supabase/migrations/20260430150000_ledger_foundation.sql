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
      'system_adjustment'
    )
  );

create index if not exists ledger_entries_from_wallet_created_at_idx
  on public.ledger_entries (from_wallet_id, created_at desc);

create index if not exists ledger_entries_to_wallet_created_at_idx
  on public.ledger_entries (to_wallet_id, created_at desc);

create or replace function public.credit_wallet_with_ledger(
  p_to_wallet_id uuid,
  p_amount numeric,
  p_entry_type text,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_profile_id uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger_entry_id uuid;
begin
  if p_to_wallet_id is null then
    raise exception 'Target wallet is required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero.';
  end if;

  if p_entry_type is null or p_entry_type = '' then
    raise exception 'Entry type is required.';
  end if;

  update public.wallets
  set balance = balance + round(p_amount, 2),
      currency_symbol = 'CC$',
      updated_at = now()
  where id = p_to_wallet_id;

  if not found then
    raise exception 'Wallet % does not exist.', p_to_wallet_id;
  end if;

  insert into public.ledger_entries (
    entry_type,
    amount,
    currency_symbol,
    to_wallet_id,
    reference_type,
    reference_id,
    description,
    metadata,
    created_by
  )
  values (
    p_entry_type,
    round(p_amount, 2),
    'CC$',
    p_to_wallet_id,
    nullif(p_reference_type, ''),
    p_reference_id,
    nullif(p_description, ''),
    coalesce(p_metadata, '{}'::jsonb),
    p_actor_profile_id
  )
  returning id into v_ledger_entry_id;

  return v_ledger_entry_id;
end;
$$;

revoke all on function public.credit_wallet_with_ledger(
  uuid,
  numeric,
  text,
  text,
  uuid,
  text,
  jsonb,
  uuid
) from public;

comment on table public.ledger_entries is
  'Libro auditable de movimientos economicos. Todo cambio de saldo debe quedar registrado aqui.';

comment on function public.credit_wallet_with_ledger(
  uuid,
  numeric,
  text,
  text,
  uuid,
  text,
  jsonb,
  uuid
) is
  'Helper interno para acreditar una wallet e insertar ledger en la misma transaccion. No se expone directo al cliente.';

commit;
