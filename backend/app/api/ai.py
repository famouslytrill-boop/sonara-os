from fastapi import APIRouter
from pydantic import BaseModel
from app.services.model_gateway import ModelGateway
from app.services.prompt_compiler import compile_master_prompt

router = APIRouter(prefix="/ai", tags=["ai"])

class PromptRequest(BaseModel):
    task: str = "song"
    idea: str
    persona: str = ""
    locale: str = "en"

@router.post("/compile")
async def compile_prompt(req: PromptRequest):
    prompt = compile_master_prompt(req.idea, req.persona)
    gateway = ModelGateway()
    route = gateway.choose(req.task, req.locale)
    return {
        "compiled_prompt": prompt,
        "characters": len(prompt),
        "openai_ready": bool(gateway.api_key),
        "route": route.__dict__,
    }

@router.post("/ask")
async def ask_sonara(req: PromptRequest):
    prompt = compile_master_prompt(req.idea, req.persona)
    gateway = ModelGateway()
    result = await gateway.complete(req.task, prompt, req.locale)
    return {
        "compiled_prompt": prompt,
        "characters": len(prompt),
        **result,
    }
