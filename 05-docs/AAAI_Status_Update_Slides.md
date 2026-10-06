# AAAI — Status Update & Progress Review
**Audience:** Instructor / class review · **Date:** 22 July 2026 (Week 4 of 11)
**Format:** Slide-by-slide content + speaker notes. Paste into Canva, or use the matching `AAAI_Status_Update.pptx`.
**Framing:** Honest progress review — what's done, what's in progress, what's next.

> Your finished **frontend** slides slot in at **Slide 10** ("Frontend preview").

---

## Slide 1 — Title
**On slide:**
- STATUS UPDATE · PROGRESS REVIEW
- **Automated Asynchronous AI Interviewer (AAAI)**
- A voice-based, AI-graded interview platform
- Team 1 · Lead: Thaing Parinha · Frontend: Soeng Senghorng · Backend: Lim Hokan · AI/Infra: Uy Sovannareach
- Course capstone · 22 July 2026 · Week 4 of 11

**Speaker notes:** Good [morning/afternoon]. We're building AAAI — a website where a job candidate does a first-round interview by talking to their computer, and an AI transcribes, follows up, and scores it. Today is a progress checkpoint: I'll show what's done, what we're building now, and our plan to the finish.

---

## Slide 2 — The problem
**On slide:**
- First-round interviews don't scale.
- **Scheduling** — coordinating live calls for many candidates is slow and costly.
- **Consistency** — human scoring drifts between interviewers and across a long day.
- **Fairness** — early screening is easy to bias and hard to audit.

**Speaker notes:** Screening the top of the funnel is where recruiters lose the most time, and where scoring is least consistent. We wanted a way to give every candidate the same structured interview, scored the same way, without a human having to be present for each one.

---

## Slide 3 — Our solution
**On slide:**
- A candidate completes a structured interview **by voice, asynchronously** — no scheduler, no live human.
- The AI **transcribes** the answers, asks **one contextual follow-up**, and produces a **structured scorecard**.
- A recruiter reviews a **ranked leaderboard** with transcripts, scores, and audio.

**Speaker notes:** The candidate just clicks an email link and speaks their answers. Everything after that is automated: transcription, a follow-up question generated from their own answers, and a four-trait score. The recruiter sees ranked results and can drill into any candidate.

---

## Slide 4 — How it works (the pipeline)
**On slide (left-to-right flow):**
Magic-link → Consent → Answer 3 questions (5:00, voice) → Whisper transcribes → 1 AI follow-up (2:30) → GPT-4o-mini scorecard → Recruiter dashboard

**Speaker notes:** We think of it as a digital assembly line — one straight path from invitation to a scored, reviewable record. The timers (5 minutes for the base round, 2:30 for the follow-up) are fixed product rules that also discourage cheating.

---

## Slide 5 — Architecture: "Messenger vs. Brain"
**On slide (two columns):**
- **Messenger — our code:** React + Tailwind (screens), FastAPI (server), PostgreSQL (data). Runs the UI, timers, storage, and moves data around.
- **Brain — cloud AI:** OpenAI Whisper (speech-to-text) + GPT-4o-mini (follow-up + scoring). All the reasoning.
- We orchestrate; the cloud AI does the heavy thinking — so our limited hours go to the product.

**Speaker notes:** A deliberate split. Student laptops can't run large models, and building ML from scratch would eat the whole timeline. So we treat OpenAI as a hosted brain and focus our effort on the product logic around it.

---

## Slide 6 — Scope: one complete path, done well
**On slide (two columns):**
- **In scope (the vertical slice):** consent, timed voice recording, transcription, dynamic follow-up, structured scoring, anti-cheat signals, recruiter review.
- **Cut list (out of scope, on purpose):** live video interviews, webcam/emotion tracking, custom ML training, multi-tenant company accounts, ATS integrations.

**Speaker notes:** Rather than build a little bit of everything, we commit to one complete end-to-end path and make it work reliably. The cut list is a deliberate decision, not an oversight — it protects the timeline.

---

## Slide 7 — 11-week roadmap
**On slide (timeline, 4 phases):**
- Phase 1 · Skeleton (Wk 1–3)
- Phase 2 · Wire the flow (Wk 4–5) ← **we are here (Week 4)**
- Phase 3 · Scoring + anti-cheat (Wk 6–8) — **Wk 6 = walking-skeleton gate (must run end-to-end)**
- Phase 4 · Dashboard + deploy (Wk 9–11) — **deliver 07 Sep**

**Speaker notes:** We're early in Phase 2. Honestly, the build start slipped about two weeks — I'll speak to that on the risks slide — but the design foundation is solid and we have a concrete plan to catch up. Our key checkpoint is Week 6: the thin path must run end to end, even if rough.

---

## Slide 8 — Status at a glance
**On slide (three columns):**
- **✅ Done:** SRS (requirements) · API/data contract v1 + 26 mock fixtures · GitHub repo + version control · Project structure · Frontend scaffold started
- **🔄 In progress:** Scoring rubric (4 traits × 1–5 anchors) · 3 base questions + seed test Job · Frontend candidate screens (aligning to the contract)
- **⏭ Next:** Backend (FastAPI + PostgreSQL) · AI integration (Whisper + GPT-4o-mini) · Walking-skeleton integration · Anti-cheat · Recruiter dashboard · Deploy

**Speaker notes:** This is the honest picture. The requirements and the contract are done and version-controlled. This week we're finalizing the scoring rubric and test data. Backend and AI are the next lanes to stand up.

---

## Slide 9 — Our foundation: a frozen API contract
**On slide:**
- We wrote the full **API/data contract v1 + mock fixtures before writing feature code.**
- So frontend, backend, and AI can build **in parallel**, each against the same agreed shapes — no one waits.
- **17 endpoints · 5 database tables · 26 mock fixtures · 1 source of truth**

**Speaker notes:** This is the piece I'm most proud of. Instead of everyone building blind, we froze the data shapes first. The frontend builds against realistic mock data today, and when the backend is ready, the pieces fit. It's the difference between three people colliding and three people building at once.

---

## Slide 10 — Frontend preview
**On slide:**
- → **Insert your finished frontend slides here.**
- Candidate screens: consent → question + timer → processing → done.

**Speaker notes:** [Hand to the frontend walkthrough — your existing Canva slides go here. Talk through the candidate journey on screen.]

---

## Slide 11 — Risks & how we're handling them
**On slide (rows):**
- **Timeline slipped ~2 weeks** → restarted with small "first-domino" tasks; the contract lets all three lanes build in parallel to recover.
- **Cloud AI can be slow or fail** → asynchronous processing wrappers + graceful degradation + manual-review fallback.
- **Runaway API cost** → hard **$10/month** budget cap, enforced in our code *and* on the provider side.
- **Scope creep** → frozen contract + explicit cut list.

**Speaker notes:** I want to be straight about the slip. We lost roughly two weeks getting the build started. We've responded by shrinking tasks to one-sitting "first dominoes" and by leaning on the contract so the lanes don't block each other. The other risks were designed for from day one.

---

## Slide 12 — The team
**On slide (four cards):**
- **Thaing Parinha — Lead:** PM, API contract, scoring rubric, prompts, QA.
- **Soeng Senghorng — Frontend:** React + Tailwind candidate & recruiter screens.
- **Lim Hokan — Backend:** FastAPI + PostgreSQL, API routes, schema.
- **Uy Sovannareach — AI/Infra:** OpenAI integration, hosting, cost guards.

**Speaker notes:** Four of us, each owning a lane, all building against the shared contract.

---

## Slide 13 — Where we go next
**On slide:**
- **This week:** finalize the scoring rubric + seed a test Job with sample audio.
- **Next:** stand up the backend and AI lanes → first real transcription and score.
- **By Week 6:** the walking skeleton runs end to end.
- *Strong foundation in place. Now we build the slice.*
- **Thank you — questions?**

**Speaker notes:** To close: the thinking and the foundation are done and version-controlled, and we have a clear, honest path to a working end-to-end demo by Week 6. Thank you — happy to take questions.
