-- Add scopes, allowed_models, and rate_limit_per_minute to api_keys
ALTER TABLE aether.api_keys
  ADD COLUMN IF NOT EXISTS scopes jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allowed_models jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rate_limit_per_minute integer;
