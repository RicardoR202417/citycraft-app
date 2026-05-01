create or replace function public.reverse_ledger_entry(
  p_ledger_entry_id uuid,
  p_reason text,
  p_actor_profile_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original public.ledger_entries%rowtype;
  v_wallet public.wallets%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_reversal_id uuid;
  v_existing_reversal_id uuid;
begin
  if auth.role() <> 'service_role' and p_actor_profile_id <> auth.uid() then
    raise exception 'Actor does not match authenticated user.'
      using errcode = '42501';
  end if;

  if not public.is_global_admin(p_actor_profile_id) then
    raise exception 'Only global admins can reverse ledger entries.'
      using errcode = '42501';
  end if;

  if p_ledger_entry_id is null then
    raise exception 'Ledger entry is required.'
      using errcode = '23502';
  end if;

  if v_reason is null or char_length(v_reason) < 3 or char_length(v_reason) > 240 then
    raise exception 'A reversal reason between 3 and 240 characters is required.'
      using errcode = '23514';
  end if;

  select *
    into v_original
  from public.ledger_entries
  where id = p_ledger_entry_id;

  if not found then
    raise exception 'Ledger entry not found.'
      using errcode = 'P0002';
  end if;

  if v_original.reference_type = 'ledger_reversal' then
    raise exception 'Reversal entries cannot be reversed by this operation.'
      using errcode = '23514';
  end if;

  if v_original.to_wallet_id is null then
    raise exception 'Only credited ledger entries can be reversed by this operation.'
      using errcode = '23514';
  end if;

  select id
    into v_existing_reversal_id
  from public.ledger_entries
  where reference_type = 'ledger_reversal'
    and reference_id = v_original.id
  limit 1;

  if v_existing_reversal_id is not null then
    raise exception 'Ledger entry already has a reversal.'
      using errcode = '23505';
  end if;

  select *
    into v_wallet
  from public.wallets
  where id = v_original.to_wallet_id
  for update;

  if not found then
    raise exception 'Target wallet not found.'
      using errcode = '23503';
  end if;

  if v_wallet.balance < v_original.amount then
    raise exception 'Wallet has insufficient balance for reversal.'
      using errcode = '23514';
  end if;

  update public.wallets
  set balance = balance - v_original.amount,
      updated_at = now()
  where id = v_original.to_wallet_id;

  insert into public.ledger_entries (
    entry_type,
    amount,
    currency_symbol,
    from_wallet_id,
    reference_type,
    reference_id,
    description,
    metadata,
    created_by
  )
  values (
    'manual_adjustment',
    v_original.amount,
    v_original.currency_symbol,
    v_original.to_wallet_id,
    'ledger_reversal',
    v_original.id,
    concat('Reversion: ', v_reason),
    jsonb_build_object(
      'reason', v_reason,
      'reverses_ledger_entry_id', v_original.id,
      'original_entry_type', v_original.entry_type,
      'original_amount', v_original.amount,
      'original_to_wallet_id', v_original.to_wallet_id,
      'original_reference_type', v_original.reference_type,
      'original_reference_id', v_original.reference_id
    ),
    p_actor_profile_id
  )
  returning id into v_reversal_id;

  insert into public.audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_actor_profile_id,
    'admin.ledger_entry_reversed',
    'ledger_entry',
    v_original.id,
    jsonb_build_object(
      'reason', v_reason,
      'reversal_ledger_entry_id', v_reversal_id,
      'original_entry_type', v_original.entry_type,
      'amount', v_original.amount,
      'wallet_id', v_original.to_wallet_id
    )
  );

  return jsonb_build_object(
    'ledger_entry_id', v_original.id,
    'reversal_ledger_entry_id', v_reversal_id,
    'wallet_id', v_original.to_wallet_id,
    'amount', v_original.amount
  );
end;
$$;

grant execute on function public.reverse_ledger_entry(uuid, text, uuid) to authenticated;

comment on function public.reverse_ledger_entry(uuid, text, uuid) is
  'Crea una compensacion de ledger para revertir una acreditacion sin borrar el movimiento original.';
