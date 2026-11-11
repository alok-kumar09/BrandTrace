# BrandTrace API Contract & Specification

**Version:** 2.0.0 (Round 3 Feature Expansion)  
**Target Deadline:** November 13, 2026 – 12:00 PM  
**Architecture:** Flask (Python) Backend + Vanilla JS Frontend  
**Database:** SQLite / PostgreSQL (SQLAlchemy ORM)  

---

## 1. Overview & System Architecture

BrandTrace is an AI-powered Brand Governance Platform enabling organizations to enforce brand guidelines, analyze content compliance, execute semantic rewrites, and track historical brand health metrics.

### 1.1 Architecture & Security Baseline
- **Authentication:** JWT Bearer tokens passed via the `Authorization: Bearer <token>` header (`Flask-JWT-Extended`).
- **Multi-Tenancy & Authorization:**
  - **`organisation_member_required`**: Requires JWT identity to be a registered member of the target `organisation_id` (`Owner`, `Admin`, or `Member`).
  - **`organisation_admin_required`**: Requires JWT identity to have `Owner` or `Admin` role within the specified `organisation_id`.
- **Database Persistence Model:**
  - Standard models: `User`, `Organisation`, `OrganisationMember`, `BrandGuideline`, `ReviewHistory`.
  - Storage format for complex arrays/objects within SQLite/Postgres: JSON strings (`db.Text`).

---

## 2. Identified Frontend vs Backend Inconsistencies

During code analysis of the existing baseline, the following discrepancies were identified between frontend expectations (`js/api.js`, `js/app.js`, `js/history.js`, `js/settings.js`) and backend handlers (`backend/routes/*`):

| Area | Frontend Implementation / Expectation | Backend Implementation | Impact & Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Review Decisions** | Sends `{ organisation_id, approval_status }` or `status` to `PUT /api/approvals/<id>`. | Accepts `approval_status` or `status`, updates `overall_status` to `"Approved"` or `"Rejected"`. | **Compatible**: Backend already maps both formats. |
| **Org Settings Update** | Sends `{ org_name, industry, website, contact }` to `PUT /api/organisations/<id>`. | Reads `org_name` (maps to `name`), `industry`, `website`, `contact` (maps to `governance_contact`). | **Compatible**: Routes are aligned. |
| **Guidelines Retrieval** | Expects `approved_facts` as a JSON dictionary (`{ "subject": "fact" }`). | Stores `approved_facts` as a stringified JSON dictionary. | **Compatible**: Synchronized. |
| **Analysis Issue Schema** | Expects `issues` array with items: `{ id, category, severity, original_text, explanation, suggestion }`. | `analyzer.py` returns `{ type, severity, message, evidence }`. `review.py` adapts `analyzer.py` output to frontend format prior to DB persistence. | **Modified in Round 3**: Upgraded to include character offsets and stable rule IDs. |
| **Dashboard Metrics** | Fronted checks for `"Approved"`, `"Rejected"`, `"Needs Review"`, `"Passed Initial Checks"`. | `GET /api/organisations/<id>/dashboard` counts `Pending`, `Approved`, `Rejected`. | **Modified in Round 3**: Updated dashboard and analytics endpoints to normalize status values across system. |

---

## 3. Database Schema Changes & Migrations Required

To support Round 3 features without breaking existing APIs, the existing models are extended and two new lightweight tables are added.

```
+-----------------------------------------------------------------------------------+
|                                  EXISTING MODELS                                  |
+--------------------------+--------------------------+-----------------------------+
|        User              |       Organisation       |     OrganisationMember      |
| - id (PK)                | - id (PK)                | - id (PK)                   |
| - name                   | - name                   | - user_id (FK)              |
| - email (Unique)         | - industry               | - organisation_id (FK)      |
| - password_hash          | - website                | - role (Owner/Admin/Member) |
| - created_at             | - governance_contact     | - created_at                |
|                          | - created_at             |                             |
+--------------------------+--------------------------+-----------------------------+
|      BrandGuideline      |      ReviewHistory       |                             |
| - id (PK)                | - id (PK)                |                             |
| - organisation_id (FK)   | - organisation_id (FK)   |                             |
| - tone                   | - submitted_content      |                             |
| - restricted_words       | - issues                 |                             |
| - approved_terms         | - suggestions            |                             |
| - approved_facts         | - overall_status         |                             |
| - created_at             | - created_at             |                             |
+--------------------------+--------------------------+-----------------------------+
                                       |
                                       | (Extended / New for Round 3)
                                       v
+-----------------------------------------------------------------------------------+
|                            NEW & EXTENDED DB SCHEMA                               |
+-----------------------------------------------------------------------------------+
| Extended: ReviewHistory                                                           |
| - user_id (FK users.id, nullable=True)                      [NEW]                 |
| - semantic_score (Float 0.0 - 100.0, default=100.0)         [NEW]                 |
| - character_count (Integer, default=0)                      [NEW]                 |
+-----------------------------------------------------------------------------------+
| NEW TABLE: ContentSuggestions                                                     |
| - id (String PK, UUID/slug e.g., "sug_8f9a2b1c")                                  |
| - review_id (Integer FK review_history.id, nullable=False)                        |
| - original_text (Text, nullable=False)                                            |
| - replacement_text (Text, nullable=False)                                         |
| - start_offset (Integer, nullable=False)                                          |
| - end_offset (Integer, nullable=False)                                            |
| - status (String(20), default="pending") -- ['pending', 'accepted', 'rejected']  |
| - created_at (DateTime)                                                           |
+-----------------------------------------------------------------------------------+
| NEW TABLE: RuleViolationsLog                                                      |
| - id (Integer PK)                                                                 |
| - organisation_id (Integer FK organisations.id)                                   |
| - review_id (Integer FK review_history.id)                                        |
| - category (String(50)) -- Terminology, Fact Verification, Tone, Style, Legal     |
| - severity (String(20)) -- high, medium, low                                      |
| - matched_rule (Text)                                                             |
| - created_at (DateTime)                                                           |
+-----------------------------------------------------------------------------------+
```

---

## 4. API Endpoints Reference Inventory

| Category | Endpoint | Method | Status | Auth Required | Admin Required | Persistence Type |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Auth** | `/api/auth/register` | `POST` | EXISTING | None | No | DB Write |
| **Auth** | `/api/auth/login` | `POST` | EXISTING | None | No | DB Read |
| **Auth** | `/api/auth/me` | `GET` | EXISTING | JWT | No | DB Read |
| **Guidelines** | `/api/guidelines/<org_id>` | `GET` | EXISTING | JWT | No | DB Read |
| **Guidelines** | `/api/guidelines/<org_id>` | `PUT` | EXISTING | JWT | **Yes** | DB Write |
| **Organisations**| `/api/organisations` | `POST` | EXISTING | JWT | No | DB Write |
| **Organisations**| `/api/organisations/<org_id>` | `GET` | EXISTING | JWT | No | DB Read |
| **Organisations**| `/api/organisations/<org_id>` | `PUT` | EXISTING | JWT | **Yes** | DB Write |
| **Organisations**| `/api/organisations/<org_id>/dashboard` | `GET` | EXISTING | JWT | No | DB Read |
| **Organisations**| `/api/organisations/<org_id>/members` | `POST` | EXISTING | JWT | **Yes** | DB Write |
| **History** | `/api/history/<org_id>` | `GET` | EXISTING | JWT | No | DB Read |
| **History** | `/api/organisations/<org_id>/history` | `GET` | EXISTING | JWT | No | DB Read |
| **Approvals** | `/api/approvals/<review_id>` | `PUT` | EXISTING | JWT | **Yes** | DB Write |
| **Compliance** | `/api/analyze` | `POST` | MODIFIED | JWT | No | DB Write |
| **Rewriting** | `/api/rewrite/suggestions` | `POST` | **NEW (B)**| JWT | No | DB Write / Computational |
| **Rewriting** | `/api/rewrite/suggestions/<id>/decision`| `PATCH`| **NEW (B)**| JWT | No | DB Write |
| **Rewriting** | `/api/rewrite/apply` | `POST` | **NEW (B)**| JWT | No | DB Write / Computational |
| **Analytics** | `/api/analytics/<org_id>` | `GET` | **NEW (C)**| JWT | No | Computational / DB Read |

---

## 5. Standardized Error Response Format

All APIs adhere to a consistent error schema.

```json
{
  "error": "Short human-readable summary of the error",
  "detail": "Detailed technical or validation information (optional)",
  "code": "STANDARD_ERROR_CODE"
}
```

### HTTP Status Code Map
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Payload missing, invalid JSON, or field validation error.
- `401 Unauthorized`: Token missing, invalid, or expired.
- `403 Forbidden`: User lacks membership or admin privileges for the specified organization.
- `404 Not Found`: Target entity (Organization, Review, Suggestion, Guideline) missing.
- `409 Conflict`: Resource already exists (e.g., duplicate user email or membership).
- `500 Internal Server Error`: Unhandled database or backend exception.
- `503 Service Unavailable`: LLM / External AI Service unavailable or missing module.

---

## 6. Detailed API Specifications

### 6.1 Feature Group: Existing Core APIs

#### 6.1.1 Authentication & User Session

##### `POST /api/auth/register`
- **Description:** Registers a new user account. Automatically creates an `Owner` role if registering for a new organization or `Member` role for default Org #1.
- **Auth:** None.
- **Request Body:**
```json
{
  "name": "Alex Mercer",
  "email": "alex@example.com",
  "password": "SecurePassword123!"
}
```
- **Response (201 Created):**
```json
{
  "message": "User registered successfully",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR...",
  "user": {
    "id": 4,
    "name": "Alex Mercer",
    "email": "alex@example.com",
    "role": "Owner",
    "organisation_id": 1,
    "organisation_name": "NovaTech Devices"
  }
}
```

##### `POST /api/auth/login`
- **Description:** Authenticates credentials and returns a JWT access token.
- **Auth:** None.
- **Request Body:**
```json
{
  "email": "admin@brandtrace.demo",
  "password": "Demo@12345"
}
```
- **Response (200 OK):**
```json
{
  "message": "Login successful",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR...",
  "user": {
    "id": 1,
    "name": "Demo Admin",
    "email": "admin@brandtrace.demo",
    "role": "Owner",
    "organisation_id": 1,
    "organisation_name": "NovaTech Devices"
  }
}
```

##### `GET /api/auth/me`
- **Description:** Returns the active authenticated user's session profile.
- **Auth:** Bearer JWT required.
- **Response (200 OK):**
```json
{
  "id": 1,
  "name": "Demo Admin",
  "email": "admin@brandtrace.demo",
  "role": "Owner",
  "organisation_id": 1,
  "organisation_name": "NovaTech Devices"
}
```

---

#### 6.1.2 Guidelines Management

##### `GET /api/guidelines/<int:organisation_id>`
- **Description:** Fetches active brand guidelines for an organization.
- **Auth:** Bearer JWT + `organisation_member_required`.
- **Response (200 OK):**
```json
{
  "organisation_id": 1,
  "tone": "Confident, clear and customer-friendly. Avoid superlatives and unverifiable claims.",
  "restricted_words": ["Cheapest", "Best in class", "Guaranteed"],
  "approved_terms": ["NovaBook Pro", "OLED Display"],
  "approved_facts": {
    "NovaBook Pro battery life": "Up to 12 hours",
    "NovaBook Pro display": "14-inch 2.8K OLED",
    "NovaBook Pro weight": "1.3 kg"
  }
}
```

##### `PUT /api/guidelines/<int:organisation_id>`
- **Description:** Creates or updates brand guidelines for an organization.
- **Auth:** Bearer JWT + `organisation_admin_required`.
- **Request Body:**
```json
{
  "tone": "Professional, informative, empathetic.",
  "restricted_words": ["Cheapest", "Best in class", "Guaranteed", "Unmatched"],
  "approved_terms": ["NovaBook Pro", "EcoGlide"],
  "approved_facts": {
    "NovaBook Pro battery life": "Up to 12 hours",
    "Warranty Period": "2 years limited"
  }
}
```
- **Response (200 OK):**
```json
{
  "message": "Guidelines saved successfully",
  "organisation_id": 1
}
```

---

#### 6.1.3 Organization & Team Management

##### `POST /api/organisations`
- **Description:** Creates a new organization entity and sets caller as `Owner`.
- **Auth:** Bearer JWT required.
- **Request Body:**
```json
{
  "name": "Apex Cybernetics"
}
```
- **Response (201 Created):**
```json
{
  "message": "Organisation registered successfully",
  "organisation": {
    "id": 2,
    "name": "Apex Cybernetics",
    "role": "Owner"
  }
}
```

##### `GET /api/organisations/<int:organisation_id>`
- **Description:** Retrieves organization profile details and list of members.
- **Auth:** Bearer JWT + `organisation_member_required`.
- **Response (200 OK):**
```json
{
  "id": 1,
  "name": "NovaTech Devices",
  "industry": "Consumer Electronics",
  "website": "https://novatech.demo",
  "governance_contact": "compliance@novatech.demo",
  "members": [
    {
      "user_id": 1,
      "name": "Demo Admin",
      "email": "admin@brandtrace.demo",
      "role": "Owner",
      "created_at": "2026-11-01T08:00:00Z"
    }
  ],
  "created_at": "2026-11-01T08:00:00Z"
}
```

##### `PUT /api/organisations/<int:organisation_id>`
- **Description:** Updates metadata fields for an organization.
- **Auth:** Bearer JWT + `organisation_admin_required`.
- **Request Body:**
```json
{
  "org_name": "NovaTech Devices International",
  "industry": "Hardware & Electronics",
  "website": "https://novatech.com",
  "contact": "lead-governance@novatech.com"
}
```
- **Response (200 OK):**
```json
{
  "message": "Organisation updated successfully",
  "organisation": {
    "id": 1,
    "name": "NovaTech Devices International",
    "industry": "Hardware & Electronics",
    "website": "https://novatech.com",
    "governance_contact": "lead-governance@novatech.com"
  }
}
```

##### `POST /api/organisations/<int:organisation_id>/members`
- **Description:** Adds an existing registered user to an organization with `Member` role.
- **Auth:** Bearer JWT + `organisation_admin_required`.
- **Request Body:**
```json
{
  "email": "reviewer@novatech.demo"
}
```
- **Response (201 Created):**
```json
{
  "message": "User added successfully",
  "member": {
    "user_id": 5,
    "name": "Jane Reviewer",
    "email": "reviewer@novatech.demo",
    "role": "Member"
  }
}
```

---

#### 6.1.4 History & Approval Workflow

##### `GET /api/history/<int:organisation_id>` & `GET /api/organisations/<int:organisation_id>/history`
- **Description:** Retrieves past content compliance reviews.
- **Auth:** Bearer JWT + `organisation_member_required`.
- **Response (200 OK):**
```json
{
  "organisation_id": 1,
  "total": 1,
  "reviews": [
    {
      "id": 101,
      "review_id": 101,
      "submitted_content": "The NovaBook Pro is the cheapest laptop with guaranteed 20 hours battery life.",
      "issues": [
        {
          "id": 1,
          "category": "Terminology",
          "severity": "high",
          "original_text": "cheapest",
          "explanation": "Restricted phrase detected: 'cheapest'",
          "suggestion": "Use an approved, verifiable statement."
        }
      ],
      "suggestions": [
        {
          "original": "cheapest",
          "replacement": "Use an approved, verifiable statement."
        }
      ],
      "overall_status": "Needs Review",
      "created_at": "2026-11-06T14:30:00Z"
    }
  ],
  "history": [...]
}
```

##### `PUT /api/approvals/<int:review_id>`
- **Description:** Updates the governance approval state of a reviewed draft (`Approved` or `Rejected`).
- **Auth:** Bearer JWT + `organisation_admin_required`.
- **Request Body:**
```json
{
  "organisation_id": 1,
  "approval_status": "approved"
}
```
- **Response (200 OK):**
```json
{
  "message": "Review decision saved successfully",
  "review_id": 101,
  "organisation_id": 1,
  "status": "Approved"
}
```

---

### 6.2 Feature Group A: AI-Powered Semantic Brand Compliance (MODIFIED & ENHANCED)

##### `POST /api/analyze`
- **Description:** Performs full semantic compliance analysis on submitted text against configured organization guidelines. Enhances existing rule matching with LLM semantic evaluation, exact character offset highlighting, rule reference linking, and database logging of rule violations.
- **Auth:** Bearer JWT + `organisation_member_required`.
- **Persistence:** Writes entry to `ReviewHistory` and populated records in `RuleViolationsLog`.
- **Request Body Schema:**
```json
{
  "organisation_id": 1,
  "content": "Our new NovaBook Pro is the cheapest laptop available, providing a guaranteed 20 hours of battery life."
}
```
- **Response Schema (200 OK):**
```json
{
  "review_id": 102,
  "organisation_id": 1,
  "overall_status": "Needs Review",
  "semantic_score": 62.5,
  "issues": [
    {
      "id": "iss-1",
      "category": "Terminology",
      "severity": "high",
      "original_text": "cheapest",
      "start_offset": 28,
      "end_offset": 36,
      "explanation": "Restricted word 'cheapest' detected. Claiming superlatives violates marketing governance rules.",
      "suggestion": "most competitive",
      "rule_reference": {
        "rule_type": "restricted_words",
        "matched_value": "Cheapest",
        "guideline_id": 1
      }
    },
    {
      "id": "iss-2",
      "category": "Fact Verification",
      "severity": "high",
      "original_text": "guaranteed 20 hours of battery life",
      "start_offset": 60,
      "end_offset": 95,
      "explanation": "Fact mismatch detected. Approved specification for 'NovaBook Pro battery life' is 'Up to 12 hours'.",
      "suggestion": "up to 12 hours of battery life",
      "rule_reference": {
        "rule_type": "approved_facts",
        "matched_value": "NovaBook Pro battery life: Up to 12 hours",
        "guideline_id": 1
      }
    }
  ],
  "suggestions": [
    {
      "id": "sug_01a2b3",
      "original": "cheapest",
      "replacement": "most competitive",
      "start_offset": 28,
      "end_offset": 36
    },
    {
      "id": "sug_04c5d6",
      "original": "guaranteed 20 hours of battery life",
      "replacement": "up to 12 hours of battery life",
      "start_offset": 60,
      "end_offset": 95
    }
  ]
}
```

---

### 6.3 Feature Group B: AI-Powered Content Rewriting (NEW)

##### `POST /api/rewrite/suggestions`
- **Description:** Generates guideline-compliant rewrites for identified compliance issues while preserving original content meaning. Produces discrete, tracking-enabled suggestions stored in database.
- **Auth:** Bearer JWT + `organisation_member_required`.
- **Persistence:** Creates records in `ContentSuggestions` table linked to `review_id`.
- **Request Body Schema:**
```json
{
  "organisation_id": 1,
  "review_id": 102,
  "instructions": "Make the tone extra executive and concise."
}
```
- **Response Schema (200 OK):**
```json
{
  "review_id": 102,
  "organisation_id": 1,
  "suggestions": [
    {
      "suggestion_id": "sug_8f9a2b1c",
      "issue_id": "iss-1",
      "original_text": "cheapest",
      "replacement_text": "most value-focused",
      "start_offset": 28,
      "end_offset": 36,
      "status": "pending",
      "explanation": "Replaces superlative claim with compliant value proposition phrasing."
    },
    {
      "suggestion_id": "sug_3e4f5a6b",
      "issue_id": "iss-2",
      "original_text": "guaranteed 20 hours of battery life",
      "replacement_text": "up to 12 hours of battery life",
      "start_offset": 60,
      "end_offset": 95,
      "status": "pending",
      "explanation": "Aligns battery specification with verified lab testing data."
    }
  ]
}
```

##### `PATCH /api/rewrite/suggestions/<string:suggestion_id>/decision`
- **Description:** Accept or reject an individual rewrite suggestion.
- **Auth:** Bearer JWT + `organisation_member_required`.
- **Persistence:** Updates status field (`accepted` or `rejected`) in `ContentSuggestions`.
- **Request Body Schema:**
```json
{
  "organisation_id": 1,
  "decision": "accepted"
}
```
- **Response Schema (200 OK):**
```json
{
  "message": "Suggestion status updated",
  "suggestion_id": "sug_8f9a2b1c",
  "status": "accepted"
}
```

##### `POST /api/rewrite/apply`
- **Description:** Applies all `accepted` suggestions to the original source text using character offset alignment and returns the synthesized final compliant text.
- **Auth:** Bearer JWT + `organisation_member_required`.
- **Persistence:** Updates `submitted_content` in `ReviewHistory` if `save_as_new_version` is `true`.
- **Request Body Schema:**
```json
{
  "organisation_id": 1,
  "review_id": 102,
  "save_as_new_version": false
}
```
- **Response Schema (200 OK):**
```json
{
  "review_id": 102,
  "original_content": "Our new NovaBook Pro is the cheapest laptop available, providing a guaranteed 20 hours of battery life.",
  "rewritten_content": "Our new NovaBook Pro is the most value-focused laptop available, providing up to 12 hours of battery life.",
  "applied_suggestions_count": 2,
  "remaining_issues_count": 0
}
```

---

### 6.4 Feature Group C: Brand Compliance Analytics (NEW)

##### `GET /api/analytics/<int:organisation_id>?timespan=30d`
- **Description:** Computes historical governance health analytics, compliance rates, category breakdowns, severity distribution, time series trends, recurring violations, and actionable governance recommendations.
- **Auth:** Bearer JWT + `organisation_member_required`.
- **Query Parameters:**
  - `timespan` (optional string: `7d`, `30d`, `90d`, `all`; default: `30d`).
- **Persistence:** Computational endpoint aggregating data from `ReviewHistory`, `RuleViolationsLog`, and `BrandGuideline`.
- **Response Schema (200 OK):**
```json
{
  "organisation_id": 1,
  "timespan": "30d",
  "summary": {
    "total_reviews": 48,
    "compliant_reviews": 32,
    "non_compliant_reviews": 16,
    "compliance_rate_percentage": 66.7,
    "total_violations_detected": 38,
    "average_semantic_score": 84.2
  },
  "category_breakdown": [
    { "category": "Terminology", "count": 18, "percentage": 47.4 },
    { "category": "Fact Verification", "count": 12, "percentage": 31.6 },
    { "category": "Tone", "count": 8, "percentage": 21.0 }
  ],
  "severity_distribution": {
    "high": 12,
    "medium": 18,
    "low": 8
  },
  "compliance_trends": [
    { "date": "2026-11-01", "total_reviews": 8, "compliance_rate": 62.5 },
    { "date": "2026-11-08", "total_reviews": 14, "compliance_rate": 78.5 }
  ],
  "recurring_violations": [
    {
      "matched_rule": "Cheapest",
      "category": "Terminology",
      "occurrences": 11,
      "recommendation": "Update marketing team collateral; replace 'Cheapest' with 'Most Cost-Effective'."
    },
    {
      "matched_rule": "NovaBook Pro battery life",
      "category": "Fact Verification",
      "occurrences": 7,
      "recommendation": "Distribute updated spec sheet regarding 12-hour maximum battery life."
    }
  ],
  "actionable_recommendations": [
    "High volume of terminology violations detected. Host refresher training on restricted words.",
    "Fact verification errors increased by 15% this week. Verify product spec sheet distribution."
  ]
}
```

---

## 7. Frontend to Backend Integration Mapping

| Frontend Page / Component | Action / Interaction | Target API Endpoint | HTTP Method |
| :--- | :--- | :--- | :--- |
| `auth.html` | Sign In | `/api/auth/login` | `POST` |
| `auth.html` | Register Account | `/api/auth/register` | `POST` |
| `content_analysis.html` | Click "Analyse Content" | `/api/analyze` | `POST` |
| `content_analysis.html` | Request AI Rewrite Suggestions | `/api/rewrite/suggestions` | `POST` |
| `content_analysis.html` | Accept/Reject Individual Edit | `/api/rewrite/suggestions/<id>/decision` | `PATCH` |
| `content_analysis.html` | Apply Accepted Suggestions | `/api/rewrite/apply` | `POST` |
| `guidelines.html` | Load Guidelines on Page Load | `/api/guidelines/<org_id>` | `GET` |
| `guidelines.html` | Save Updated Guidelines | `/api/guidelines/<org_id>` | `PUT` |
| `approvals.html` | Load Pending Reviews Queue | `/api/organisations/<org_id>/history` | `GET` |
| `approvals.html` | Approve / Reject Review | `/api/approvals/<review_id>` | `PUT` |
| `history.html` | Load Full Inspection Logs | `/api/organisations/<org_id>/history` | `GET` |
| `analytics.html` *(New)* | Load Governance Metrics Dashboard | `/api/analytics/<org_id>` | `GET` |
| `settings.html` | Save Org Details & Manage Members | `/api/organisations/<org_id>`, `/members` | `PUT`, `POST` |

---

## 8. Implementation Order & Dependencies

To guarantee submission readiness by **November 13, 12:00 PM**, the technical execution is partitioned into sequential phases:

```
[Phase 1: DB Migration & Rule Violations Logging] 
                        │
                        ▼
[Phase 2: Enhanced Analysis Engine - Feature A] ──> (POST /api/analyze)
                        │
                        ▼
[Phase 3: AI Rewrite Engine - Feature B] ─────────> (POST /api/rewrite/suggestions & apply)
                        │
                        ▼
[Phase 4: Analytics Aggregator - Feature C] ──────> (GET /api/analytics/<org_id>)
                        │
                        ▼
[Phase 5: Frontend UI Bindings & End-to-End Validation]
```

### Phase Details
1. **Phase 1: Database Migration**
   - Add missing columns to `ReviewHistory` (`user_id`, `semantic_score`, `character_count`).
   - Create tables `ContentSuggestions` and `RuleViolationsLog`.
2. **Phase 2: Semantic Analysis Engine Enhancement (Feature A)**
   - Upgrade `backend/services/analyzer.py` to calculate exact text character offsets (`start_offset`, `end_offset`).
   - Log individual infractions into `RuleViolationsLog` upon analysis execution.
3. **Phase 3: Content Rewriting Engine Implementation (Feature B)**
   - Implement `backend/routes/rewrite.py` blueprint with `/suggestions`, `/decision`, and `/apply`.
   - Build offset substitution logic to prevent overlapping text replacement corruption.
4. **Phase 4: Governance Analytics Pipeline (Feature C)**
   - Implement `backend/routes/analytics.py` blueprint.
   - Write optimized SQL queries joining `ReviewHistory` and `RuleViolationsLog` over time-window filters.
5. **Phase 5: E2E Verification & UI Polish**
   - Bind analytics and re-writer components in frontend JS. Verify all routes under mock and live server modes.

---

## 9. Unresolved Decisions & Explicit Assumptions

1. **LLM Provider Integration**:
   - *Assumption*: If external LLM API keys (e.g., OpenAI/Gemini) are not supplied in the hackathon runtime environment, `analyzer.py` and `rewrite.py` fall back to deterministic regex pattern matching and template-based rewriting rules without crashing.
2. **Character Offset Indexing**:
   - *Decision*: Offsets use zero-based UTF-8 Python string slice indices (`0`-based character count).
3. **Multi-User Draft Editing Concurrency**:
   - *Assumption*: For the hackathon scope, drafts are edited serially by a single author per session. Multi-user real-time lock-free editing is out of scope.
