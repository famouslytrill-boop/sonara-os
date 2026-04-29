create table if not exists product_evolution_audits (
  id uuid primary key default gen_random_uuid(),
  activation_rate numeric,
  day7_retention numeric,
  error_rate numeric,
  public_feature_count integer,
  model_cost_per_user numeric,
  recommended_actions jsonb,
  ship_status text,
  created_at timestamptz default now()
);

create table if not exists model_registry (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  license text not null,
  production_enabled boolean default false,
  reviewed_at timestamptz,
  notes text
);

create table if not exists agent_execution_logs (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  task_type text not null,
  status text not null,
  confidence numeric,
  cost_estimate numeric,
  latency_ms integer,
  created_at timestamptz default now()
);

create table if not exists feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  enabled boolean default false,
  rollout_percent integer default 0,
  owner text,
  created_at timestamptz default now()
);
