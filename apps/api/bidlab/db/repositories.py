"""Thin persistence helpers over a Session (T06 skeleton; grows with services)."""

from sqlalchemy.orm import Session


def get_by_id[T](session: Session, model: type[T], ident: str) -> T | None:
    return session.get(model, ident)


def add_all(session: Session, entities: list[object]) -> None:
    session.add_all(entities)
    session.commit()
