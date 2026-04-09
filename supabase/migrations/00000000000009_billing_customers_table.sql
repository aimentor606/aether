-- Ensure billing customers table exists in acme schema.
-- Needed by billing setup/checkout flows in cloud billing mode.

create schema if not exists acme;

create table if not exists acme.billing_customers (
  account_id uuid not null,
  id text primary key,
  email text,
  active boolean,
  provider text
);

create index if not exists idx_acme_billing_customers_account_id
  on acme.billing_customers(account_id);
