-- LOGOFIE DOUMAN — espace d'administration du marché
-- À exécuter après schema.sql dans Supabase SQL Editor.
-- Les contacts sont des données privées : aucune politique publique n'est créée.
-- Toutes les lectures/modifications passent par l'API serveur avec ADMIN_API_KEY.

create table if not exists public.partner_registrations (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('producer', 'buyer', 'transporter')),
  name text not null check (char_length(trim(name)) between 2 and 100),
  phone text not null check (char_length(phone) between 8 and 30),
  locality text not null check (char_length(trim(locality)) between 1 and 100),
  activity text not null check (char_length(trim(activity)) between 1 and 180),
  quantity text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text check (review_note is null or char_length(review_note) <= 500),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.product_listings (
  id uuid primary key default gen_random_uuid(),
  product text not null check (char_length(trim(product)) between 1 and 100),
  description text not null check (char_length(trim(description)) between 1 and 500),
  producer text not null check (char_length(trim(producer)) between 1 and 100),
  phone text not null check (char_length(phone) between 8 and 30),
  locality text not null check (char_length(trim(locality)) between 1 and 100),
  photo_url text not null check (photo_url like 'https://%'),
  quantity numeric(14,2) not null check (quantity > 0),
  unit text not null check (char_length(unit) between 1 and 20),
  price numeric(14,2) not null check (price > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text check (review_note is null or char_length(review_note) <= 500),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.transporter_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  phone text not null check (char_length(phone) between 8 and 30),
  vehicle text not null check (char_length(vehicle) between 1 and 60),
  capacity text not null check (char_length(capacity) between 1 and 80),
  locality text not null check (char_length(trim(locality)) between 1 and 100),
  routes text not null check (char_length(trim(routes)) between 1 and 250),
  rate text,
  availability text not null check (char_length(availability) between 1 and 60),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text check (review_note is null or char_length(review_note) <= 500),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists partner_registrations_status_created_idx
  on public.partner_registrations(status, created_at);
create index if not exists product_listings_status_created_idx
  on public.product_listings(status, created_at);
create index if not exists transporter_profiles_status_created_idx
  on public.transporter_profiles(status, created_at);

alter table public.partner_registrations enable row level security;
alter table public.product_listings enable row level security;
alter table public.transporter_profiles enable row level security;

-- Aucune politique anon/authenticated : données privées accessibles au serveur uniquement.
