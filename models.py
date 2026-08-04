from enum import Enum
from sqlalchemy.dialects.postgresql import ENUM as PGEnum

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum as SqlEnum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class GenderType(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    UNKNOWN = "unknown"


class SubjectType(str, Enum):
    CHILD = "child"
    DEMENTIA = "dementia"
    ELDERLY = "elderly"
    DISABILITY = "disability"
    GENERAL = "general"
    OTHER = "other"


class InstitutionType(str, Enum):
    CHILD = "child"
    DEMENTIA = "dementia"
    ELDERLY = "elderly"
    DISABILITY = "disability"
    GENERAL = "general"
    POLICE = "police"
    HOSPITAL = "hospital"
    OTHER = "other"


class Guardian(Base):
    __tablename__ = "guardians"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    gender = Column(
    SqlEnum(
        GenderType,
        name="gendertype",
        native_enum=True,
    ),
    nullable=False,
    default=GenderType.UNKNOWN,
)
    phone = Column(String(30), nullable=False, unique=True, index=True)
    birth_date = Column(Date, nullable=True)
    address = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    subject_registrations = relationship(
        "GuardianRegistration",
        back_populates="guardian",
        cascade="all, delete-orphan",
    )


class Institution(Base):
    __tablename__ = "institutions"

    id = Column(Integer, primary_key=True, index=True)
    institution_code = Column(String(100), nullable=False, unique=True, index=True)
    name = Column(String(200), nullable=False)
    institution_type = Column(
    SqlEnum(
        InstitutionType,
        name="institutiontype",
        native_enum=True,
    ),
    nullable=False,
    default=InstitutionType.GENERAL,
)
    address = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    operating_hours = Column(String(255), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    subjects = relationship("Subject", back_populates="institution")
    managers = relationship(
        "InstitutionManager",
        back_populates="institution",
        cascade="all, delete-orphan",
    )


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    gender = Column(
    SqlEnum(
        GenderType,
        name="gendertype",
        native_enum=True,
    ),
    nullable=False,
    default=GenderType.UNKNOWN,
)
    phone = Column(String(30), nullable=True, unique=True, index=True)
    birth_date = Column(Date, nullable=True)
    address = Column(String(255), nullable=True)
    subject_type = Column(
    SqlEnum(
        SubjectType,
        name="subjecttype",
        native_enum=True,
    ),
    nullable=False,
    default=SubjectType.GENERAL,
)
    special_notes = Column(Text, nullable=True)

    institution_id = Column(
        Integer,
        ForeignKey("institutions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    institution = relationship("Institution", back_populates="subjects")
    guardian_registrations = relationship(
        "GuardianRegistration",
        back_populates="subject",
        cascade="all, delete-orphan",
    )
    manager_assignments = relationship(
        "ManagerAssignment",
        back_populates="subject",
        cascade="all, delete-orphan",
    )
    gps_records = relationship(
        "GPSRecord",
        back_populates="subject",
        cascade="all, delete-orphan",
    )


class GuardianRegistration(Base):
    __tablename__ = "guardian_registrations"

    guardian_id = Column(
        Integer,
        ForeignKey("guardians.id", ondelete="CASCADE"),
        primary_key=True,
    )
    subject_id = Column(
        Integer,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        primary_key=True,
    )
    relationship_code = Column(String(50), nullable=False)
    guardian_role_code = Column(String(50), nullable=True)
    is_primary = Column(Boolean, nullable=False, default=False)
    contact_priority = Column(Integer, nullable=False, default=1)
    living_together = Column(Boolean, nullable=False, default=False)
    protection_start_date = Column(Date, nullable=True)
    protection_end_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    guardian = relationship("Guardian", back_populates="subject_registrations")
    subject = relationship("Subject", back_populates="guardian_registrations")

    __table_args__ = (
        UniqueConstraint("guardian_id", "subject_id", name="uq_guardian_subject"),
    )


class InstitutionManager(Base):
    __tablename__ = "institution_managers"

    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(
        Integer,
        ForeignKey("institutions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=False)
    position = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    institution = relationship("Institution", back_populates="managers")
    subject_assignments = relationship(
        "ManagerAssignment",
        back_populates="manager",
        cascade="all, delete-orphan",
    )


class ManagerAssignment(Base):
    __tablename__ = "manager_assignments"

    manager_id = Column(
        Integer,
        ForeignKey("institution_managers.id", ondelete="CASCADE"),
        primary_key=True,
    )
    subject_id = Column(
        Integer,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        primary_key=True,
    )
    is_primary_manager = Column(Boolean, nullable=False, default=False)
    assignment_start_date = Column(Date, nullable=True)
    assignment_end_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    manager = relationship("InstitutionManager", back_populates="subject_assignments")
    subject = relationship("Subject", back_populates="manager_assignments")

    __table_args__ = (
        UniqueConstraint("manager_id", "subject_id", name="uq_manager_subject"),
    )


class GPSRecord(Base):
    __tablename__ = "gps_records"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(
        Integer,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    measured_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    subject = relationship("Subject", back_populates="gps_records")
