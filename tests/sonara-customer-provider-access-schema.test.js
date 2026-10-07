// Copyright (c) 2026 SONARA Industries. All rights reserved.
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const sql=fs.readFileSync(path.join(__dirname,"..","docs","architecture",
  "SONARA_CUSTOMER_PROVIDER_ACCESS_SCHEMA_PROPOSAL_2026_10_07.sql"),"utf8");

describe("customer provider access schema proposal",()=>{
  it("is design-only and cannot be mistaken for an applied migration",()=>{
    assert.match(sql,/DESIGN ONLY \/ NOT AN APPLIED MIGRATION/);
    assert.match(sql,/Do not copy this file into supabase\/migrations/);
  });

  it("models customer connection, OAuth transaction, action, sync and provider event evidence",()=>{
    for(const table of [
      "customer_provider_connections","provider_oauth_transactions",
      "provider_action_requests","provider_sync_checkpoints","provider_event_inbox"
    ]) assert.match(sql,new RegExp("sonara_control\\."+table+"\\b"),table);
  });

  it("stores opaque credential references rather than raw secret columns",()=>{
    assert.match(sql,/credential_reference text/);
    for(const forbidden of [
      "access_token text","refresh_token text","api_key text","private_key text",
      "client_secret text","password text","authorization_code text"
    ]) assert.equal(sql.toLowerCase().includes(forbidden),false,forbidden);
  });

  it("binds provider requests and events to organization and connection identities",()=>{
    assert.match(sql,/provider_action_requests[\s\S]*organization_id uuid not null[\s\S]*connection_id uuid not null/);
    assert.match(sql,/provider_event_inbox[\s\S]*organization_id uuid not null[\s\S]*connection_id uuid not null/);
  });

  it("requires PKCE S256 and one-time OAuth transaction evidence",()=>{
    assert.match(sql,/pkce_method text not null check \(pkce_method = 'S256'\)/);
    assert.match(sql,/unique \(organization_id, state_digest\)/);
    assert.match(sql,/consumed_at timestamptz/);
  });

  it("requires idempotency evidence for provider write dispatch design",()=>{
    assert.match(sql,/provider_action_requests_idempotency_idx/);
    assert.match(sql,/idempotency_key_hash/);
    assert.match(sql,/provider_receipt_hash/);
  });

  it("keeps tenant provider credentials behind a non-browser Vault boundary",()=>{
    assert.match(sql,/credential_custody text not null/);
    assert.match(sql,/supabase_vault/);
    assert.match(sql,/Browser roles never receive SELECT on/);
    assert.match(sql,/vault\.decrypted_secrets/);
    assert.match(sql,/Do not create a PUBLIC-schema SECURITY DEFINER credential resolver/);
  });

  it("requires remediation of broad browser privileges before provider activation",()=>{
    assert.match(sql,/TRUNCATE\/TRIGGER\/REFERENCES privileges/);
    assert.match(sql,/public\.business_integration_connections/);
    assert.match(sql,/RLS is not a substitute for/);
    assert.match(sql,/REVOKE ALL from anon\/authenticated/);
  });

  it("keeps financial mutation disabled under external-only customer-funds mode",()=>{
    assert.match(sql,/Financial mutation remains disabled while SONARA customer-funds mode is/);
    assert.match(sql,/external_only/);
  });
});
