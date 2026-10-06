"""RBAC core — roles and permissions, mapped directly to the SRS.

The three roles are the SRS user classes (SRS-2.3):

- CANDIDATE  — external interviewee. Consents, answers base/follow-up questions by
               voice, and has ZERO visibility into scoring internals.
- RECRUITER  — trusted account. Views the ranked leaderboard, drills into transcripts
               & scores, plays raw audio, and overrides AI judgment when flagged.
- ADMIN      — Project Lead / System Administrator. Configures base questions and
               rubrics, authors/revises system prompts, and runs QA test batches.

The API Contract v1 currently issues only `candidate` / `recruiter` tokens, so ADMIN
is defined and enforced but not yet issuable (a small contract-v1.1 step).
"""

from enum import Enum


class Role(str, Enum):
    CANDIDATE = "candidate"
    RECRUITER = "recruiter"
    ADMIN = "admin"  # Project Lead / System Administrator (SRS-2.3)


class Permission(str, Enum):
    # --- Candidate (SRS-2.3 Candidate) ---
    GIVE_CONSENT = "give_consent"          # FR-01
    ANSWER_INTERVIEW = "answer_interview"  # FR-02 / FR-05 / FR-08 / FR-09
    UPLOAD_RESPONSE = "upload_response"    # FR-06

    # --- Recruiter (SRS-2.3 Recruiter; FR-14/15/16) ---
    VIEW_LEADERBOARD = "view_leaderboard"  # FR-14 ranked leaderboard
    VIEW_CANDIDATE = "view_candidate"      # FR-14 transcripts + scores drill-down
    PLAY_AUDIO = "play_audio"              # FR-15 raw audio playback
    OVERRIDE_SCORE = "override_score"      # FR-15 human-in-the-loop override
    VIEW_BUDGET = "view_budget"            # FR-16 budget status
    INVITE_CANDIDATE = "invite_candidate"  # FR-04 candidates are invited, never self-registered

    # --- Project Lead / System Administrator (SRS-2.3) ---
    MANAGE_QUESTIONS = "manage_questions"  # FR-05 base questions config
    MANAGE_RUBRIC = "manage_rubric"        # FR-03 scoring rubric
    MANAGE_PROMPTS = "manage_prompts"      # FR-08 / FR-10 system prompts
    RUN_QA = "run_qa"                      # jailbreak / injection / consistency batches


_CANDIDATE = frozenset(
    {Permission.GIVE_CONSENT, Permission.ANSWER_INTERVIEW, Permission.UPLOAD_RESPONSE}
)
_RECRUITER = frozenset(
    {
        Permission.VIEW_LEADERBOARD,
        Permission.VIEW_CANDIDATE,
        Permission.PLAY_AUDIO,
        Permission.OVERRIDE_SCORE,
        Permission.VIEW_BUDGET,
        Permission.INVITE_CANDIDATE,
    }
)
# Project Lead oversees the whole pipeline: recruiter view + configuration/QA.
_ADMIN = _RECRUITER | frozenset(
    {
        Permission.MANAGE_QUESTIONS,
        Permission.MANAGE_RUBRIC,
        Permission.MANAGE_PROMPTS,
        Permission.RUN_QA,
    }
)

ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.CANDIDATE: _CANDIDATE,
    Role.RECRUITER: _RECRUITER,
    Role.ADMIN: _ADMIN,
}


def permissions_for(role: Role) -> frozenset[Permission]:
    return ROLE_PERMISSIONS.get(role, frozenset())


def has_permission(role: Role, permission: Permission) -> bool:
    return permission in permissions_for(role)
