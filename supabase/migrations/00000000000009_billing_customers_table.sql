-- Ensure billing customers table exists in aether schema.
-- Needed by billing setup/checkout flows in cloud billing mode.

create schema if not exists aether;

create table if not exists aether.billing_customers (
  account_id uuid not null,
  id text primary key,
  email text,
  active boolean,
  provider text
);

create index if not exists idx_aether_billing_customers_account_id
  on aether.billing_customers(account_id);
