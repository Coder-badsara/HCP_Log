import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import AsyncGenerator, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from .ai_client import build_local_payload, stream_assistant_summary, extract_entities_from_text
from .db import get_db
from .models import Interaction

router = APIRouter()


class AIChatIn(BaseModel):
    session_id: str
    message: str


class ConfirmIn(BaseModel):
    session_id: str
    human_confirmed: bool
    confirmed_data: dict


@router.post('/api/v1/ai/chat')
async def ai_chat(payload: AIChatIn):
    # Call LLM or fallback extraction
    result = await extract_entities_from_text(payload.message)
    return result


@router.post('/api/v1/ai/chat/stream')
async def ai_chat_stream(payload: AIChatIn):
    async def event_stream() -> AsyncGenerator[str, None]:
        assistant_text = ''

        try:
            async for chunk in stream_assistant_summary(payload.message):
                assistant_text += chunk
                yield json.dumps({'type': 'delta', 'content': chunk}) + '\n'
        except Exception:
            assistant_text = ''

        final_payload = build_local_payload(payload.message, assistant_text.strip() or None)
        yield json.dumps({'type': 'final', 'payload': final_payload}) + '\n'

    return StreamingResponse(
        event_stream(),
        media_type='application/x-ndjson',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    )


@router.post('/api/v1/ai/confirm')
async def ai_confirm(body: ConfirmIn, db: AsyncSession = Depends(get_db)):
    if not body.human_confirmed:
        raise HTTPException(status_code=400, detail='Human confirmation required to save')

    data = body.confirmed_data
    # Basic validation
    if not data.get('hcp_name') or not data.get('date'):
        raise HTTPException(status_code=422, detail='hcp_name and date required')

    try:
        parsed_date = datetime.fromisoformat(str(data.get('date'))).date()
    except Exception:
        raise HTTPException(status_code=422, detail='Invalid date format, use YYYY-MM-DD')

    # Persist to interactions table
    interaction = Interaction(
        hcp_name=data.get('hcp_name'),
        interaction_type=data.get('interaction_type', 'detail_visit'),
        date=parsed_date,
        topics_discussed=data.get('topics_discussed'),
    )
    db.add(interaction)
    await db.commit()
    await db.refresh(interaction)

    return {'interaction_id': interaction.id, 'message': 'Interaction logged successfully via AI'}
