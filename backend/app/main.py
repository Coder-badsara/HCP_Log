from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from .db import AsyncSessionLocal, init_db, get_db
from .models import Interaction
from .ai_routes import router as ai_router


app = FastAPI(title='AI-First CRM — Backend (minimal)')

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_router)


class InteractionIn(BaseModel):
    hcp_name: str
    interaction_type: str
    date: str
    time: Optional[str] = None
    attendees: Optional[str] = None
    topics_discussed: Optional[str] = None
    materials_shared: Optional[str] = None
    samples_distributed: Optional[str] = None
    sentiment: Optional[str] = None
    outcomes: Optional[str] = None
    follow_up_actions: Optional[str] = None


class InteractionUpdateIn(BaseModel):
    hcp_name: Optional[str] = None
    interaction_type: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    attendees: Optional[str] = None
    topics_discussed: Optional[str] = None
    materials_shared: Optional[str] = None
    samples_distributed: Optional[str] = None
    sentiment: Optional[str] = None
    outcomes: Optional[str] = None
    follow_up_actions: Optional[str] = None


class AIChatIn(BaseModel):
    session_id: str
    message: str


@app.on_event("startup")
async def on_startup():
    # Initialize DB (create tables) — development convenience
    await init_db()


@app.get('/v1/health')
async def health_check():
    return {'status': 'ok', 'database_configured': AsyncSessionLocal is not None}


@app.post('/v1/interactions')
async def create_interaction(payload: InteractionIn, db: AsyncSession = Depends(get_db)):
    try:
        # parse date (expecting ISO date)
        dt = datetime.fromisoformat(payload.date).date()
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid date format, use YYYY-MM-DD")

    interaction = Interaction(
        hcp_name=payload.hcp_name,
        interaction_type=payload.interaction_type,
        date=dt,
        time=payload.time,
        attendees=payload.attendees,
        topics_discussed=payload.topics_discussed,
        materials_shared=payload.materials_shared,
        samples_distributed=payload.samples_distributed,
        sentiment=payload.sentiment,
        outcomes=payload.outcomes,
        follow_up_actions=payload.follow_up_actions,
    )

    db.add(interaction)
    await db.commit()
    await db.refresh(interaction)

    return { 'id': interaction.id, 'status': 'saved', 'record': {
        'hcp_name': interaction.hcp_name,
        'interaction_type': interaction.interaction_type,
        'date': interaction.date.isoformat(),
        'time': interaction.time,
        'attendees': interaction.attendees,
        'topics_discussed': interaction.topics_discussed,
        'materials_shared': interaction.materials_shared,
        'samples_distributed': interaction.samples_distributed,
        'sentiment': interaction.sentiment,
        'outcomes': interaction.outcomes,
        'follow_up_actions': interaction.follow_up_actions,
    }}


@app.patch('/v1/interactions/{interaction_id}')
async def update_interaction(interaction_id: int, payload: InteractionUpdateIn, db: AsyncSession = Depends(get_db)):
    interaction = await db.get(Interaction, interaction_id)
    if interaction is None:
        raise HTTPException(status_code=404, detail='Interaction not found')

    if payload.date is not None:
        try:
            interaction.date = datetime.fromisoformat(payload.date).date()
        except Exception:
            raise HTTPException(status_code=422, detail='Invalid date format, use YYYY-MM-DD')

    if payload.hcp_name is not None:
        interaction.hcp_name = payload.hcp_name
    if payload.interaction_type is not None:
        interaction.interaction_type = payload.interaction_type
    if payload.time is not None:
        interaction.time = payload.time
    if payload.attendees is not None:
        interaction.attendees = payload.attendees
    if payload.topics_discussed is not None:
        interaction.topics_discussed = payload.topics_discussed
    if payload.materials_shared is not None:
        interaction.materials_shared = payload.materials_shared
    if payload.samples_distributed is not None:
        interaction.samples_distributed = payload.samples_distributed
    if payload.sentiment is not None:
        interaction.sentiment = payload.sentiment
    if payload.outcomes is not None:
        interaction.outcomes = payload.outcomes
    if payload.follow_up_actions is not None:
        interaction.follow_up_actions = payload.follow_up_actions

    await db.commit()
    await db.refresh(interaction)

    return {'id': interaction.id, 'status': 'updated', 'record': {
        'hcp_name': interaction.hcp_name,
        'interaction_type': interaction.interaction_type,
        'date': interaction.date.isoformat(),
        'time': interaction.time,
        'attendees': interaction.attendees,
        'topics_discussed': interaction.topics_discussed,
        'materials_shared': interaction.materials_shared,
        'samples_distributed': interaction.samples_distributed,
        'sentiment': interaction.sentiment,
        'outcomes': interaction.outcomes,
        'follow_up_actions': interaction.follow_up_actions,
    }}


# AI routes are provided by ai_routes.py and mounted on startup
