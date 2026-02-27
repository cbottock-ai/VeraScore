from collections.abc import Generator

import sqlite_vec
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def _load_sqlite_vec(dbapi_conn, connection_record):
    """Load sqlite-vec extension when a connection is created."""
    dbapi_conn.enable_load_extension(True)
    sqlite_vec.load(dbapi_conn)
    dbapi_conn.enable_load_extension(False)


engine = create_engine("sqlite:///verascore.db", connect_args={"check_same_thread": False})
event.listen(engine, "connect", _load_sqlite_vec)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
