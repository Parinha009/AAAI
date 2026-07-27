"""initial schema: jobs, candidates, responses, scores, audit_logs

Creates the five core tables with enforced foreign keys (SRS-2.5 relational
integrity) and installs the database-level append-only guard on audit_logs
(SRS-FR-13, SRS-NFR-01).

Revision ID: 0001_initial
Revises:
Create Date: 2026-07-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # gen_random_uuid() ships in core since PG13; keep pgcrypto for portability.
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # --- jobs ------------------------------------------------------------
    op.create_table(
        "jobs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("rubric_prompt", sa.Text()),
        sa.Column("follow_up_prompt", sa.Text()),
        sa.Column(
            "base_questions",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # --- candidates ------------------------------------------------------
    op.create_table(
        "candidates",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", name="fk_candidates_job_id"),
            nullable=False,
        ),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("name", sa.String(255)),
        sa.Column("status", sa.String(20), nullable=False, server_default="invited"),
        sa.Column("consent_at", sa.DateTime(timezone=True)),
        sa.Column("consent_version", sa.String(50)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('invited','consented','in_progress','completed')",
            name="ck_candidates_status",
        ),
    )
    op.create_index("ix_candidates_job_id", "candidates", ["job_id"])

    # --- responses -------------------------------------------------------
    op.create_table(
        "responses",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "candidate_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("candidates.id", name="fk_responses_candidate_id"),
            nullable=False,
        ),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", name="fk_responses_job_id"),
            nullable=False,
        ),
        sa.Column("response_type", sa.String(20), nullable=False),
        sa.Column("question_index", sa.Integer()),
        sa.Column("question_text", sa.Text()),
        sa.Column("audio_path", sa.String(1024)),
        sa.Column("audio_mime", sa.String(100)),
        sa.Column("audio_size_bytes", sa.BigInteger()),
        sa.Column("transcript", sa.Text()),
        sa.Column("no_speech", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("detected_language", sa.String(20)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "response_type IN ('base','follow_up')", name="ck_responses_type"
        ),
    )
    op.create_index("ix_responses_candidate_id", "responses", ["candidate_id"])
    op.create_index("ix_responses_job_id", "responses", ["job_id"])

    # --- scores ----------------------------------------------------------
    op.create_table(
        "scores",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "candidate_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("candidates.id", name="fk_scores_candidate_id"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", name="fk_scores_job_id"),
            nullable=False,
        ),
        sa.Column("technical_skill", sa.Integer(), nullable=False),
        sa.Column("communication", sa.Integer(), nullable=False),
        sa.Column("problem_solving", sa.Integer(), nullable=False),
        sa.Column("job_fit", sa.Integer(), nullable=False),
        sa.Column("technical_rationale", sa.Text()),
        sa.Column("communication_rationale", sa.Text()),
        sa.Column("problem_solving_rationale", sa.Text()),
        sa.Column("job_fit_rationale", sa.Text()),
        sa.Column("needs_review", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("review_reason", sa.Text()),
        sa.Column("raw_scorecard", postgresql.JSONB()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("technical_skill BETWEEN 1 AND 5", name="ck_scores_technical_skill_range"),
        sa.CheckConstraint("communication BETWEEN 1 AND 5", name="ck_scores_communication_range"),
        sa.CheckConstraint("problem_solving BETWEEN 1 AND 5", name="ck_scores_problem_solving_range"),
        sa.CheckConstraint("job_fit BETWEEN 1 AND 5", name="ck_scores_job_fit_range"),
    )
    op.create_index("ix_scores_job_id", "scores", ["job_id"])

    # --- audit_logs (append-only) ---------------------------------------
    op.create_table(
        "audit_logs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "seq",
            sa.BigInteger(),
            sa.Identity(always=True),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "candidate_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("candidates.id", name="fk_audit_logs_candidate_id"),
            nullable=False,
        ),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", name="fk_audit_logs_job_id"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("request_payload", postgresql.JSONB()),
        sa.Column("response_payload", postgresql.JSONB()),
        sa.Column("event_data", postgresql.JSONB()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "event_type IN ('AI_REQUEST','AI_RESPONSE','TAB_OUT','CONSENT','PASTE_BLOCKED')",
            name="ck_audit_logs_event_type",
        ),
    )
    op.create_index(
        "ix_audit_logs_candidate_created", "audit_logs", ["candidate_id", "created_at"]
    )

    # --- append-only enforcement (SRS-FR-13 / SRS-NFR-01) ---------------
    # A DB-level guard: any UPDATE, DELETE, or TRUNCATE against audit_logs
    # raises, so no application code path (or ad-hoc SQL) can alter history.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION
                'audit_logs is append-only: % is not permitted (SRS-FR-13 / SRS-NFR-01)',
                TG_OP
                USING ERRCODE = 'restrict_violation';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_audit_logs_no_update
        BEFORE UPDATE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_audit_logs_no_delete
        BEFORE DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_audit_logs_no_truncate
        BEFORE TRUNCATE ON audit_logs
        FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_mutation();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_log_mutation()")

    op.drop_table("audit_logs")
    op.drop_table("scores")
    op.drop_table("responses")
    op.drop_table("candidates")
    op.drop_table("jobs")
