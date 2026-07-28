"""initial schema aligned to API Contract v1

Five shared tables (jobs, candidates, responses, scores, auditlogs) with integer
SERIAL PKs and enforced foreign keys, plus two backend-only helper tables
(recruiters, magic_link_tokens) for magic-link auth. auditlogs is append-only,
enforced by database triggers (SRS-FR-13 / NFR-01).

Revision ID: 0001_initial
Revises:
Create Date: 2026-07-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- jobs ------------------------------------------------------------
    op.create_table(
        "jobs",
        sa.Column("job_id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("rubric_config", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("base_questions", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # --- candidates ------------------------------------------------------
    op.create_table(
        "candidates",
        sa.Column("candidate_id", sa.Integer(), primary_key=True),
        sa.Column("job_id", sa.Integer(), sa.ForeignKey("jobs.job_id", name="fk_candidates_job_id"), nullable=False),
        sa.Column("name", sa.String(150)),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("consent_version", sa.String(20)),
        sa.Column("consent_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(20), nullable=False, server_default="invited"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "status IN ('invited','consented','in_progress','completed','expired')",
            name="ck_candidates_status",
        ),
    )
    op.create_index("ix_candidates_job_id", "candidates", ["job_id"])

    # --- responses -------------------------------------------------------
    op.create_table(
        "responses",
        sa.Column("response_id", sa.Integer(), primary_key=True),
        sa.Column("candidate_id", sa.Integer(), sa.ForeignKey("candidates.candidate_id", name="fk_responses_candidate_id"), nullable=False),
        sa.Column("job_id", sa.Integer(), sa.ForeignKey("jobs.job_id", name="fk_responses_job_id"), nullable=False),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(12), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="uploaded"),
        sa.Column("audio_path", sa.String(500)),
        sa.Column("audio_mime", sa.String(100)),
        sa.Column("transcript", sa.Text()),
        sa.Column("no_speech_flag", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("type IN ('base','follow_up')", name="ck_responses_type"),
        sa.CheckConstraint(
            "status IN ('uploaded','transcribing','transcribed','no_speech','failed')",
            name="ck_responses_status",
        ),
    )
    op.create_index("ix_responses_candidate_id", "responses", ["candidate_id"])
    op.create_index("ix_responses_job_id", "responses", ["job_id"])

    # --- scores ----------------------------------------------------------
    op.create_table(
        "scores",
        sa.Column("score_id", sa.Integer(), primary_key=True),
        sa.Column("candidate_id", sa.Integer(), sa.ForeignKey("candidates.candidate_id", name="fk_scores_candidate_id"), nullable=False, unique=True),
        sa.Column("job_id", sa.Integer(), sa.ForeignKey("jobs.job_id", name="fk_scores_job_id"), nullable=False),
        sa.Column("technical_skill", sa.Integer(), nullable=False),
        sa.Column("communication", sa.Integer(), nullable=False),
        sa.Column("problem_solving", sa.Integer(), nullable=False),
        sa.Column("job_fit", sa.Integer(), nullable=False),
        sa.Column("rationale", postgresql.JSONB()),
        sa.Column("manual_review_flag", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("technical_skill BETWEEN 1 AND 5", name="ck_scores_technical_skill_range"),
        sa.CheckConstraint("communication BETWEEN 1 AND 5", name="ck_scores_communication_range"),
        sa.CheckConstraint("problem_solving BETWEEN 1 AND 5", name="ck_scores_problem_solving_range"),
        sa.CheckConstraint("job_fit BETWEEN 1 AND 5", name="ck_scores_job_fit_range"),
    )
    op.create_index("ix_scores_job_id", "scores", ["job_id"])

    # --- auditlogs (append-only) ----------------------------------------
    op.create_table(
        "auditlogs",
        sa.Column("log_id", sa.Integer(), primary_key=True),
        sa.Column("candidate_id", sa.Integer(), sa.ForeignKey("candidates.candidate_id", name="fk_auditlogs_candidate_id"), nullable=False),
        sa.Column("job_id", sa.Integer(), sa.ForeignKey("jobs.job_id", name="fk_auditlogs_job_id"), nullable=False),
        sa.Column("event_type", sa.String(24), nullable=False),
        sa.Column("payload", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "event_type IN ('CONSENT','AI_REQUEST','AI_RESPONSE','TAB_OUT','BUDGET_FREEZE')",
            name="ck_auditlogs_event_type",
        ),
    )
    op.create_index("ix_auditlogs_candidate_created", "auditlogs", ["candidate_id", "created_at"])

    # --- recruiters (backend-only helper) -------------------------------
    op.create_table(
        "recruiters",
        sa.Column("recruiter_id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("name", sa.String(150)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # --- magic_link_tokens (backend-only helper) ------------------------
    op.create_table(
        "magic_link_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("job_id", sa.Integer(), sa.ForeignKey("jobs.job_id", name="fk_magic_link_job_id")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("role IN ('candidate','recruiter')", name="ck_magic_link_role"),
    )
    op.create_index("ix_magic_link_tokens_email", "magic_link_tokens", ["email"])

    # --- append-only enforcement on auditlogs (FR-13 / NFR-01) ----------
    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_auditlog_mutation()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION
                'auditlogs is append-only: % is not permitted (SRS-FR-13 / SRS-NFR-01)',
                TG_OP
                USING ERRCODE = 'restrict_violation';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("CREATE TRIGGER trg_auditlogs_no_update BEFORE UPDATE ON auditlogs FOR EACH ROW EXECUTE FUNCTION prevent_auditlog_mutation();")
    op.execute("CREATE TRIGGER trg_auditlogs_no_delete BEFORE DELETE ON auditlogs FOR EACH ROW EXECUTE FUNCTION prevent_auditlog_mutation();")
    op.execute("CREATE TRIGGER trg_auditlogs_no_truncate BEFORE TRUNCATE ON auditlogs FOR EACH STATEMENT EXECUTE FUNCTION prevent_auditlog_mutation();")


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_auditlogs_no_truncate ON auditlogs")
    op.execute("DROP TRIGGER IF EXISTS trg_auditlogs_no_delete ON auditlogs")
    op.execute("DROP TRIGGER IF EXISTS trg_auditlogs_no_update ON auditlogs")
    op.execute("DROP FUNCTION IF EXISTS prevent_auditlog_mutation()")
    op.drop_table("magic_link_tokens")
    op.drop_table("recruiters")
    op.drop_table("auditlogs")
    op.drop_table("scores")
    op.drop_table("responses")
    op.drop_table("candidates")
    op.drop_table("jobs")
