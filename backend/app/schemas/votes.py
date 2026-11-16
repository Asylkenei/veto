from pydantic import BaseModel, Field


class VoteSubmit(BaseModel):
    choice_option_id: str | None = None
    # Exactly one yes/no stance per frozen option for NO OBJECTIONS.
    details: dict[str, str] = Field(default_factory=dict)
