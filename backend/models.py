from enum import Enum

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
    BigInteger,
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
    auth_code = Column(String(6), nullable=True, index=True)
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

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
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
        passive_deletes=True,
    )
class DeviceToken(Base):
    __tablename__ = "device_tokens"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_type = Column(
        String(20),
        nullable=False,
        index=True,
    )

    user_id = Column(
        Integer,
        nullable=False,
        index=True,
    )

    token = Column(
        Text,
        nullable=False,
        unique=True,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    
class Institution(Base):
    __tablename__ = "institutions"

    id = Column(Integer, primary_key=True)

    institution_code = Column(
        String(100),
        unique=True,
        nullable=False,
    )
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
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    subjects = relationship(
        "Subject",
        back_populates="institution",
        passive_deletes=True,
    )
    managers = relationship(
        "InstitutionManager",
        back_populates="institution",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    auth_code = Column(String(6), nullable=True, index=True)

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
    auth_code = Column(
        String(50),
        nullable=True,
        unique=True,
        index=True,
    )

    special_notes = Column(Text, nullable=True)

    institution_id = Column(
    Integer,
    ForeignKey("institutions.id", ondelete="SET NULL"),
    nullable=True,
)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    institution = relationship(
        "Institution",
        back_populates="subjects",
    )
    guardian_registrations = relationship(
        "GuardianRegistration",
        back_populates="subject",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    manager_assignments = relationship(
        "ManagerAssignment",
        back_populates="subject",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    gps_records = relationship(
        "GPSRecord",
        back_populates="subject",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    alerts = relationship(
    "Alert",
    back_populates="subject",
    cascade="all, delete-orphan",
    passive_deletes=True,
)

    auth_codes = relationship(
        "SubjectAuthCode",
        back_populates="subject",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class GuardianRegistration(Base):
    __tablename__ = "guardian_registrations"

    guardian_id = Column(
        Integer,
        ForeignKey(
            "guardians.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    )
    subject_id = Column(
        Integer,
        ForeignKey(
            "subjects.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    )

    relationship_code = Column(String(50), nullable=False)
    guardian_role_code = Column(String(50), nullable=True)
    is_primary = Column(Boolean, nullable=False, default=False)
    contact_priority = Column(Integer, nullable=False, default=1)
    living_together = Column(Boolean, nullable=False, default=False)
    protection_start_date = Column(Date, nullable=True)
    protection_end_date = Column(Date, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    guardian = relationship(
        "Guardian",
        back_populates="subject_registrations",
    )
    subject = relationship(
        "Subject",
        back_populates="guardian_registrations",
    )

    __table_args__ = (
        UniqueConstraint(
            "guardian_id",
            "subject_id",
            name="uq_guardian_subject",
        ),
    )


class InstitutionManager(Base):
    __tablename__ = "institution_managers"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    institution_id = Column(
        Integer,
        ForeignKey(
            "institutions.id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )

    name = Column(String(100), nullable=True)
    phone = Column(String(30), nullable=True)
    email = Column(
        String(255),
        nullable=True,
        index=True,
    )

    provider = Column(
        String(20),
        nullable=False,
    )

    provider_user_id = Column(
        String(255),
        nullable=False,
    )

    position = Column(String(100), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "provider",
            "provider_user_id",
            name="uq_institution_manager_social",
        ),
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    institution = relationship(
        "Institution",
        back_populates="managers",
    )
    subject_assignments = relationship(
        "ManagerAssignment",
        back_populates="manager",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

class ManagerAssignment(Base):
    __tablename__ = "manager_assignments"

    manager_id = Column(
        Integer,
        ForeignKey(
            "institution_managers.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    )
    subject_id = Column(
        Integer,
        ForeignKey(
            "subjects.id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    )

    is_primary_manager = Column(Boolean, nullable=False, default=False)
    assignment_start_date = Column(Date, nullable=True)
    assignment_end_date = Column(Date, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    manager = relationship(
        "InstitutionManager",
        back_populates="subject_assignments",
    )
    subject = relationship(
        "Subject",
        back_populates="manager_assignments",
    )

    __table_args__ = (
        UniqueConstraint(
            "manager_id",
            "subject_id",
            name="uq_manager_subject",
        ),
    )
class GPSRecord(Base):
    __tablename__ = "gps_records"

    gps_id = Column(
        BigInteger,
        primary_key=True,
        index=True,
    )

    subject_id = Column(
        BigInteger,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    dayofweek = Column(String(10), nullable=True)
    
    measured_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    subject = relationship(
        "Subject",
        back_populates="gps_records",
    )

    
class Inference(Base):
    __tablename__ = "inference"

    gps_id = Column(
            BigInteger,
            ForeignKey("gps_records.gps_id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )

    subject_id = Column(
            BigInteger,
            ForeignKey("subjects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )

    # EPSG:5179 변환 좌표
    # x = Column(Float, nullable=True)
    # y = Column(Float, nullable=True)

    # x_d = Column(Integer, nullable=True)
    # y_d = Column(Integer, nullable=True)
    token = Column(BigInteger, nullable=True)

    token_probability = Column(Float, nullable=True)
    anomaly_score = Column(Float, nullable=True)

    scored_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )
    


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(
        BigInteger,
        primary_key=True,
        index=True,
    )

    type = Column(
        String(50),
        nullable=False,
    )

    subject_id = Column(
        BigInteger,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    guardian_id = Column(
        BigInteger,
        ForeignKey("guardians.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    message = Column(
        Text,
        nullable=False,
    )

    risk_score = Column(
        Float,
        nullable=True,
    )

    is_read = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Subject.alerts 와 연결
    subject = relationship(
        "Subject",
        back_populates="alerts",
    )

class RiskStatusHistory(Base):
    __tablename__ = "risk_status_history"

    id = Column(
        BigInteger,
        primary_key=True,
        index=True,
    )

    subject_id = Column(
        BigInteger,
        ForeignKey(
            "subjects.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # safe / caution / danger
    risk_level = Column(
        String(20),
        nullable=False,
        index=True,
    )

    # 최종 통합 위험 점수
    risk_score = Column(
        Float,
        nullable=True,
    )

    # 각각의 세부 점수
    lmtad_score = Column(
        Float,
        nullable=True,
    )

    weather_score = Column(
        Float,
        nullable=True,
    )

    air_score = Column(
        Float,
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

class SubjectAuthCode(Base):
    __tablename__ = "subject_auth_codes"

    id = Column(Integer, primary_key=True, index=True)

    subject_id = Column(
        Integer,
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    code = Column(String(6), nullable=False, index=True)

    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    used_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    subject = relationship(
        "Subject",
        back_populates="auth_codes",
    )
