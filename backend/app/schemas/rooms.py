from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, Field

Method = Literal["majority", "unanimity", "objections"]


class OptionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    description: str = Field(default="", max_length=3000)
    place_id: str | None = Field(default=None, max_length=48)


class RoomCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    question: str = Field(min_length=1, max_length=500)
    description: str = Field(default="", max_length=5000)
    method: Method
    allow_suggestions: bool = True
    allow_comments: bool = True
    hide_results: bool = False
    deadline: datetime | None = None
    template: str = Field(default="", max_length=40)
    options: list[OptionCreate] = Field(default_factory=list, max_length=30)


class RoomUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=180)
    question: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=5000)
    method: Method | None = None
    allow_suggestions: bool | None = None
    allow_comments: bool | None = None
    hide_results: bool | None = None
    deadline: datetime | None = None


class OptionUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    description: str = Field(default="", max_length=3000)


class OptionOrder(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=200)


class OptionModerate(BaseModel):
    status: Literal["ACCEPTED", "REJECTED"]
    rejection_reason: str = Field(default="", max_length=1000)


class CommentCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class InviteByEmail(BaseModel):
    email: EmailStr


class ParticipantRead(BaseModel):
    id: str
    display_name: str
    role: str
    avatar_color: str = "sand"


class OptionRead(BaseModel):
    id: str
    title: str
    description: str
    author: str
    author_id: str
    status: str
    rejection_reason: str
    place_id: str | None = None
    can_edit: bool = False
    position: int = 0
    image_url: str = ""
    image_credit: str = ""


class CommentRead(BaseModel):
    id: str
    option_id: str
    author: str
    text: str
    created_at: datetime


class VoteDetailRead(BaseModel):
    option_id: str
    stance: str


class BallotRead(BaseModel):
    participant_id: str
    choice_option_id: str | None = None
    details: list[VoteDetailRead] = []


class RoundRead(BaseModel):
    id: str
    number: int
    status: str
    kind: str = "regular"
    end_reason: str = ""
    participant_ids: list[str]
    option_ids: list[str]
    ballots: list[BallotRead]
    result: dict | None
    tiebreak: dict | None = None
    started_at: datetime | None
    ended_at: datetime | None


class RoomRead(BaseModel):
    id: str
    title: str
    question: str
    description: str
    method: str
    status: str
    host_id: str
    host_name: str
    participant_count: int
    allow_suggestions: bool
    allow_comments: bool
    hide_results: bool
    deadline: datetime | None
    created_at: datetime
    updated_at: datetime | None = None
    invite_code: str | None = None
    template: str = ""
    version: int = 0
    participants: list[ParticipantRead]
    options: list[OptionRead]
    comments: list[CommentRead]
    rounds: list[RoundRead]
    is_host: bool = False
    is_member: bool = False
    current_user_id: str | None = None
