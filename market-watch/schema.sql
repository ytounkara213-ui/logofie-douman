-- LOGOFIE MARKET WATCH
-- Run this SQL in the Supabase SQL Editor for the project's database.
-- Never put the Supabase service-role key in the browser or in GitHub.

create extension if not exists pgcrypto;

create table if not exists public.market_submissions (
  id uuid primary key default gen_random_uuid(),
  locality text not null,
  market_name text not null,
  product text not null,
  producer_price numeric(12,2),
  market_price numeric(12,2) not null,
  unit text not null,
  quantity numeric(12,2),
  observed_at date not null,
  correspondent_code text,
  notes text,
  photo_url text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  constraint producer_price_positive check (producer_price is null or producer_price > 0),
  constraint market_price_positive check (market_price > 0),
  constraint quantity_positive check (quantity is null or quantity > 0)
);

create table if not exists public.market_prices (
  id uuid primary key default gen_random_uuid(),
  locality text not null,
  market_name text not null,
  product text not null,
  producer_price numeric(12,2),
  market_price numeric(12,2) not null,
  unit text not null,
  observed_at date not null,
  source_type text not null default 'local_correspondent'
    check (source_type in ('official', 'local_correspondent', 'seller_declared', 'estimated')),
  source_label text not null default 'Correspondant local',
  submission_id uuid references public.market_submissions(id),
  published_at timestamptz not null default now(),
  constraint published_market_price_positive check (market_price > 0)
);

create index if not exists market_submissions_status_created_idx
  on public.market_submissions(status, created_at desc);
create index if not exists market_prices_locality_product_date_idx
  on public.market_prices(locality, product, observed_at desc);

alter table public.market_submissions enable row level security;
alter table public.market_prices enable row level security;

-- No public table policies are created. All access goes through the server API.
-- The server uses the service-role key stored only in its hosting environment.
