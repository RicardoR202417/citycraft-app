create or replace function public.close_expired_auctions(
  p_limit integer default 50
)
returns table (
  auction_id uuid,
  status public.auction_status,
  winning_bid_id uuid,
  winning_bid_amount numeric,
  notifications_created integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_auction public.auctions%rowtype;
  v_winning_bid public.auction_bids%rowtype;
  v_seller_owner public.property_owners%rowtype;
  v_winner_owner public.property_owners%rowtype;
  v_winner_wallet public.wallets%rowtype;
  v_seller_wallet public.wallets%rowtype;
  v_sale_percent numeric(5,2);
  v_seller_remaining_percent numeric(5,2);
  v_ledger_entry_id uuid;
  v_seller_notification_id uuid;
  v_winner_notification_id uuid;
  v_failure_notification_id uuid;
  v_notifications_created integer;
  v_participant record;
begin
  for v_auction in
    select auctions.*
    from public.auctions auctions
    where auctions.status = 'active'
      and auctions.ends_at <= now()
    order by auctions.ends_at asc
    limit v_limit
    for update skip locked
  loop
    v_notifications_created := 0;
    v_winning_bid := null;
    v_seller_owner := null;
    v_winner_wallet := null;
    v_seller_wallet := null;
    v_ledger_entry_id := null;
    v_seller_notification_id := null;
    v_winner_notification_id := null;
    v_failure_notification_id := null;

    select *
      into v_winning_bid
    from public.auction_bids
    where auction_bids.auction_id = v_auction.id
      and auction_bids.status = 'leading'
    order by auction_bids.bid_amount desc, auction_bids.created_at desc
    limit 1
    for update;

    if v_winning_bid.id is null then
      update public.auctions
      set status = 'expired'
      where auctions.id = v_auction.id
        and auctions.status = 'active';

      insert into public.notifications (
        recipient_profile_id,
        recipient_organization_id,
        type,
        title,
        body,
        metadata
      )
      values (
        case when v_auction.seller_owner_type = 'profile' then v_auction.seller_profile_id else null end,
        case when v_auction.seller_owner_type = 'organization' then v_auction.seller_organization_id else null end,
        'auction_closed',
        'Subasta cerrada',
        'Tu subasta termino sin pujas validas.',
        jsonb_build_object(
          'auction_id', v_auction.id,
          'property_id', v_auction.property_id,
          'closed_at', now(),
          'settlement_status', 'no_bids'
        )
      );
      v_notifications_created := v_notifications_created + 1;

      insert into public.audit_logs (
        actor_profile_id,
        action,
        entity_type,
        entity_id,
        metadata
      )
      values (
        null,
        'auction.closed',
        'auction',
        v_auction.id,
        jsonb_build_object(
          'property_id', v_auction.property_id,
          'notifications_created', v_notifications_created,
          'closed_at', now(),
          'closed_by', 'cron',
          'settlement_status', 'no_bids'
        )
      );

      auction_id := v_auction.id;
      status := 'expired';
      winning_bid_id := null;
      winning_bid_amount := null;
      notifications_created := v_notifications_created;
      return next;
      continue;
    end if;

    if v_auction.property_owner_id is null then
      update public.auctions
      set status = 'expired'
      where auctions.id = v_auction.id
        and auctions.status = 'active';

      update public.auction_bids
      set status = 'failed'
      where id = v_winning_bid.id;

      insert into public.notifications (
        recipient_profile_id,
        recipient_organization_id,
        type,
        title,
        body,
        metadata
      )
      values (
        case when v_auction.seller_owner_type = 'profile' then v_auction.seller_profile_id else null end,
        case when v_auction.seller_owner_type = 'organization' then v_auction.seller_organization_id else null end,
        'auction_settlement_failed',
        'Subasta sin liquidacion',
        'La subasta no pudo liquidarse porque ya no existe el registro de propiedad vendedora.',
        jsonb_build_object(
          'auction_id', v_auction.id,
          'auction_bid_id', v_winning_bid.id,
          'property_id', v_auction.property_id,
          'amount', v_winning_bid.bid_amount,
          'reason', 'missing_seller_ownership'
        )
      )
      returning id into v_failure_notification_id;
      v_notifications_created := v_notifications_created + 1;

      insert into public.audit_logs (
        actor_profile_id,
        action,
        entity_type,
        entity_id,
        metadata
      )
      values (
        null,
        'auction.settlement_failed',
        'auction',
        v_auction.id,
        jsonb_build_object(
          'property_id', v_auction.property_id,
          'winning_bid_id', v_winning_bid.id,
          'winning_bid_amount', v_winning_bid.bid_amount,
          'reason', 'missing_seller_ownership',
          'notification_id', v_failure_notification_id
        )
      );

      auction_id := v_auction.id;
      status := 'expired';
      winning_bid_id := v_winning_bid.id;
      winning_bid_amount := v_winning_bid.bid_amount;
      notifications_created := v_notifications_created;
      return next;
      continue;
    end if;

    select *
      into v_seller_owner
    from public.property_owners
    where id = v_auction.property_owner_id
    for update;

    if not found or v_seller_owner.property_id <> v_auction.property_id then
      update public.auctions
      set status = 'expired'
      where auctions.id = v_auction.id
        and auctions.status = 'active';

      update public.auction_bids
      set status = 'failed'
      where id = v_winning_bid.id;

      insert into public.notifications (
        recipient_profile_id,
        recipient_organization_id,
        type,
        title,
        body,
        metadata
      )
      values (
        case when v_auction.seller_owner_type = 'profile' then v_auction.seller_profile_id else null end,
        case when v_auction.seller_owner_type = 'organization' then v_auction.seller_organization_id else null end,
        'auction_settlement_failed',
        'Subasta sin liquidacion',
        'La subasta no pudo liquidarse porque la propiedad vendedora ya no coincide con la subasta.',
        jsonb_build_object(
          'auction_id', v_auction.id,
          'auction_bid_id', v_winning_bid.id,
          'property_id', v_auction.property_id,
          'amount', v_winning_bid.bid_amount,
          'reason', 'seller_ownership_mismatch'
        )
      )
      returning id into v_failure_notification_id;
      v_notifications_created := v_notifications_created + 1;

      insert into public.audit_logs (
        actor_profile_id,
        action,
        entity_type,
        entity_id,
        metadata
      )
      values (
        null,
        'auction.settlement_failed',
        'auction',
        v_auction.id,
        jsonb_build_object(
          'property_id', v_auction.property_id,
          'winning_bid_id', v_winning_bid.id,
          'winning_bid_amount', v_winning_bid.bid_amount,
          'reason', 'seller_ownership_mismatch',
          'notification_id', v_failure_notification_id
        )
      );

      auction_id := v_auction.id;
      status := 'expired';
      winning_bid_id := v_winning_bid.id;
      winning_bid_amount := v_winning_bid.bid_amount;
      notifications_created := v_notifications_created;
      return next;
      continue;
    end if;

    if v_winning_bid.bidder_owner_type = 'profile' then
      select *
        into v_winner_wallet
      from public.wallets
      where owner_profile_id = v_winning_bid.bidder_profile_id
      for update;
    else
      select *
        into v_winner_wallet
      from public.wallets
      where owner_organization_id = v_winning_bid.bidder_organization_id
      for update;
    end if;

    if v_auction.seller_owner_type = 'profile' then
      select *
        into v_seller_wallet
      from public.wallets
      where owner_profile_id = v_auction.seller_profile_id
      for update;
    else
      select *
        into v_seller_wallet
      from public.wallets
      where owner_organization_id = v_auction.seller_organization_id
      for update;
    end if;

    if v_winner_wallet.id is null or v_seller_wallet.id is null then
      update public.auctions
      set status = 'expired'
      where auctions.id = v_auction.id
        and auctions.status = 'active';

      update public.auction_bids
      set status = 'failed'
      where id = v_winning_bid.id;

      insert into public.notifications (
        recipient_profile_id,
        recipient_organization_id,
        type,
        title,
        body,
        metadata
      )
      values (
        case when v_winning_bid.bidder_owner_type = 'profile' then v_winning_bid.bidder_profile_id else null end,
        case when v_winning_bid.bidder_owner_type = 'organization' then v_winning_bid.bidder_organization_id else null end,
        'auction_settlement_failed',
        'Subasta sin liquidacion',
        'La subasta no pudo liquidarse porque falta una wallet necesaria.',
        jsonb_build_object(
          'auction_id', v_auction.id,
          'auction_bid_id', v_winning_bid.id,
          'property_id', v_auction.property_id,
          'amount', v_winning_bid.bid_amount,
          'reason', 'missing_wallet'
        )
      )
      returning id into v_failure_notification_id;
      v_notifications_created := v_notifications_created + 1;

      insert into public.audit_logs (
        actor_profile_id,
        action,
        entity_type,
        entity_id,
        metadata
      )
      values (
        null,
        'auction.settlement_failed',
        'auction',
        v_auction.id,
        jsonb_build_object(
          'property_id', v_auction.property_id,
          'winning_bid_id', v_winning_bid.id,
          'winning_bid_amount', v_winning_bid.bid_amount,
          'reason', 'missing_wallet',
          'notification_id', v_failure_notification_id
        )
      );

      auction_id := v_auction.id;
      status := 'expired';
      winning_bid_id := v_winning_bid.id;
      winning_bid_amount := v_winning_bid.bid_amount;
      notifications_created := v_notifications_created;
      return next;
      continue;
    end if;

    if v_winner_wallet.balance < v_winning_bid.bid_amount then
      update public.auctions
      set status = 'expired'
      where auctions.id = v_auction.id
        and auctions.status = 'active';

      update public.auction_bids
      set status = 'failed'
      where id = v_winning_bid.id;

      insert into public.notifications (
        recipient_profile_id,
        recipient_organization_id,
        type,
        title,
        body,
        metadata
      )
      values (
        case when v_winning_bid.bidder_owner_type = 'profile' then v_winning_bid.bidder_profile_id else null end,
        case when v_winning_bid.bidder_owner_type = 'organization' then v_winning_bid.bidder_organization_id else null end,
        'auction_settlement_failed',
        'Subasta sin liquidacion',
        'Tu puja ganadora fallo porque la wallet ya no tenia saldo suficiente al cierre.',
        jsonb_build_object(
          'auction_id', v_auction.id,
          'auction_bid_id', v_winning_bid.id,
          'property_id', v_auction.property_id,
          'amount', v_winning_bid.bid_amount,
          'current_balance', v_winner_wallet.balance,
          'reason', 'insufficient_balance'
        )
      )
      returning id into v_failure_notification_id;
      v_notifications_created := v_notifications_created + 1;

      insert into public.notifications (
        recipient_profile_id,
        recipient_organization_id,
        type,
        title,
        body,
        metadata
      )
      values (
        case when v_auction.seller_owner_type = 'profile' then v_auction.seller_profile_id else null end,
        case when v_auction.seller_owner_type = 'organization' then v_auction.seller_organization_id else null end,
        'auction_settlement_failed',
        'Subasta sin liquidacion',
        'La subasta no pudo liquidarse porque la puja ganadora ya no tenia saldo suficiente.',
        jsonb_build_object(
          'auction_id', v_auction.id,
          'auction_bid_id', v_winning_bid.id,
          'property_id', v_auction.property_id,
          'amount', v_winning_bid.bid_amount,
          'current_balance', v_winner_wallet.balance,
          'reason', 'insufficient_balance'
        )
      );
      v_notifications_created := v_notifications_created + 1;

      insert into public.audit_logs (
        actor_profile_id,
        action,
        entity_type,
        entity_id,
        metadata
      )
      values (
        null,
        'auction.settlement_failed',
        'auction',
        v_auction.id,
        jsonb_build_object(
          'property_id', v_auction.property_id,
          'winning_bid_id', v_winning_bid.id,
          'winning_bid_amount', v_winning_bid.bid_amount,
          'winner_wallet_id', v_winner_wallet.id,
          'current_balance', v_winner_wallet.balance,
          'reason', 'insufficient_balance'
        )
      );

      auction_id := v_auction.id;
      status := 'expired';
      winning_bid_id := v_winning_bid.id;
      winning_bid_amount := v_winning_bid.bid_amount;
      notifications_created := v_notifications_created;
      return next;
      continue;
    end if;

    v_sale_percent := round(v_auction.ownership_percent, 2);

    if v_seller_owner.ownership_percent < v_sale_percent then
      update public.auctions
      set status = 'expired'
      where auctions.id = v_auction.id
        and auctions.status = 'active';

      update public.auction_bids
      set status = 'failed'
      where id = v_winning_bid.id;

      insert into public.notifications (
        recipient_profile_id,
        recipient_organization_id,
        type,
        title,
        body,
        metadata
      )
      values (
        case when v_auction.seller_owner_type = 'profile' then v_auction.seller_profile_id else null end,
        case when v_auction.seller_owner_type = 'organization' then v_auction.seller_organization_id else null end,
        'auction_settlement_failed',
        'Subasta sin liquidacion',
        'La subasta no pudo liquidarse porque el vendedor ya no tiene suficiente porcentaje.',
        jsonb_build_object(
          'auction_id', v_auction.id,
          'auction_bid_id', v_winning_bid.id,
          'property_id', v_auction.property_id,
          'ownership_percent', v_sale_percent,
          'seller_current_percent', v_seller_owner.ownership_percent,
          'reason', 'insufficient_seller_percent'
        )
      )
      returning id into v_failure_notification_id;
      v_notifications_created := v_notifications_created + 1;

      insert into public.audit_logs (
        actor_profile_id,
        action,
        entity_type,
        entity_id,
        metadata
      )
      values (
        null,
        'auction.settlement_failed',
        'auction',
        v_auction.id,
        jsonb_build_object(
          'property_id', v_auction.property_id,
          'winning_bid_id', v_winning_bid.id,
          'ownership_percent', v_sale_percent,
          'seller_current_percent', v_seller_owner.ownership_percent,
          'reason', 'insufficient_seller_percent',
          'notification_id', v_failure_notification_id
        )
      );

      auction_id := v_auction.id;
      status := 'expired';
      winning_bid_id := v_winning_bid.id;
      winning_bid_amount := v_winning_bid.bid_amount;
      notifications_created := v_notifications_created;
      return next;
      continue;
    end if;

    update public.wallets
    set balance = balance - v_winning_bid.bid_amount,
        currency_symbol = 'CC$',
        updated_at = now()
    where id = v_winner_wallet.id;

    update public.wallets
    set balance = balance + v_winning_bid.bid_amount,
        currency_symbol = 'CC$',
        updated_at = now()
    where id = v_seller_wallet.id;

    v_seller_remaining_percent := round(v_seller_owner.ownership_percent - v_sale_percent, 2);

    if v_seller_remaining_percent > 0 then
      update public.property_owners
      set ownership_percent = v_seller_remaining_percent
      where id = v_seller_owner.id;
    else
      delete from public.property_owners
      where id = v_seller_owner.id;
    end if;

    if v_winning_bid.bidder_owner_type = 'profile' then
      select *
        into v_winner_owner
      from public.property_owners
      where property_id = v_auction.property_id
        and profile_id = v_winning_bid.bidder_profile_id
      for update;

      if v_winner_owner.id is null then
        insert into public.property_owners (
          property_id,
          owner_type,
          profile_id,
          ownership_percent,
          created_by
        )
        values (
          v_auction.property_id,
          'profile',
          v_winning_bid.bidder_profile_id,
          v_sale_percent,
          null
        );
      else
        update public.property_owners
        set ownership_percent = round(ownership_percent + v_sale_percent, 2)
        where id = v_winner_owner.id;
      end if;
    else
      select *
        into v_winner_owner
      from public.property_owners
      where property_id = v_auction.property_id
        and organization_id = v_winning_bid.bidder_organization_id
      for update;

      if v_winner_owner.id is null then
        insert into public.property_owners (
          property_id,
          owner_type,
          organization_id,
          ownership_percent,
          created_by
        )
        values (
          v_auction.property_id,
          'organization',
          v_winning_bid.bidder_organization_id,
          v_sale_percent,
          null
        );
      else
        update public.property_owners
        set ownership_percent = round(ownership_percent + v_sale_percent, 2)
        where id = v_winner_owner.id;
      end if;
    end if;

    insert into public.ledger_entries (
      entry_type,
      amount,
      currency_symbol,
      from_wallet_id,
      to_wallet_id,
      reference_type,
      reference_id,
      description,
      metadata,
      created_by
    )
    values (
      'auction_settlement',
      v_winning_bid.bid_amount,
      'CC$',
      v_winner_wallet.id,
      v_seller_wallet.id,
      'auction_bid',
      v_winning_bid.id,
      'Liquidacion de subasta de propiedad.',
      jsonb_build_object(
        'auction_id', v_auction.id,
        'property_id', v_auction.property_id,
        'ownership_percent', v_sale_percent,
        'seller_owner_type', v_auction.seller_owner_type,
        'seller_profile_id', v_auction.seller_profile_id,
        'seller_organization_id', v_auction.seller_organization_id,
        'winner_owner_type', v_winning_bid.bidder_owner_type,
        'winner_profile_id', v_winning_bid.bidder_profile_id,
        'winner_organization_id', v_winning_bid.bidder_organization_id
      ),
      null
    )
    returning id into v_ledger_entry_id;

    update public.auctions
    set status = 'settled',
        settled_at = now()
    where id = v_auction.id;

    update public.auction_bids
    set status = 'settled'
    where id = v_winning_bid.id;

    insert into public.notifications (
      recipient_profile_id,
      recipient_organization_id,
      type,
      title,
      body,
      metadata
    )
    values (
      case when v_winning_bid.bidder_owner_type = 'profile' then v_winning_bid.bidder_profile_id else null end,
      case when v_winning_bid.bidder_owner_type = 'organization' then v_winning_bid.bidder_organization_id else null end,
      'auction_settled',
      'Subasta liquidada',
      'Ganaste la subasta: el dinero fue transferido y la propiedad ya quedo a tu nombre.',
      jsonb_build_object(
        'auction_id', v_auction.id,
        'auction_bid_id', v_winning_bid.id,
        'ledger_entry_id', v_ledger_entry_id,
        'property_id', v_auction.property_id,
        'ownership_percent', v_sale_percent,
        'amount', v_winning_bid.bid_amount
      )
    )
    returning id into v_winner_notification_id;
    v_notifications_created := v_notifications_created + 1;

    insert into public.notifications (
      recipient_profile_id,
      recipient_organization_id,
      type,
      title,
      body,
      metadata
    )
    values (
      case when v_auction.seller_owner_type = 'profile' then v_auction.seller_profile_id else null end,
      case when v_auction.seller_owner_type = 'organization' then v_auction.seller_organization_id else null end,
      'auction_settled',
      'Subasta liquidada',
      'La subasta fue liquidada y el dinero ya fue transferido a la wallet vendedora.',
      jsonb_build_object(
        'auction_id', v_auction.id,
        'auction_bid_id', v_winning_bid.id,
        'ledger_entry_id', v_ledger_entry_id,
        'property_id', v_auction.property_id,
        'ownership_percent', v_sale_percent,
        'amount', v_winning_bid.bid_amount
      )
    )
    returning id into v_seller_notification_id;
    v_notifications_created := v_notifications_created + 1;

    for v_participant in
      select distinct on (bids.bidder_owner_type, bids.bidder_profile_id, bids.bidder_organization_id)
        bids.bidder_owner_type,
        bids.bidder_profile_id,
        bids.bidder_organization_id,
        bids.id,
        bids.bid_amount
      from public.auction_bids bids
      where bids.auction_id = v_auction.id
        and bids.id <> v_winning_bid.id
      order by
        bids.bidder_owner_type,
        bids.bidder_profile_id,
        bids.bidder_organization_id,
        bids.created_at desc
    loop
      insert into public.notifications (
        recipient_profile_id,
        recipient_organization_id,
        type,
        title,
        body,
        metadata
      )
      values (
        case when v_participant.bidder_owner_type = 'profile' then v_participant.bidder_profile_id else null end,
        case when v_participant.bidder_owner_type = 'organization' then v_participant.bidder_organization_id else null end,
        'auction_closed_lost',
        'Subasta cerrada',
        'La subasta termino y otra puja fue liquidada como ganadora.',
        jsonb_build_object(
          'auction_id', v_auction.id,
          'property_id', v_auction.property_id,
          'auction_bid_id', v_participant.id,
          'bid_amount', v_participant.bid_amount,
          'winning_bid_id', v_winning_bid.id,
          'winning_bid_amount', v_winning_bid.bid_amount,
          'settled_at', now()
        )
      );
      v_notifications_created := v_notifications_created + 1;
    end loop;

    insert into public.audit_logs (
      actor_profile_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      null,
      'auction.settled',
      'auction',
      v_auction.id,
      jsonb_build_object(
        'property_id', v_auction.property_id,
        'winning_bid_id', v_winning_bid.id,
        'winning_bid_amount', v_winning_bid.bid_amount,
        'ownership_percent', v_sale_percent,
        'winner_wallet_id', v_winner_wallet.id,
        'seller_wallet_id', v_seller_wallet.id,
        'ledger_entry_id', v_ledger_entry_id,
        'winner_notification_id', v_winner_notification_id,
        'seller_notification_id', v_seller_notification_id,
        'seller_remaining_percent', v_seller_remaining_percent,
        'notifications_created', v_notifications_created,
        'settled_by', 'cron'
      )
    );

    auction_id := v_auction.id;
    status := 'settled';
    winning_bid_id := v_winning_bid.id;
    winning_bid_amount := v_winning_bid.bid_amount;
    notifications_created := v_notifications_created;
    return next;
  end loop;
end;
$$;

grant execute on function public.close_expired_auctions(integer) to service_role;

comment on function public.close_expired_auctions(integer) is
  'Closes expired active auctions and atomically settles the leading bid when funds and seller ownership are still valid. Failed settlements leave the auction expired and write notifications/audit logs.';
