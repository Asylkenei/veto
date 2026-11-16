"""Support tickets are stored in the database (a real channel, not a mock).
If SMTP is configured, the support team also gets an email copy."""
import logging
import smtplib
from email.message import EmailMessage
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core import config
from app.core.metrics import DOMAIN_EVENTS
from app.models import SupportTicket, User

log = logging.getLogger("veto.support")


def create(db: Session, user: User | None, kind: str, category: str, subject: str, message: str, contact: str) -> dict:
    ticket = SupportTicket(
        id=str(uuid4()),
        user_id=user.id if user else None,
        kind=kind,
        category=category,
        subject=subject.strip(),
        message=message.strip(),
        contact=(contact or (user.email if user else "") or "").strip(),
    )
    db.add(ticket)
    db.commit()
    DOMAIN_EVENTS.labels(f"support_{kind}").inc()
    log.info("support ticket", extra={"event": "support_ticket", "user_id": ticket.user_id})
    if config.SMTP_HOST:
        try:
            msg = EmailMessage()
            msg["Subject"] = f"[VETO {kind}] {ticket.subject}"
            msg["From"], msg["To"] = config.SMTP_FROM, config.SUPPORT_EMAIL
            msg.set_content(f"{ticket.message}\n\nКатегория: {category}\nКонтакт: {ticket.contact}\nID: {ticket.id}")
            with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10) as smtp:
                smtp.starttls()
                if config.SMTP_USER:
                    smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
                smtp.send_message(msg)
        except Exception:
            log.exception("support email failed — ticket is still saved")
    return {"id": ticket.id, "status": ticket.status, "created_at": ticket.created_at}


def mine(db: Session, user: User) -> list[dict]:
    return [
        {"id": t.id, "kind": t.kind, "subject": t.subject, "status": t.status, "created_at": t.created_at}
        for t in db.scalars(
            select(SupportTicket).where(SupportTicket.user_id == user.id).order_by(SupportTicket.created_at.desc())
        )
    ]
