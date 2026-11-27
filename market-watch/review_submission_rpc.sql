-- LOGOFIE MARKET WATCH — validation atomique des relevés
-- À exécuter après schema.sql dans Supabase SQL Editor.
-- Empêche les doubles publications et traite le statut + le prix dans une seule transaction.

create unique index if not exists market_prices_submission_id_unique
  on public.market_prices(submission_id)
  where submission_id is not null;

create or replace function public.review_market_submission(
  p_submission_id uuid,
  p_decision text,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission public.market_submissions%rowtype;
  v_price_id uuid;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'Invalid decision';
  end if;

  select *
    into v_submission
    from public.market_submissions
   where id = p_submission_id
     and status = 'pending'
   for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if p_decision = 'reject' then
    update public.market_submissions
       set status = 'rejected',
           reviewed_at = now(),
           review_note = nullif(left(trim(coalesce(p_review_note, '')), 500), '')
     where id = p_submission_id;

    return jsonb_build_object('outcome', 'rejected');
  end if;

  insert into public.market_prices (
    locality, market_name, product, producer_price, market_price,
    unit, observed_at, source_type, source_label, submission_id
  ) values (
    v_submission.locality,
    v_submission.market_name,
    v_submission.product,
    v_submission.producer_price,
    v_submission.market_price,
    v_submission.unit,
    v_submission.observed_at,
    'local_correspondent',
    case
      when v_submission.correspondent_code is not null and v_submission.correspondent_code <> ''
        then 'Correspondant ' || v_submission.correspondent_code
      else 'Correspondant local'
    end,
    v_submission.id
  )
  returning id into v_price_id;

  update public.market_submissions
     set status = 'approved',
         reviewed_at = now(),
         review_note = nullif(left(trim(coalesce(p_review_note, '')), 500), '')
   where id = p_submission_id;

  return jsonb_build_object('outcome', 'approved', 'price_id', v_price_id);
end;
$$;

revoke all on function public.review_market_submission(uuid, text, text) from public;
revoke all on function public.review_market_submission(uuid, text, text) from anon;
revoke all on function public.review_market_submission(uuid, text, text) from authenticated;
grant execute on function public.review_market_submission(uuid, text, text) to service_role;
