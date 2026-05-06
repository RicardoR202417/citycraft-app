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

    select *
      into v_winning_bid
    from public.auction_bids
    where auction_bids.auction_id = v_auction.id
      and auction_bids.status = 'leading'
    order by auction_bids.bid_amount desc, auction_bids.created_at desc
    limit 1
    for update;

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
      case
        when v_winning_bid.id is null then 'Tu subasta termino sin pujas validas.'
        else 'Tu subasta termino con una puja ganadora pendiente de liquidacion.'
      end,
      jsonb_build_object(
        'auction_id', v_auction.id,
        'property_id', v_auction.property_id,
        'winning_bid_id', v_winning_bid.id,
        'winning_bid_amount', v_winning_bid.bid_amount,
        'closed_at', now()
      )
    );
    v_notifications_created := v_notifications_created + 1;

    for v_participant in
      select distinct on (bids.bidder_owner_type, bids.bidder_profile_id, bids.bidder_organization_id)
        bids.bidder_owner_type,
        bids.bidder_profile_id,
        bids.bidder_organization_id,
        bids.id,
        bids.bid_amount,
        bids.status
      from public.auction_bids bids
      where bids.auction_id = v_auction.id
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
        case when v_participant.id = v_winning_bid.id then 'auction_closed_won' else 'auction_closed_lost' end,
        case when v_participant.id = v_winning_bid.id then 'Ganaste una subasta' else 'Subasta cerrada' end,
        case
          when v_participant.id = v_winning_bid.id then 'Tu puja quedo como ganadora. La liquidacion se procesara en el siguiente paso operativo.'
          else 'La subasta termino y otra puja quedo como ganadora.'
        end,
        jsonb_build_object(
          'auction_id', v_auction.id,
          'property_id', v_auction.property_id,
          'auction_bid_id', v_participant.id,
          'bid_amount', v_participant.bid_amount,
          'winning_bid_id', v_winning_bid.id,
          'winning_bid_amount', v_winning_bid.bid_amount,
          'closed_at', now()
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
      'auction.closed',
      'auction',
      v_auction.id,
      jsonb_build_object(
        'property_id', v_auction.property_id,
        'winning_bid_id', v_winning_bid.id,
        'winning_bid_amount', v_winning_bid.bid_amount,
        'notifications_created', v_notifications_created,
        'closed_at', now(),
        'closed_by', 'cron'
      )
    );

    auction_id := v_auction.id;
    status := 'expired';
    winning_bid_id := v_winning_bid.id;
    winning_bid_amount := v_winning_bid.bid_amount;
    notifications_created := v_notifications_created;
    return next;
  end loop;
end;
$$;

grant execute on function public.close_expired_auctions(integer) to service_role;

comment on function public.close_expired_auctions(integer) is
  'Closes active auctions whose ends_at has passed, keeps the leading bid as winner, writes close notifications and audit logs. Settlement is handled separately.';
