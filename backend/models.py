from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    special_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    guardian_links: Mapped[list["SubjectGuardian"]] = relationship(
        back_populates="subject",
        cascade="all, delete-orphan",
    )
    gps_records: Mapped[list["GPSRecord"]] = relationship(
        back_populates="subject",
        cascade="all, delete-orphan",
    )


class Guardian(Base):
    __tablename__ = "guardians"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)

    subject_links: Mapped[list["SubjectGuardian"]] = relationship(
        back_populates="guardian",
        cascade="all, delete-orphan",
    )


class SubjectGuardian(Base):
    __tablename__ = "subject_guardians"
    __table_args__ = (
        UniqueConstraint("subject_id", "guardian_id", name="uq_subject_guardian"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
    )
    guardian_id: Mapped[int] = mapped_column(
        ForeignKey("guardians.id", ondelete="CASCADE"),
        nullable=False,
    )
    relationship_type: Mapped[str] = mapped_column(String(30), nullable=False)

    subject: Mapped["Subject"] = relationship(back_populates="guardian_links")
    guardian: Mapped["Guardian"] = relationship(back_populates="subject_links")


class GPSRecord(Base):
    __tablename__ = "gps_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    measured_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )

    subject: Mapped["Subject"] = relationship(back_populates="gps_records")


class Facility(Base):
    __tablename__ = "facilities"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str] = mapped_column(String(250), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
