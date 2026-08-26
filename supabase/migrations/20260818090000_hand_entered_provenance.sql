-- Which rows a person typed, and which arrived on their own.
--
-- Two features are refused today for the same reason, and it is the same
-- missing column both times.
--
-- growth_touchpoints records that something happened, and it feeds the
-- "Reached" stage of the customer journey in lib/sonara-customer-journey.cjs.
-- A hand-entered touchpoint -- "they mentioned it at the counter" -- is
-- indistinguishable from a tracked one once it is in the table, so a form for
-- offline touchpoints would put fabricated evidence into a funnel a business
-- makes decisions on. lib/sonara-growth-create-specs.cjs refuses that form in
-- as many words, and says the honest version starts with this column.
--
-- sonara_prompt_templates has the same shape one product over. The prompt
-- library pages render curated reference content from
-- data/prompts-chat-reference.cjs, and a customer's own saved template listed
-- beside it would read as part of the curated set.
--
-- growth_conversions already solved this, which is why the pattern is copied
-- rather than invented: attribution_model and attribution_confidence let a
-- sale typed in by hand record that it is not established.
--
-- **Nullable, and deliberately so. NULL is not FALSE here.**
--
--   true   a person typed this row into a form
--   false  it arrived tracked, imported, or curated
--   null   nobody recorded which, because the row predates this column
--
-- A NOT NULL DEFAULT false would write a claim about every existing row -- that
-- it is *known* to be machine-recorded -- on the strength of nothing. That is
-- the collapse this repository keeps finding, where a failed read and an empty
-- result reach the same conclusion, and it is not going to be introduced here
-- on purpose. Anything reading this column handles three answers, and the third
-- is "we do not know".

alter table if exists public.growth_touchpoints
  add column if not exists hand_entered boolean;

comment on column public.growth_touchpoints.hand_entered is
  'true when a person typed this touchpoint into a form, false when it arrived tracked, null when nobody recorded which. A funnel must not count a null as measured evidence.';

alter table if exists public.sonara_prompt_templates
  add column if not exists hand_entered boolean;

comment on column public.sonara_prompt_templates.hand_entered is
  'true when a customer wrote this template, false when it came from the curated reference set, null when nobody recorded which. A listing must not present a null as curated.';

-- Partial indexes: the queries that will matter are "only what a person
-- entered" and "only what was measured", and both are selective. Rows with no
-- answer are excluded from the index because they are not either one.
create index if not exists growth_touchpoints_hand_entered_idx
  on public.growth_touchpoints (organization_id, hand_entered)
  where hand_entered is not null;

create index if not exists sonara_prompt_templates_hand_entered_idx
  on public.sonara_prompt_templates (organization_id, hand_entered)
  where hand_entered is not null;
