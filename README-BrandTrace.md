# BrandTrace — AI-Powered Brand Governance Platform

**Keep Every Word On Brand.**

BrandTrace is an AI-assisted brand governance platform that helps organizations review marketing and other business content against organization-specific brand guidelines. It analyzes submitted content, identifies potential compliance issues, explains findings, and suggests corrections. A human reviewer remains in control of review and approval decisions.

> **Project status:** Hackathon project. Feature availability and behavior should be verified against the deployed environment before relying on this README as a production specification.

## Contents

- [Problem](#1-problem)
- [Solution](#2-solution)
- [Key capabilities](#3-key-capabilities)
- [Technology stack](#4-technology-stack)
- [Architecture](#5-project-architecture)
- [Repository structure](#6-repository-structure)
- [How the workflow works](#7-user-workflow)
- [Local setup](#8-local-setup)
- [Environment variables](#9-environment-variables)
- [Demo account](#10-demo-account)
- [API overview](#11-api-overview)
- [Data and storage](#12-data-and-storage)
- [Security notes](#13-security-notes)
- [Team](#14-team)

## 1. Problem

Organizations communicate across websites, advertisements, documents, email, and social media. Keeping every message consistent with brand tone, approved terminology, and verified product information can be difficult when reviews are manual and distributed across teams.

Common challenges include:

- Inconsistent brand tone and language.
- Restricted or unapproved terminology.
- Claims that conflict with approved product facts.
- Repeated manual review effort.
- Limited visibility into review outcomes and recurring issues.

## 2. Solution

BrandTrace brings brand guidelines and content review into one workflow. Users can manage organization-specific guidance, submit content for analysis, inspect findings and suggested corrections, request rewritten content, and record review decisions.

AI-generated results are recommendations. Human reviewers retain responsibility for accepting or rejecting them.

## 3. Key capabilities

### Brand guideline management

- Maintain organization-specific brand guidance.
- Manage approved terminology and facts.
- Identify restricted words and expressions.
- Upload and process PDF guideline documents where supported by the configured guideline-processing workflow.

### AI-assisted content analysis

- Compare submitted content with relevant saved guidelines.
- Identify potential terminology, tone, and factual-claim violations.
- Present evidence, explanations, severity, and suggested corrections.
- Use semantic analysis so that a potential conflict can be identified even when the wording differs from the guideline.

### AI-assisted rewriting

- Generate a revised version based on selected findings and supplied guidelines.
- Aim to preserve the original meaning and unrelated content.
- Return explanations of proposed changes for human review.

### Review and approval

- Keep review records and history.
- Support review decisions, including approval and rejection.
- Support decisions on individual suggestions where available in the interface and API.

### Analytics

- Provide organization-level review and compliance information.
- Expose category, severity, and trend data through analytics routes.

The exact data displayed depends on the review history available in the configured database.

## 4. Technology stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Python, Flask |
| Database layer | Flask-SQLAlchemy |
| Database | SQLite by default; connection can be configured through `DATABASE_URL` |
| AI integration | Groq API |
| Authentication | Flask-JWT-Extended (JWT) |
| API | REST-style Flask routes |
| PDF processing | PyMuPDF |
| Database migrations | Flask-Migrate |

## 5. Project architecture

At a high level, the application follows this flow:

```text
Browser / Frontend
       |
       | HTTP requests (JSON + JWT where required)
       v
Flask application and API routes
       |
       +------ Authentication and organization access checks
       |
       +------ Guideline processing and retrieval
       |
       +------ AI analysis service --------> Groq API
       |
       +------ Rewriting service ----------> Groq API
       |
       +------ Review, approval, history and analytics
       |
       v
SQLAlchemy data layer
       |
       v
Configured database (SQLite by default)
```

## 6. Repository structure

The following is a representative overview of the project. Some generated, migration, and support files are omitted for readability.

```text
BrandTrace/
├── backend/
│   ├── app.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── routes/
│   │   ├── auth.py
│   │   ├── review.py
│   │   ├── guidelines.py
│   │   ├── organisations.py
│   │   ├── history.py
│   │   ├── approvals.py
│   │   ├── rewriting.py
│   │   └── analytics.py
│   ├── services/
│   │   ├── access_control.py
│   │   ├── ai_analyzer.py
│   │   ├── bootstrap.py
│   │   ├── guideline_pipeline.py
│   │   ├── guideline_processor.py
│   │   ├── guideline_retriever.py
│   │   ├── pdf_extractor.py
│   │   ├── rag_engine.py
│   │   └── rewriting_service.py
│   └── tests/
├── frontend/
│   ├── index.html
│   ├── auth.html
│   ├── dashboard.html
│   ├── content_analysis.html
│   ├── guidelines.html
│   ├── approvals.html
│   ├── history.html
│   ├── analytics.html
│   ├── settings.html
│   ├── about.html
│   ├── css/
│   └── js/
├── migrations/
├── requirements.txt
├── Procfile
├── API_CONTRACT.md
├── .env.example
├── .gitignore
└── README.md
```

## 7. User workflow

1. **Sign in** to the configured BrandTrace environment.
2. **Select or access an organization** for which the user has permission.
3. **Manage brand guidelines**, including approved facts and terminology.
4. **Submit content** for analysis.
5. **Inspect findings**, including evidence, explanations, severity, and suggested corrections.
6. **Request a rewrite** for selected findings, where the feature is enabled.
7. **Review the proposed changes** and decide whether to approve or reject them.
8. **Review history and analytics** to understand previous reviews and recurring compliance issues.

## 8. Local setup

### Prerequisites

- Python 3.10 or later.
- Git.
- A Groq API key for AI-powered analysis and rewriting.
- A code editor such as Visual Studio Code (recommended).

### Step 1 — Clone the repository

```bash
git clone https://github.com/alok-kumar09/BrandTrace.git
cd BrandTrace
```

If the team is developing on a branch other than the repository default, switch to the intended branch before running the application:

```bash
git switch <branch-name>
```

### Step 2 — Create and activate a virtual environment

**Windows (PowerShell):**

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

**Windows (Command Prompt):**

```bat
python -m venv .venv
.venv\Scripts\activate
```

**macOS / Linux:**

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Step 3 — Install dependencies

```bash
pip install -r requirements.txt
```

### Step 4 — Configure environment variables

Create a `.env` file in the repository root. Add the values required by your local configuration, for example:

```dotenv
GROQ_API_KEY=your_groq_api_key
SECRET_KEY=replace_with_a_long_random_secret
JWT_SECRET_KEY=replace_with_another_long_random_secret
```

Use separate, strong values for the secret keys. The application can use a default local database configuration; set `DATABASE_URL` only if you intend to use a different database.

**Never commit `.env` or real API keys/secrets to GitHub.** Use `.env.example` for placeholder names and values only.

### Step 5 — Start the backend

From the repository root:

```bash
python -m backend.app
```

The development server is configured to listen on:

```text
http://127.0.0.1:5000
```

### Step 6 — Open the application

The Flask application is configured to serve the frontend from its static folder. Open:

```text
http://127.0.0.1:5000/
```

If you use a separate frontend development server instead, make sure its API base URL points to the backend you are running.

## 9. Environment variables

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Enables calls to the Groq API for AI analysis and rewriting. |
| `SECRET_KEY` | Flask application secret. Set a strong private value. |
| `JWT_SECRET_KEY` | Signs JWT access tokens. Set a strong private value distinct from `SECRET_KEY`. |
| `DATABASE_URL` | Optional database connection override. If omitted, the application configuration uses its default SQLite database location. |
| `PORT` | Port used by the application host; commonly supplied by the deployment platform. |

The exact environment required can vary by deployment configuration. Configure secrets in the hosting provider's environment-variable settings, not in source code.

## 10. Demo account

A demonstration account may be created by the application's bootstrap process in a configured demo environment.

Use demo credentials only if they have been confirmed for the environment being demonstrated. Do not assume that local demo credentials work on a separately deployed instance. Do not publish private or production credentials in this repository.

## 11. API overview

The backend exposes JSON API routes under the `/api` prefix. The following route families are present in the project:

| Area | Route family / example | Purpose |
|---|---|---|
| Health | `GET /api/health` | Backend health check |
| Authentication | `/api/auth/...` | Registration, login, and current-user information |
| Analysis | `POST /api/analyze` | Analyze submitted content |
| Guidelines | `/api/...` | Retrieve and manage organization guidelines |
| Organizations | `/api/organisations/...` | Organization information and management |
| History | `/api/...` | Retrieve review history |
| Approvals | `/api/...` | Record review or suggestion decisions |
| Rewriting | `POST /api/rewrite` | Generate revised content |
| Analytics | `/api/...` | Retrieve compliance metrics and breakdowns |

For exact route paths, HTTP methods, request bodies, and response formats, consult the route modules in `backend/routes/` and `API_CONTRACT.md`. Protected endpoints require a valid JWT and the appropriate organization access.

## 12. Data and storage

BrandTrace uses SQLAlchemy models and is configured to use SQLite by default. Application data can include:

- Users and organization membership.
- Organization-specific guidelines and approved information.
- Content reviews and detected findings.
- Review and approval decisions.
- Data used by the analytics views.

The default SQLite database is stored in the application instance directory locally. Deployment environments may use a different configured database path or `DATABASE_URL`.

**Deployment note:** A local SQLite file on an ephemeral hosting filesystem may not survive service restarts or redeployments. Use persistent storage or a managed database if data must be retained reliably.

## 13. Security notes

- Keep API keys and secret values in environment variables.
- Do not commit `.env`, database files, access tokens, or private credentials.
- Use JWT authentication for protected API operations.
- Enforce organization-level authorization on organization-specific data.
- Treat AI findings and rewrites as suggestions that require human review.
- Verify access-control behavior with separate test users and organizations before production use.

## 14. Team

**Project:** BrandTrace — AI-Powered Brand Governance Platform  
**Hackathon:** CodeNexus

Development and delivery areas include:

- Frontend development.
- Backend and API development.
- AI analysis and rewriting integration.
- Database and organization management.
- Product validation, quality assurance, presentation, and documentation.

Add the final team member names and their verified contributions here before the final submission.

---

## Conclusion

BrandTrace combines organization-specific brand guidelines, AI-assisted content analysis, rewriting suggestions, review workflows, and compliance analytics in one platform. Its goal is to help teams maintain consistent brand communication while keeping human reviewers involved in important decisions.

**BrandTrace — Keep Every Word On Brand.**
