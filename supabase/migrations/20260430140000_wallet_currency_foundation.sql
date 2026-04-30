begin;

alter table public.wallets
  alter column currency_symbol set default 'CC$';

alter table public.ledger_entries
  alter column currency_symbol set default 'CC$';

update public.wallets
set currency_symbol = 'CC$',
    updated_at = now()
where currency_symbol <> 'CC$';

update public.ledger_entries
set currency_symbol = 'CC$'
where currency_symbol <> 'CC$';

insert into public.wallets (owner_profile_id, currency_symbol)
select profiles.id, 'CC$'
from public.profiles
where not exists (
  select 1
  from public.wallets
  where wallets.owner_profile_id = profiles.id
);

insert into public.wallets (owner_organization_id, currency_symbol)
select organizations.id, 'CC$'
from public.organizations
where not exists (
  select 1
  from public.wallets
  where wallets.owner_organization_id = organizations.id
);

comment on column public.wallets.currency_symbol is
  'Simbolo visible de la moneda ficticia de CityCraft. Valor base: CC$.';

comment on column public.ledger_entries.currency_symbol is
  'Simbolo usado para mostrar el movimiento economico. Valor base: CC$.';

commit;
