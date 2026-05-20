from sqlalchemy import Column, Integer, String, Date, Text
from .db import Base


class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    hcp_name = Column(String(255), nullable=False)
    interaction_type = Column(String(50), nullable=False)
    date = Column(Date, nullable=False)
    time = Column(String(16))
    attendees = Column(Text)
    topics_discussed = Column(Text)
    materials_shared = Column(Text)
    samples_distributed = Column(Text)
    sentiment = Column(String(32))
    outcomes = Column(Text)
    follow_up_actions = Column(Text)
