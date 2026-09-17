from sqlalchemy.orm import Session

from ..models import Notification


async def notify(db: Session, event_bus, user_id: int, type: str, message: str,
                  workflow_id: int = None, token_id: int = None) -> Notification:
    """Persiste une notification et la pousse en temps réel si l'utilisateur est connecté."""
    notification = Notification(
        user_id=user_id,
        type=type,
        message=message,
        workflow_id=workflow_id,
        token_id=token_id,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    await event_bus.send_to_user(user_id, {
        "id": notification.id,
        "type": type,
        "message": message,
        "workflow_id": workflow_id,
        "token_id": token_id,
        "read": False,
        "timestamp": notification.created_at.isoformat(),
    })

    return notification
