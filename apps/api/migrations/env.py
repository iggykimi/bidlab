"""Alembic env. URL comes from Settings storage dir. Models wired in T06."""

from alembic import context
from bidlab.settings import get_settings
from sqlalchemy import create_engine

config = context.config


def run_migrations_offline() -> None:
    settings = get_settings()
    url = f"sqlite:///{settings.storage_path / 'bidlab.sqlite3'}"
    context.configure(url=url, literal_binds=True)

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    settings = get_settings()
    url = f"sqlite:///{settings.storage_path / 'bidlab.sqlite3'}"
    engine = create_engine(url)

    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=None)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
