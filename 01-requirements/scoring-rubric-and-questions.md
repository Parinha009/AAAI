# Scoring Rubric & Base Questions — "Junior Backend Engineer"

**Project:** Automated Asynchronous AI Interviewer (AAAI)
**Owner:** Thaing Parinha (Project Lead) · **Authored:** Week 5, 2026-07-28
**Satisfies:** SRS-FR-03 (JSON scorecard), SRS-FR-05 (base questions + global timer), SRS-FR-10 (robotic-language heuristic)
**Builds against:** `02-design/api-contract-v1/API_Contract_v1.md` (v1, FROZEN)

> **What this is.** The Lead-authored content that fills the two `JSONB` columns on the
> `jobs` table — `rubric_config` and `base_questions`. These are **tunable values**, not
> frozen shapes: per contract §10, the wording here can change without a version bump.
> The shapes they feed (`GET /interview/questions`, the `scores` row) are frozen and are
> reproduced below so any change here is checked against them.

---

## 1. The seed role

| Field | Value |
|---|---|
| Job title | `Junior Backend Engineer` |
| Base round length | `300` seconds (5:00) — **one global timer**, not per question |
| Number of base questions | 4 (contract allows 3–5) |
| Traits scored | `technical_skill`, `communication`, `problem_solving`, `job_fit` |
| Scale | integer `1`–`5` per trait |
| Aggregate | plain **sum** of the four traits, range **4–20** (contract §9.2) |

---

## 2. Scoring rubric (FR-03)

Written for a grader reading a **spoken transcript from a ~5-minute asynchronous
interview** — not a CV, not a code sample. Every anchor is observable in what the
candidate actually said.

### 2.1 `technical_skill` — correct, specific backend knowledge

| Score | Anchor |
|:---:|---|
| **1** | No backend concepts named, or names them wrongly (e.g. calls a database a server). Answers are entirely non-technical. |
| **2** | Uses correct terms (API, database, endpoint) but cannot say what they do. Repeats the question's own vocabulary without adding anything. |
| **3** | Correctly explains common concepts (REST endpoint, table, query) and names real tools they have used. Stays at textbook level — no depth beyond definitions. |
| **4** | Explains *how* something works and *why* it is built that way (e.g. why an index speeds up a lookup, why input is validated server-side). Cites specific work they did. |
| **5** | Explains a trade-off with both sides (e.g. when a relational DB beats a document store *and* when it does not) and mentions failure modes — errors, load, bad data. |

### 2.2 `communication` — clear, natural, human speech

> Also carries the **FR-10 robotic-language heuristic** — see §2.5.

| Score | Anchor |
|:---:|---|
| **1** | Cannot be followed. Fragments, long silences, or off-topic. **Or:** the transcript is clearly read aloud or AI-generated — flat, essay-like, no self-corrections. |
| **2** | Understandable but disorganised — jumps around, trails off, heavy filler. **Or:** noticeably templated ("Firstly… Secondly… In conclusion…") with no personal detail. |
| **3** | Gets the point across in a sensible order. Some rambling or vagueness, but a listener follows it. Sounds like a real person talking. |
| **4** | Well-structured and easy to follow — situation, action, result. Natural spoken rhythm. Adjusts the level of detail for the listener. |
| **5** | Genuinely engaging: concise, concrete, plain language for technical ideas, good analogies. Clearly unscripted — natural pauses and self-corrections. |

### 2.3 `problem_solving` — a method, not a lucky guess

| Score | Anchor |
|:---:|---|
| **1** | No approach described. Says it was fixed, or that they asked someone else, with no reasoning of their own. |
| **2** | Trial and error only — "I kept changing things until it worked." No way to tell what caused what. |
| **3** | Describes a recognisable process: reproduce it, read the error, add logging, check the recent change. Linear but sound. |
| **4** | Narrows the problem deliberately — forms a guess, tests it, rules things out, uses real tools (logs, debugger, `git bisect`). Explains how they *confirmed* the cause. |
| **5** | All of 4, plus reflection: what the root cause really was, what they changed so it cannot recur, and what they would do differently. Handles the unknown out loud rather than pretending certainty. |

### 2.4 `job_fit` — suited to a junior backend role here

| Score | Anchor |
|:---:|---|
| **1** | No backend interest or experience evident; examples are unrelated to software. |
| **2** | Some coding background, but all examples are frontend or other, with nothing showing server-side interest. |
| **3** | Real backend exposure — coursework, a personal project, an internship — and clear motivation for the role. Appropriate for a junior. |
| **4** | Has actually built and shipped backend work (APIs, databases, deployment). Talks about teamwork, code review, or requirements — signs they can work with others. |
| **5** | Strong junior fit: relevant hands-on work, visible drive to learn, and awareness of engineering practice (testing, documentation, maintainability) beyond just making it run. |

### 2.5 Grading rules the AI must follow

1. **Every trait gets an integer 1–5.** No half points, no nulls. The database enforces
   `CHECK (1..5)` — an out-of-range value is rejected, not clamped.
2. **One sentence of rationale per trait**, quoting or paraphrasing something the
   candidate actually said. Rationale that could apply to anybody is a grading failure.
3. **Robotic-language cap (FR-10).** If the transcript reads as scripted, read aloud, or
   AI-generated — flat delivery, essay structure, zero self-correction, no personal
   specifics — then `communication` is **capped at 2** and the trigger must be named in
   `rationale.communication`.
4. **Missing evidence scores low, not blank.** If the candidate never gave evidence for a
   trait, score it `1` or `2` and say so in the rationale.
5. **Silent or empty answers** (`response.status = "no_speech"`) contribute no evidence.
   They do not average out — they simply provide nothing to score.
6. **If the AI's JSON fails to parse**, set `manual_review_flag = true` and route the
   session to human review (contract §6, NFR-06). Never guess the numbers.

---

## 3. Base questions (FR-05)

Four questions, one per trait, inside the single 5:00 window (≈75 s each).

| # | `question_id` | Question | Mainly tests |
|:---:|:---:|---|---|
| 1 | `1` | Tell us about a backend project you've worked on. What part did you build, and what were you responsible for? | `job_fit` |
| 2 | `2` | Describe a bug that was hard to track down. How did you find the cause, and how did you know you'd actually fixed it? | `problem_solving` |
| 3 | `3` | How would you explain to a non-technical teammate what an API is and why it matters? | `communication` |
| 4 | `4` | When would you store data in a relational database like PostgreSQL rather than somewhere else — and what would make you choose differently? | `technical_skill` |

**Design intent.** Q1 is a deliberately easy opener so nervous candidates settle. Q2 and
Q4 are the ones that separate a 3 from a 5. Q3 is the cleanest read on natural speech
(FR-10) because it cannot be answered with memorised jargon.

### 3.1 Presentation rules (FR-05 — frozen behaviour)

- Questions are shown **one at a time**, in `order`.
- **One global 5:00 timer** covers the whole base round. There is **no per-question
  timer**. The candidate may spend their 300 seconds however they like.
- The frontend reads `300` from `base_round_seconds` in the API response — it must never
  hard-code the number (contract §1, "the API echoes these").
- Consent is required first; without it the endpoint returns `403 CONSENT_REQUIRED`.
- The one AI follow-up (FR-08) comes *after* the base round and has its own 2:30 window
  (`follow_up_seconds: 150`), served by `GET /interview/follow-up`.

### 3.2 Question → trait mapping

Each question is stored with the trait it primarily probes. This is a **hint for the
scorer, not a partition** — the AI scores all four traits from the full set of
transcripts, because a good answer to any question reveals communication, and any
technical question reveals problem-solving.

```
question 1  →  job_fit          (primary)
question 2  →  problem_solving  (primary)
question 3  →  communication    (primary)
question 4  →  technical_skill  (primary)
                                 all four traits ← all four transcripts (actual scoring input)
```

---

## 4. How this maps to the frozen contract

### 4.1 `GET /interview/questions` — the response is contract-exact

The `trait` tag is stored in the database but **stripped before serving**, because the
frozen response object has exactly three fields (contract §5.3):

```json
{
  "base_round_seconds": 300,
  "questions": [
    { "question_id": 1, "order": 1, "text": "Tell us about a backend project you've worked on. What part did you build, and what were you responsible for?" },
    { "question_id": 2, "order": 2, "text": "Describe a bug that was hard to track down. How did you find the cause, and how did you know you'd actually fixed it?" },
    { "question_id": 3, "order": 3, "text": "How would you explain to a non-technical teammate what an API is and why it matters?" },
    { "question_id": 4, "order": 4, "text": "When would you store data in a relational database like PostgreSQL rather than somewhere else — and what would make you choose differently?" }
  ]
}
```

### 4.2 The scorecard this rubric must produce (contract §5.4, frozen)

```json
{
  "technical_skill": 4,
  "communication": 5,
  "problem_solving": 4,
  "job_fit": 4,
  "aggregate_score": 17,
  "rationale": {
    "technical_skill": "Explained why an index speeds up the lookup, using their own project as the example.",
    "communication": "Natural, specific phrasing with self-corrections; no templated structure detected.",
    "problem_solving": "Formed a hypothesis about load, tested it, and confirmed the cause from the logs.",
    "job_fit": "Shipped a REST API in an internship and described the code review process."
  },
  "manual_review_flag": false
}
```

`aggregate_score` is the sum of the four traits (4–20) and is **computed, not authored by
the AI**.

### 4.3 Storage shape — `jobs.rubric_config`

The contract declares this column `JSONB` and describes it as "4-trait rubric + anchors
(Lead-authored, FR-03)". It is **never returned by any endpoint**, so its internal
structure is a Lead design decision, not a frozen shape. The structure used is:

```json
{
  "version": 1,
  "role": "Junior Backend Engineer",
  "scale": { "min": 1, "max": 5 },
  "aggregate": "sum",
  "traits": {
    "technical_skill": {
      "label": "Technical skill",
      "description": "Correct, specific backend knowledge.",
      "anchors": { "1": "...", "2": "...", "3": "...", "4": "...", "5": "..." }
    }
    // ...communication, problem_solving, job_fit
  },
  "grading_rules": [ "..." ],
  "flags": { "robotic_language_caps_communication_at": 2 }
}
```

The live values are seeded by `03-development/backend/app/seed.py` — that file is the
machine-readable copy of this document.

---

## 5. Open items

| # | Item | Status |
|---|---|---|
| 1 | Review-flag thresholds (`communication ≤ 2` OR `tab_out_count ≥ 3` OR grading failure) | Placeholder per contract §9.1 — final tuning is a Week-9 Lead task |
| 2 | The AI scoring prompt that consumes this rubric | **Not built yet** — AI/Infra work item |
| 3 | Whether the follow-up answer (FR-08) is scored alongside the base answers | Assumed **yes**; confirm with AI/Infra |
| 4 | Second seed role beyond Junior Backend Engineer | Not needed for the MVP |

---

*Values in this document are tunable (contract §10) — changing question wording or anchor
text is not a contract change and needs no version bump. Changing the trait names, the
1–5 scale, or the `GET /interview/questions` response shape **is** a contract change and
must be logged in `AAAI_Tracker.md`.*
