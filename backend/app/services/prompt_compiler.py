MAX_PROMPT_CHARS = 1000

def compile_master_prompt(user_input: str, persona: str = "", goal: str = "release-ready output") -> str:
    parts = [
        f"Goal: {goal}.",
        f"Persona: {persona.strip()}",
        f"User idea: {user_input.strip()}",
        "Optimize for clarity, strong hook, music theory alignment, emotional arc, commercial usability, and platform-safe originality.",
        "Return focused, release-ready creative direction with concrete details, not vague inspiration.",
    ]
    prompt = " ".join(p for p in parts if p.strip())
    return prompt[:MAX_PROMPT_CHARS]
