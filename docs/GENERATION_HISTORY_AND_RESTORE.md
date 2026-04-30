# Generation History And Restore

Generation history keeps every generated output addressable and reversible.

Snapshot fields:

- original input
- engine name
- engine version
- settings snapshot
- input hash
- timestamp
- output data
- parent generation id
- label
- selected version marker

Actions:

- regenerate same data
- regenerate with changes
- restore previous
- compare versions
- mark selected

Launch status:

- Local snapshot engine exists.
- Supabase migration `006_sonara_generation_history.sql` is available for persistence.
- Persistent history should be enabled only after Supabase Auth and RLS are verified.
