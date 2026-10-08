-- Move pgvector out of the exposed public schema when the extension is installed.
--
-- Supabase recommends installing the vector extension in the extensions schema
-- and using extensions.vector(...) for vector columns. SONARA's historical
-- migration made pgvector optional and created a JSON fallback when it was not
-- available, so this migration preserves that property: no extension means no
-- failure and no new production dependency.
--
-- The installed production extension was verified relocatable before this
-- migration was written. Existing columns depend on the vector type by OID, so
-- ALTER EXTENSION ... SET SCHEMA relocates the extension objects without
-- rewriting customer rows.
begin;

create schema if not exists extensions;

do $relocate_vector_extension$
declare
  current_schema text;
  relocatable boolean;
begin
  select n.nspname, e.extrelocatable
    into current_schema, relocatable
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'vector';

  if not found then
    raise notice 'pgvector is not installed; leaving SONARA memory on its existing fallback representation';
    return;
  end if;

  if not relocatable then
    raise exception 'pgvector is installed but is not relocatable; manual review required';
  end if;

  if current_schema = 'public' then
    alter extension vector set schema extensions;
  elsif current_schema <> 'extensions' then
    raise exception 'pgvector is installed in unexpected schema %; manual review required', current_schema;
  end if;
end
$relocate_vector_extension$;

do $verify_vector_extension_schema$
declare
  current_schema text;
  embedding_type_schema text;
  embedding_type_name text;
begin
  select n.nspname
    into current_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'vector';

  if found and current_schema <> 'extensions' then
    raise exception 'pgvector remains in schema %, expected extensions', current_schema;
  end if;

  -- If the historical migration created a real vector column rather than the
  -- JSON fallback, prove that the column now resolves to the relocated type.
  select type_ns.nspname, t.typname
    into embedding_type_schema, embedding_type_name
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace table_ns on table_ns.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  join pg_namespace type_ns on type_ns.oid = t.typnamespace
  where table_ns.nspname = 'public'
    and c.relname = 'sonara_memory_records'
    and a.attname = 'embedding'
    and a.attnum > 0
    and not a.attisdropped;

  if found and embedding_type_name = 'vector' and embedding_type_schema <> 'extensions' then
    raise exception 'sonara_memory_records.embedding still resolves to %.vector', embedding_type_schema;
  end if;
end
$verify_vector_extension_schema$;

commit;
