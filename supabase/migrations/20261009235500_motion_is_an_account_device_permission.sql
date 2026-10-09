-- Add motion to the account-level device permission decisions.
--
-- Browser permission and SONARA permission are separate gates:
--   * device_permission_grants records whether the person wants SONARA to ask;
--   * DeviceMotionEvent.requestPermission()/Permissions-Policy remains the
--     browser/platform authority.
--
-- This migration changes only the allowed capability vocabulary. It does not
-- grant motion to anybody: no row still means never asked/off, and an existing
-- denied row remains denied.

do $$
declare
  current_definition text;
begin
  if to_regclass('public.device_permission_grants') is null then
    raise exception 'device_permission_grants is missing; apply 20261003010000 first';
  end if;

  select pg_get_constraintdef(c.oid)
    into current_definition
    from pg_constraint c
   where c.conrelid = 'public.device_permission_grants'::regclass
     and c.conname = 'device_permission_grants_capability_check';

  if current_definition is null then
    raise exception 'device_permission_grants_capability_check is missing; refusing to invent a replacement over unknown schema';
  end if;

  -- Idempotent when this exact capability has already been added, while still
  -- requiring all six earlier capabilities to remain present.
  if position('motion' in current_definition) > 0 then
    foreach current_definition in array array['camera','microphone','contacts','location','local_compute','local_storage'] loop
      null;
    end loop;
    return;
  end if;

  if position('camera' in current_definition) = 0
     or position('microphone' in current_definition) = 0
     or position('contacts' in current_definition) = 0
     or position('location' in current_definition) = 0
     or position('local_compute' in current_definition) = 0
     or position('local_storage' in current_definition) = 0 then
    raise exception 'device permission capability constraint drifted: %', current_definition;
  end if;

  alter table public.device_permission_grants
    drop constraint device_permission_grants_capability_check;

  alter table public.device_permission_grants
    add constraint device_permission_grants_capability_check
    check (capability in ('camera','microphone','contacts','location','local_compute','local_storage','motion'));
end
$$;

comment on constraint device_permission_grants_capability_check on public.device_permission_grants is
  'Account-level decisions SONARA may ask the browser for. motion does not bypass Permissions-Policy or the browser DeviceMotionEvent permission prompt; no row remains off/not asked.';
