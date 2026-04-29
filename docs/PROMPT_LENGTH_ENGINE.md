# SONARA Prompt Length Engine

Purpose:
The Prompt Length Engine chooses the best prompt detail level for a user's project situation.

Modes:
- Short
- Standard
- Long
- Ultra

Product rule:
SONARA chooses the shortest prompt that still controls the result.

Use:
- Short for quick clips and simple ideas
- Standard for metadata, social clips, and runtime analysis
- Long for full song identity, sound packs, release plans, marketplace listings, and external generator settings
- Ultra for album sequencing, full prompt pack products, lyric videos, and detailed video prompts

Default:
local_rules

OpenAI:
Optional BYOK only. OpenAI may rewrite or explain prompts, but core prompt mode selection must remain local and deterministic.
