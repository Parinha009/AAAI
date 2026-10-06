"""Hiring projects (jobs) and their question banks - machine-readable seed data.

Each job has a bank of 12 questions, 3 per trait. Every interview draws 4 of them at
random, one per trait (see app/questions.py), so candidates don't all get the same
questions. Questions are written to be answered *out loud* in about a minute.

The Junior Backend Engineer job is the Lead-authored one (rubric + questions 1-4 in
seed.py, from 01-requirements/scoring-rubric-and-questions.md); questions 5-12 below
extend its bank. For the other roles, the communication and problem-solving anchors,
grading rules and FR-10 cap are the Lead's (copied in seed.py); only technical skill
and job fit are role-specific. Per contract §10 these are tunable *values*.
"""


def _q(question_id, trait, text):
    return {"question_id": question_id, "order": question_id, "text": text, "trait": trait}


# Extra questions for the Lead's Junior Backend Engineer bank (ids 5-12; 1-4 are the Lead's).
BACKEND_EXTRA_QUESTIONS = [
    _q(5, "technical_skill", "Walk me through what happens, step by step, when your API receives a request and saves something to the database."),
    _q(6, "technical_skill", "How would you stop the same user from creating a duplicate record if they click the submit button twice?"),
    _q(7, "communication", "Describe a time you had to explain a technical decision to someone who disagreed with you. How did you make your case?"),
    _q(8, "communication", "Imagine a teammate's code broke production. How would you tell them, and what would you say?"),
    _q(9, "problem_solving", "An endpoint that used to take 100 milliseconds now takes 5 seconds. How would you find out why?"),
    _q(10, "problem_solving", "You inherit a project with no tests and no documentation. What do you do in your first week?"),
    _q(11, "job_fit", "Which backend skill are you working on improving right now, and how are you practising it?"),
    _q(12, "job_fit", "What kind of team and code review culture helps you do your best work as a junior developer?"),
]


def _anchors(one, two, three, four, five):
    return {"1": one, "2": two, "3": three, "4": four, "5": five}


ROLE_JOBS = [
    {
        "title": "Senior Frontend Engineer",
        "technical_skill": {
            "label": "Technical skill",
            "description": "Deep, correct frontend engineering knowledge at a senior level.",
            "anchors": _anchors(
                "No real frontend concepts, or names them wrongly. Nothing about the browser, rendering or state.",
                "Knows the vocabulary (component, state, CSS) but cannot say how it works or why.",
                "Explains common concepts correctly - component state, props, the DOM, responsive CSS - at a mid-level depth.",
                "Explains how and why: rendering cost, state ownership, accessibility, bundle size. Cites real work they led.",
                "Weighs trade-offs both ways (e.g. server vs client rendering, global vs local state) and names failure modes - slow devices, flaky networks, a11y gaps.",
            ),
        },
        "job_fit": {
            "label": "Job fit",
            "description": "Suited to a senior frontend role: ownership, mentoring, quality.",
            "anchors": _anchors(
                "No frontend experience relevant to a senior role.",
                "Some frontend work, but only small tasks under close direction.",
                "Solid hands-on frontend experience; some ownership of features.",
                "Has owned significant frontend features end to end and influenced how the team builds UI.",
                "Clear senior profile: sets technical direction, mentors others, cares about performance, accessibility and maintainability.",
            ),
        },
        "questions": [
            _q(1, "technical_skill", "How do you decide where a piece of state should live in a large React app, and when do you reach for a global store?"),
            _q(2, "technical_skill", "A page feels slow on a cheap Android phone. How do you measure what's wrong, and what would you try first?"),
            _q(3, "technical_skill", "What does it take to make a complex form or modal properly accessible to keyboard and screen-reader users?"),
            _q(4, "communication", "How would you explain to a product manager why a 'small' UI change will actually take two weeks?"),
            _q(5, "communication", "Tell me about a code review where you strongly disagreed with someone. How did you handle the conversation?"),
            _q(6, "communication", "How would you onboard a junior developer onto your frontend codebase in their first week?"),
            _q(7, "problem_solving", "A bug only happens for some users in Safari, and you can't reproduce it. Walk me through how you'd track it down."),
            _q(8, "problem_solving", "Your team's bundle size doubled over six months. How would you find the cause and stop it happening again?"),
            _q(9, "problem_solving", "Describe the hardest UI bug you've fixed. How did you prove you'd found the real cause?"),
            _q(10, "job_fit", "Tell me about a frontend feature you owned from design to production. What were you most proud of?"),
            _q(11, "job_fit", "How have you influenced the frontend standards or architecture of a team you worked in?"),
            _q(12, "job_fit", "What do you look for when you review a junior developer's pull request?"),
        ],
    },
    {
        "title": "Full-Stack Engineer",
        "technical_skill": {
            "label": "Technical skill",
            "description": "Correct knowledge across frontend, backend and the database, and how they connect.",
            "anchors": _anchors(
                "No real web concepts; cannot describe either side of an application.",
                "Knows terms from one side only, or names them without explaining them.",
                "Explains how a frontend talks to an API and a database at a correct but basic level.",
                "Explains decisions across the stack - API design, data modelling, auth, caching - with real examples.",
                "Weighs trade-offs across layers (where to validate, what to cache, sync vs async) and names failure modes end to end.",
            ),
        },
        "job_fit": {
            "label": "Job fit",
            "description": "Suited to a full-stack role: comfortable shipping features across the whole stack.",
            "anchors": _anchors(
                "No relevant software experience.",
                "Experience on only one side of the stack, with no interest in the other.",
                "Has built small features touching both frontend and backend.",
                "Has shipped complete features end to end, including the database and deployment.",
                "Strong full-stack profile: owns features from UI to database, thinks about testing, monitoring and users.",
            ),
        },
        "questions": [
            _q(1, "technical_skill", "Walk me through everything that happens between a user clicking 'Save' in your app and the data landing in the database."),
            _q(2, "technical_skill", "How would you design login for a web app? Where do you store the session, and why?"),
            _q(3, "technical_skill", "When do you validate data on the frontend, when on the backend, and why not just one of them?"),
            _q(4, "communication", "How do you keep the frontend and backend in sync when you, or two different people, are building both halves?"),
            _q(5, "communication", "Explain to a non-technical client why their site went down for an hour, and what you're doing about it."),
            _q(6, "communication", "Tell me about a time you had to push back on a feature request. How did you explain your reasons?"),
            _q(7, "problem_solving", "Users report the dashboard sometimes shows stale data. How would you figure out which layer is causing it?"),
            _q(8, "problem_solving", "A feature works on your machine but fails in production. What do you check, and in what order?"),
            _q(9, "problem_solving", "You need to add a column to a busy database table without downtime. How would you plan it?"),
            _q(10, "job_fit", "Tell me about a feature you built end to end. Which part of the stack did you enjoy most, and why?"),
            _q(11, "job_fit", "How do you decide what to learn next when the web stack changes so quickly?"),
            _q(12, "job_fit", "What's your experience with deploying and monitoring an application after it's built?"),
        ],
    },
    {
        "title": "QA Engineer",
        "technical_skill": {
            "label": "Technical skill",
            "description": "Correct software testing knowledge: test design, automation and bug reporting.",
            "anchors": _anchors(
                "No testing concepts; equates QA with 'clicking around'.",
                "Knows terms (test case, bug, regression) but cannot apply them.",
                "Designs sensible test cases, knows manual vs automated testing, writes clear bug reports.",
                "Explains test strategy - what to automate, test pyramid, edge cases - with tools they have used.",
                "Weighs risk and coverage trade-offs, designs tests for failure modes (bad data, load, concurrency) and improves the team's process.",
            ),
        },
        "job_fit": {
            "label": "Job fit",
            "description": "Suited to a QA role: curiosity, rigour and quality advocacy.",
            "anchors": _anchors(
                "No interest or experience in testing or quality.",
                "Some exposure to testing, mostly following scripts written by others.",
                "Has tested real products, written test cases and logged useful bugs.",
                "Has owned testing for features or releases and worked closely with developers.",
                "Strong QA profile: drives quality across the team, automates wisely, and thinks like a user and an attacker.",
            ),
        },
        "questions": [
            _q(1, "technical_skill", "How would you test a login page? Talk me through the cases you'd cover."),
            _q(2, "technical_skill", "How do you decide which tests to automate and which to keep manual?"),
            _q(3, "technical_skill", "What makes a bug report good enough that a developer can fix it without asking you questions?"),
            _q(4, "communication", "A developer says your bug is 'not a bug, it's how it works'. How do you handle that conversation?"),
            _q(5, "communication", "How would you explain to a manager that a release isn't ready, when they really want to ship today?"),
            _q(6, "communication", "Tell me about a time your testing found something important. How did you communicate it to the team?"),
            _q(7, "problem_solving", "A bug appears only once every fifty runs. How would you go about reproducing and isolating it?"),
            _q(8, "problem_solving", "You have one day to test a big release. How do you decide what to test first?"),
            _q(9, "problem_solving", "Your automated tests keep failing randomly. How would you find out whether it's the tests or the product?"),
            _q(10, "job_fit", "What drew you to quality assurance rather than another role in software?"),
            _q(11, "job_fit", "Which testing tools or frameworks have you used, and what did you build with them?"),
            _q(12, "job_fit", "How do you keep yourself thinking like a real user after testing the same app for months?"),
        ],
    },
    {
        "title": "DevOps Engineer",
        "technical_skill": {
            "label": "Technical skill",
            "description": "Correct knowledge of deployment, infrastructure, CI/CD and operations.",
            "anchors": _anchors(
                "No infrastructure or deployment concepts.",
                "Knows terms (Docker, CI, cloud) but cannot explain what they do.",
                "Explains containers, pipelines and basic cloud services correctly.",
                "Explains how and why - immutable deploys, infrastructure as code, monitoring - from real work.",
                "Weighs trade-offs (cost vs reliability, speed vs safety) and designs for failure: rollbacks, alerts, recovery.",
            ),
        },
        "job_fit": {
            "label": "Job fit",
            "description": "Suited to a DevOps role: reliability mindset and automation.",
            "anchors": _anchors(
                "No relevant operations or automation experience.",
                "Some scripting or server experience, mostly ad hoc.",
                "Has set up pipelines or deployments for real projects.",
                "Has run production systems, handled incidents, and automated repeat work.",
                "Strong DevOps profile: owns reliability, automates relentlessly, and helps developers ship safely.",
            ),
        },
        "questions": [
            _q(1, "technical_skill", "Walk me through a CI/CD pipeline you'd set up for a web app, from a git push to production."),
            _q(2, "technical_skill", "What problem do containers solve, and when would you not use them?"),
            _q(3, "technical_skill", "How would you store passwords and API keys for an application so they never end up in the code repository?"),
            _q(4, "communication", "How would you explain to developers why they now need to write a health check for their service?"),
            _q(5, "communication", "Describe how you'd run communication during a production outage that's affecting customers."),
            _q(6, "communication", "Tell me about a time you had to convince a team to change how they deploy. How did you do it?"),
            _q(7, "problem_solving", "The site is suddenly returning errors to half the users. What do you check first, second and third?"),
            _q(8, "problem_solving", "Your cloud bill doubled this month. How would you find out why?"),
            _q(9, "problem_solving", "A deployment went wrong and you need to roll back fast. How do you design things so that's always possible?"),
            _q(10, "job_fit", "Tell me about a piece of manual work you automated. What difference did it make?"),
            _q(11, "job_fit", "What's the most stressful incident you've been part of, and what did you learn from it?"),
            _q(12, "job_fit", "Which cloud platforms and tools have you used for real projects?"),
        ],
    },
    {
        "title": "Data Analyst",
        "technical_skill": {
            "label": "Technical skill",
            "description": "Correct data skills: SQL, cleaning data, statistics and visualisation.",
            "anchors": _anchors(
                "No data concepts; cannot describe how they'd answer a question with data.",
                "Knows terms (SQL, dashboard, average) but not how to use them correctly.",
                "Writes sensible queries, cleans data, and chooses reasonable charts.",
                "Explains method and pitfalls - joins, missing data, outliers, sampling - with real analyses.",
                "Weighs trade-offs and failure modes (misleading metrics, correlation vs causation, biased samples) and validates their own results.",
            ),
        },
        "job_fit": {
            "label": "Job fit",
            "description": "Suited to a data analyst role: curiosity and business impact.",
            "anchors": _anchors(
                "No relevant data experience or interest.",
                "Some spreadsheet work, but no real analysis.",
                "Has done real analyses with SQL or similar tools for coursework or projects.",
                "Has delivered analyses that informed real decisions and presented them to stakeholders.",
                "Strong analyst profile: asks the right questions, drives decisions with data, and communicates uncertainty honestly.",
            ),
        },
        "questions": [
            _q(1, "technical_skill", "How would you find the top ten customers by revenue last month? Talk me through the query in words."),
            _q(2, "technical_skill", "You receive a spreadsheet with missing values, duplicates and odd dates. How do you clean it before analysing?"),
            _q(3, "technical_skill", "When would an average be misleading, and what would you report instead?"),
            _q(4, "communication", "How would you present a finding to managers who have no background in statistics?"),
            _q(5, "communication", "Your analysis shows something the manager doesn't want to hear. How do you handle that meeting?"),
            _q(6, "communication", "Explain the difference between correlation and causation using an everyday example."),
            _q(7, "problem_solving", "Sales dropped twenty percent last week. How would you investigate why?"),
            _q(8, "problem_solving", "Two dashboards show different numbers for the same metric. How would you work out which is right?"),
            _q(9, "problem_solving", "How would you measure whether a new website feature actually improved anything?"),
            _q(10, "job_fit", "Tell me about an analysis you did that changed someone's decision."),
            _q(11, "job_fit", "Which data tools are you most comfortable with, and what have you built with them?"),
            _q(12, "job_fit", "What kind of business questions do you most enjoy answering with data?"),
        ],
    },
]
