-- Tubo – Initial schema
-- Tables: companies, profiles, invoices, invoice_items, invoice_processing_logs
-- Decisions this follows (see milestones.md): snake_case columns, numeric(14,2) for
-- money, 4-status enum + failure_type, unique(company_id, invoice_number), queue
-- columns on invoices for the DB-table queue, RLS enabled as a backup to the
-- service-role + explicit company scoping used in the backend (D3).

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. companies
-- ============================================================================
create table if not exists companies (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  slug                 text not null,
  tax_id               text,
  join_code_hash       text not null,
  join_code_expires_at timestamptz not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint uq_companies_slug unique (slug)
);

comment on table companies is 'Tenant. slug is the human-readable identifier used at sign-up; join_code_hash is a slow hash (e.g. bcrypt) of the one-time-shown join code (D1).';

-- ============================================================================
-- 2. profiles (1:1 with auth.users, adds company + role)
-- ============================================================================
create table if not exists profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  company_id  uuid not null references companies (id) on delete restrict,
  full_name   text,
  role        text not null default 'member',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint chk_profiles_role check (role in ('admin', 'member'))
);

comment on table profiles is 'Links a Supabase Auth user to exactly one company. company_id is read from here on every authenticated request, never from the request body/URL (E1).';

create index if not exists idx_profiles_company on profiles (company_id);

-- ============================================================================
-- 3. invoices
-- ============================================================================
create table if not exists invoices (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies (id) on delete restrict,
  created_by       uuid references profiles (id) on delete set null,

  invoice_number   text not null,
  invoice_date     date not null,

  -- Seller snapshot at issue time (invoices are legal documents and must not
  -- silently change if the company record is edited later).
  seller_name      text not null,
  seller_tax_id    text,

  customer_name    text not null,
  customer_tax_id  text not null,
  customer_email   text not null,

  currency         text not null,
  subtotal         numeric(14,2) not null,
  tax_amount       numeric(14,2) not null,
  total_amount     numeric(14,2) not null,

  status           text not null default 'PENDING',
  failure_type     text,

  -- Queue state for the DB-table queue (D13)
  attempt_count    integer not null default 0,
  next_retry_at    timestamptz,
  locked_until     timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint uq_invoices_company_number unique (company_id, invoice_number),
  constraint chk_invoices_currency length check (char_length(currency) = 3),
  constraint chk_invoices_amounts_non_negative check (
    subtotal >= 0 and tax_amount >= 0 and total_amount >= 0
  ),
  constraint chk_invoices_total_consistent check (
    total_amount = subtotal + tax_amount
  ),
  constraint chk_invoices_status check (
    status in ('PENDING', 'PROCESSING', 'SUBMITTED', 'FAILED')
  ),
  constraint chk_invoices_failure_type check (
    failure_type is null or failure_type in ('RETRYABLE', 'PERMANENT')
  ),
  constraint chk_invoices_failure_type_requires_failed check (
    (status = 'FAILED' and failure_type is not null)
    or (status <> 'FAILED' and failure_type is null)
  ),
  constraint chk_invoices_attempt_count_non_negative check (attempt_count >= 0)
);

comment on table invoices is 'uq_invoices_company_number is what makes duplicate (company_id, invoice_number) impossible at the DB level (C2, C3, Part J) regardless of application-level races.';

create index if not exists idx_invoices_company_status on invoices (company_id, status);
create index if not exists idx_invoices_company_date on invoices (company_id, invoice_date);
create index if not exists idx_invoices_queue on invoices (status, next_retry_at);

-- ============================================================================
-- 4. invoice_items
-- ============================================================================
create table if not exists invoice_items (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references invoices (id) on delete cascade,
  item_order   integer not null default 0,
  description  text not null,
  quantity     numeric(14,2) not null,
  unit_price   numeric(14,2) not null,
  tax          numeric(14,2) not null default 0,
  line_total   numeric(14,2) not null,
  created_at   timestamptz not null default now(),

  constraint chk_invoice_items_quantity_positive check (quantity > 0),
  constraint chk_invoice_items_unit_price_non_negative check (unit_price >= 0),
  constraint chk_invoice_items_tax_non_negative check (tax >= 0),
  constraint chk_invoice_items_line_total_non_negative check (line_total >= 0)
);

create index if not exists idx_invoice_items_invoice on invoice_items (invoice_id);

-- ============================================================================
-- 5. invoice_processing_logs (one row per attempt, never overwritten — L1)
-- ============================================================================
create table if not exists invoice_processing_logs (
  id                     uuid primary key default gen_random_uuid(),
  invoice_id             uuid not null references invoices (id) on delete cascade,
  attempt_number         integer not null,
  started_at             timestamptz not null default now(),
  ended_at               timestamptz,
  status                 text not null,
  http_status_code       integer,
  error_message          text,
  response_body_excerpt  text,
  idempotency_key        text,

  constraint uq_logs_invoice_attempt unique (invoice_id, attempt_number),
  constraint chk_logs_status check (
    status in ('STARTED', 'SUCCESS', 'FAILED', 'TIMEOUT')
  )
);

comment on table invoice_processing_logs is 'One row per submission attempt. Support engineers investigate a failure by filtering this table on invoice_id (L2). Rows are append-only.';

create index if not exists idx_logs_invoice_attempt on invoice_processing_logs (invoice_id, attempt_number);

-- ============================================================================
-- 6. updated_at trigger
-- ============================================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_companies_updated_at on companies;
create trigger trg_companies_updated_at
  before update on companies
  for each row execute function set_updated_at();

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists trg_invoices_updated_at on invoices;
create trigger trg_invoices_updated_at
  before update on invoices
  for each row execute function set_updated_at();

-- ============================================================================
-- 7. Row Level Security (defense in depth; the backend uses the service-role
--    key and scopes every query by company_id explicitly per D3 — RLS here
--    is a backup in case a client ever talks to Supabase directly)
-- ============================================================================
create or replace function current_company_id()
returns uuid
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

alter table companies enable row level security;
drop policy if exists companies_select_own on companies;
create policy companies_select_own on companies
  for select using (id = current_company_id());

alter table profiles enable row level security;
drop policy if exists profiles_select_own_company on profiles;
create policy profiles_select_own_company on profiles
  for select using (company_id = current_company_id());
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles
  for update using (id = auth.uid());

alter table invoices enable row level security;
drop policy if exists invoices_select_own_company on invoices;
create policy invoices_select_own_company on invoices
  for select using (company_id = current_company_id());
drop policy if exists invoices_insert_own_company on invoices;
create policy invoices_insert_own_company on invoices
  for insert with check (company_id = current_company_id());
drop policy if exists invoices_update_own_company on invoices;
create policy invoices_update_own_company on invoices
  for update using (company_id = current_company_id());

alter table invoice_items enable row level security;
drop policy if exists invoice_items_select_own_company on invoice_items;
create policy invoice_items_select_own_company on invoice_items
  for select using (
    exists (
      select 1 from invoices i
      where i.id = invoice_items.invoice_id
        and i.company_id = current_company_id()
    )
  );

alter table invoice_processing_logs enable row level security;
drop policy if exists invoice_logs_select_own_company on invoice_processing_logs;
create policy invoice_logs_select_own_company on invoice_processing_logs
  for select using (
    exists (
      select 1 from invoices i
      where i.id = invoice_processing_logs.invoice_id
        and i.company_id = current_company_id()
    )
  );
