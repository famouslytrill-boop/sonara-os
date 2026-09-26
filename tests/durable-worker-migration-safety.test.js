const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = (name) => fs.readFileSync(path.join(__dirname, "../supabase/migrations", name), "utf8");

describe("durable worker and translation migration safety", function () {
  const workerSql = migration("20260926025411_durable_worker_contract.sql");
  const translationSql = migration("20260926025412_translation_records_and_glossary.sql");
  const hardeningSql = migration("20260926025656_translation_policy_and_index_hardening.sql");
  const grantsSql = migration("20260926033255_translation_authenticated_read_only.sql");
  const dataApiSql = migration("20260926033557_translation_data_api_grants.sql");

  it("keeps worker event access behind RLS and service-role grants", function () {
    assert.match(workerSql, /alter table public\.platform_job_events enable row level security/i);
    assert.match(workerSql, /create policy[\s\S]*?for all to service_role/i);
    assert.match(workerSql, /revoke all on public\.platform_job_events from public, anon, authenticated/i);
    assert.match(workerSql, /grant select, insert on public\.platform_job_events to service_role/i);
  });

  it("restricts worker RPC execution and pins their search paths", function () {
    assert.equal((workerSql.match(/security invoker/gi) || []).length, 2);
    assert.equal((workerSql.match(/set search_path = public, pg_temp/gi) || []).length, 2);
    assert.equal((workerSql.match(/revoke all on function public\.(?:claim|enqueue)_platform_job[\s\S]*?from public, anon, authenticated/gi) || []).length, 2);
    assert.match(workerSql, /grant execute on function public\.claim_platform_job\(text,text\) to service_role/i);
    assert.match(workerSql, /grant execute on function public\.enqueue_platform_job\(text,text,jsonb,integer,integer\) to service_role/i);
  });

  it("makes repeated enqueue keys return the existing job without duplicating events", function () {
    assert.match(workerSql, /on conflict \(idempotency_key\) where idempotency_key is not null do nothing/i);
    assert.match(workerSql, /if not created then\s+select \* into result from public\.platform_jobs where idempotency_key = p_idempotency_key/i);
    assert.match(workerSql, /if created then\s+insert into public\.platform_job_events[\s\S]*?'enqueued'/i);
    assert.doesNotMatch(workerSql, /references public\.platform_jobs\(id\) on delete cascade/i);
  });

  it("keeps translation records tenant-readable and server-writable", function () {
    for (const table of ["translation_records", "translation_glossary_terms"]) {
      assert.match(translationSql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
      assert.match(translationSql, new RegExp(`for select to authenticated`, "i"));
      assert.match(translationSql, new RegExp(`for all to service_role`, "i"));
    }
    assert.match(translationSql, /revoke all on public\.translation_records, public\.translation_glossary_terms from public, anon/i);
    assert.match(translationSql, /grant select on public\.translation_records, public\.translation_glossary_terms to authenticated/i);
    assert.doesNotMatch(translationSql, /grant insert[^;]*to authenticated/i);
  });

  it("uses initplan-friendly membership checks and indexes translation user foreign keys", function () {
    assert.equal((hardeningSql.match(/\(select auth\.uid\(\)\)/gi) || []).length, 2);
    for (const column of ["created_by", "updated_by"]) {
      assert.match(hardeningSql, new RegExp(`translation_records_${column}_idx`));
    }
    assert.match(hardeningSql, /translation_glossary_created_by_idx/);
  });

  it("revokes authenticated translation writes while preserving service-role writes", function () {
    assert.match(grantsSql, /revoke all privileges on table public\.translation_records, public\.translation_glossary_terms\s+from public, anon, authenticated/i);
    assert.match(grantsSql, /grant select on table public\.translation_records, public\.translation_glossary_terms\s+to authenticated/i);
    assert.match(grantsSql, /grant all privileges on table public\.translation_records, public\.translation_glossary_terms\s+to service_role/i);
  });

  it("declares each new table to the service-role Data API", function () {
    assert.match(dataApiSql, /grant all privileges on table public\.translation_records to service_role/i);
    assert.match(dataApiSql, /grant all privileges on table public\.translation_glossary_terms to service_role/i);
  });
});
