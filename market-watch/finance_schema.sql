-- LOGOFIE GESTION — base de suivi financier (sans encaissement)
-- À exécuter après schema.sql dans Supabase SQL Editor.
-- Les montants sont des écritures de suivi. Cette API ne reçoit ni ne transfère d'argent.

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('sale', 'transport', 'expense')),
  label text not null check (char_length(trim(label)) between 2 and 120),
  gross_amount numeric(14,2) not null check (gross_amount > 0),
  commission_rate numeric(5,2) not null default 0
    check (commission_rate >= 0 and commission_rate <= 10),
  commission_amount numeric(14,2)
    generated always as (round(gross_amount * commission_rate / 100, 2)) stored,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  transaction_date date not null default current_date,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  constraint expense_has_no_commission check (entry_type <> 'expense' or commission_rate = 0)
);

create index if not exists finance_entries_type_status_date_idx
  on public.finance_entries(entry_type, status, transaction_date desc);

alter table public.finance_entries enable row level security;
-- Aucune politique publique : accès exclusivement via l'API serveur protégée.
