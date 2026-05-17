from sqlmodel import Session, SQLModel, create_engine

from backend import config

config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
_engine = create_engine(
    f"sqlite:///{config.DB_PATH}",
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    SQLModel.metadata.create_all(_engine)


def get_session() -> Session:
    return Session(_engine)


def reset_db() -> None:
    SQLModel.metadata.drop_all(_engine)
    SQLModel.metadata.create_all(_engine)
