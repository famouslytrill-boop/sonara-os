-- Review the organization and membership schema before running owner bootstrap.
-- This helps avoid failed inserts when production has required columns beyond
-- the local migration contract.

select
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('organizations', 'organization_members', 'organization_memberships')
order by table_name, ordinal_position;

select
  table_name,
  column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'organizations'
  and is_nullable = 'NO'
  and column_default is null
  and column_name not in (
    'name',
    'slug',
    'kind',
    'status',
    'created_by',
    'company_key',
    'country',
    'metadata'
  )
order by column_name;
