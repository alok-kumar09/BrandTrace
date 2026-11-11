# BrandTrace — API Contract
**Version:** 1.0 — Hackathon Round 3  
**Backend:** Flask + SQLAlchemy + JWT  
**Frontend:** Vanilla JavaScript  
**Status:** Existing APIs documented; new APIs proposed for implementation.

---

# 1. Contract conventions

## Base URL

Production:
```text
https://<your-pythonanywhere-domain>
```

Development:
```text
http://localhost:5000
```

All API paths are relative to the base URL.

## Authentication

Authenticated requests must include:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

Authentication uses Flask-JWT-Extended.

- Register and login are public.
- Most organization operations require membership.
- Guideline modifications require organization administrator privileges.
- Organization creation requires authentication.
- New endpoints must enforce organization membership and ownership server-side.

## Standard error format

```json
{
  "error": "Human-readable error message"
}
```

Some existing authentication errors also include:

```json
{
  "error": "Invalid session token. Please sign in again.",
  "detail": "Token validation details"
}
```

## HTTP status conventions

| Status | Meaning |
|---|---|
| 200 | Successful request |
| 201 | Resource created |
| 400 | Invalid request |
| 401 | Authentication required or invalid |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict |
| 422 | Validation failure, if introduced by an endpoint |
| 500 | Internal server error |
| 503 | AI service unavailable |

---

# 2. Existing APIs

These endpoints are already present in the supplied backend implementation unless explicitly marked for verification.

## 2.1 Health check

### GET `/api/health`

Authentication: Not required.

Response: 200

```json
{
  "status": "healthy",
  "application": "BrandTrace"
}
```

Purpose:
- Check backend availability.
- Used for deployment verification.

---

## 2.2 Authentication

### POST `/api/auth/register`

Authentication: Not required.

Request:

```json
{
  "name": "Aditya",
  "email": "aditya@example.com",
  "password": "password123"
}
```

Response: 201

```json
{
  "message": "User registered successfully",
  "access_token": "<jwt_token>",
  "user": {
    "id": 1,
    "name": "Aditya",
    "email": "aditya@example.com",
    "role": "Owner",
    "organisation_id": 1,
    "organisation_name": "Demo Organisation"
  }
}
```

Validation:
- Name is required.
- Valid email is required.
- Password must contain at least eight characters.
- Duplicate email returns 409.

Note: Current implementation assigns newly registered users to the default organization, ID 1. The first member becomes Owner; subsequent members become Members.

### POST `/api/auth/login`

Authentication: Not required.

Request:

```json
{
  "email": "aditya@example.com",
  "password": "password123"
}
```

Response: 200

```json
{
  "message": "Login successful",
  "access_token": "<jwt_token>",
  "user": {
    "id": 1,
    "name": "Aditya",
    "email": "aditya@example.com",
    "role": "Owner",
    "organisation_id": 1,
    "organisation_name": "Demo Organisation"
  }
}
```

Invalid credentials return 401.

### GET `/api/auth/me`

Authentication: Required.

Response: 200

```json
{
  "id": 1,
  "name": "Aditya",
  "email": "aditya@example.com",
  "role": "Owner",
  "organisation_id": 1,
  "organisation_name": "Demo Organisation"
}
```

Purpose:
- Retrieve the current authenticated user.
- Restore the frontend session.
- Retrieve the user's current organization membership.

---

## 2.3 Organization management

### POST `/api/organisations`

Authentication: Required.

Request:

```json
{
  "name": "Example Corporation"
}
```

Purpose:
- Create an organization.
- Assign the creator the Owner role.
- Create the organization membership.

Response fields and exact success status should be retained from the existing `backend/routes/organisations.py` implementation.

**Existing endpoint. Do not replace its implementation or response without checking the frontend dependencies.**

Additional organization listing, editing, membership management and deletion endpoints must be verified against the complete existing route file before being documented as existing.

---

## 2.4 Brand guidelines

### GET `/api/guidelines/{organisation_id}`

Authentication: Organization member required.

Example:

```http
GET /api/guidelines/1
```

Response: 200

```json
{
  "organisation_id": 1,
  "tone": "Professional and approachable",
  "restricted_words": [
    "guaranteed",
    "unlimited"
  ],
  "approved_terms": [
    "BrandTrace",
    "brand governance"
  ],
  "approved_facts": {
    "BrandTrace": "An AI-powered brand governance platform."
  }
}
```

Returns the latest saved guideline record for the organization.

If no guideline exists, returns 404.

### PUT `/api/guidelines/{organisation_id}`

Authentication: Organization administrator required.

Request:

```json
{
  "tone": "Professional and approachable",
  "restricted_words": [
    "guaranteed",
    "unlimited"
  ],
  "approved_terms": [
    "BrandTrace",
    "brand governance"
  ],
  "approved_facts": {
    "BrandTrace": "An AI-powered brand governance platform."
  }
}
```

Response: 200

```json
{
  "message": "Guidelines saved successfully",
  "organisation_id": 1
}
```

Behavior:
- Creates a guideline record if none exists.
- Updates the latest guideline record otherwise.
- Restricted words must be an array of strings.
- Approved terms must be an array of strings.
- Approved facts must be a string-to-string object.
- Tone is required.

---

## 2.5 Content analysis — existing implementation

### POST `/api/analyze`

Authentication: Organization member required.

Request:

```json
{
  "organisation_id": 1,
  "content": "Our product guarantees complete protection."
}
```

Response: 200

```json
{
  "review_id": 42,
  "organisation_id": 1,
  "issues": [
    {
      "id": 1,
      "category": "Terminology",
      "severity": "high",
      "original_text": "guarantees",
      "explanation": "Restricted phrase detected by brand guidelines.",
      "suggestion": "Use an approved, verifiable statement."
    }
  ],
  "suggestions": [
    {
      "original": "guarantees",
      "replacement": "Use an approved, verifiable statement."
    }
  ],
  "overall_status": "Needs Review"
}
```

The example above illustrates the response shape; actual explanations and issue content depend on the analyzer.

Existing behavior:
1. Validates organization ID and content.
2. Checks organization existence.
3. Retrieves the latest organization guideline.
4. Runs the existing rule-based `analyze_content()` function.
5. Converts issues into frontend-compatible objects.
6. Saves the review in `ReviewHistory`.
7. Returns the review ID and analysis results.

Existing limitations:
- Analysis is primarily keyword and approved-fact based.
- No semantic LLM analysis currently exists in the supplied implementation.
- No guaranteed exact character offsets are returned.
- Suggestions are generated by the existing rule-based analyzer.

### Modification required

Preserve this endpoint and its existing response fields.

Add semantic analysis capabilities without breaking existing consumers.

The updated response will be specified in Section 3.

---

## 2.6 Review history

### GET `/api/history/{organisation_id}`

Authentication: Organization member required.

Example:

```http
GET /api/history/1
```

### GET `/api/organisations/{organisation_id}/history`

This is an existing alias for the same history retrieval functionality.

Response: 200

```json
{
  "organisation_id": 1,
  "total": 1,
  "reviews": [
    {
      "id": 42,
      "review_id": 42,
      "submitted_content": "Our product guarantees complete protection.",
      "issues": [],
      "suggestions": [],
      "overall_status": "Needs Review",
      "created_at": "2026-11-11T10:00:00+00:00"
    }
  ],
  "history": []
}
```

Note: `history` contains the same review records as `reviews`; the example's empty array is illustrative only. Both fields should return the same data.

Behavior:
- Retrieves reviews belonging to the specified organization.
- Sorts by newest first.
- Parses stored JSON issues and suggestions.
- Returns the total number of reviews.

---

## 2.7 Approvals

The existing application registers an approvals blueprint.

The exact routes, HTTP methods, request fields, response fields and permission requirements must be verified against the complete `backend/routes/approvals.py` source before changing or documenting them as final.

**Integration rule:** Preserve the existing approval workflow. New rewriting functionality must not silently replace or interfere with existing approval decisions.

---

# 3. New APIs — Round 3 features

These are proposed contracts. They are not currently implemented in the supplied backend.

# Feature 1 — AI-Powered Semantic Brand Compliance

## 3.1 Updated content analysis

### POST `/api/analyze`

Authentication: Organization member required.

This extends the existing endpoint rather than creating an incompatible replacement.

Request:

```json
{
  "organisation_id": 1,
  "content": "Our product guarantees complete protection for every customer."
}
```

The organization ID must be checked against the authenticated user's actual membership.

### Expected processing pipeline

1. Retrieve organization guidelines.
2. Retrieve relevant guideline sections.
3. Analyze content using semantic understanding.
4. Detect violations based on meaning, not just keywords.
5. Identify relevant guideline references.
6. Determine violation severity.
7. Generate an explanation.
8. Calculate exact text positions.
9. Persist the analysis and its results.

### New response contract

Response: 200

```json
{
  "review_id": 42,
  "organisation_id": 1,
  "overall_status": "non_compliant",
  "compliance_score": 65,
  "issues": [
    {
      "id": "v1",
      "category": "Unsupported Claims",
      "severity": "high",
      "original_text": "guarantees complete protection",
      "start_index": 11,
      "end_index": 48,
      "guideline_id": 5,
      "guideline": "Avoid absolute or unsubstantiated claims.",
      "explanation": "The content makes an absolute protection guarantee without supporting evidence.",
      "suggestion": "Use a qualified statement that accurately describes the product's capabilities.",
      "confidence": 0.94,
      "detection_method": "semantic"
    }
  ],
  "suggestions": [],
  "analysis_metadata": {
    "engine": "hybrid",
    "guideline_count": 5
  }
}
```

### Issue object specification

| Field | Type | Description |
|---|---|---|
| id | string | Stable violation identifier |
| category | string | Violation category |
| severity | string | critical, high, medium, low |
| original_text | string | Exact problematic passage |
| start_index | integer | Inclusive character offset |
| end_index | integer | Exclusive character offset |
| guideline_id | integer/null | Associated guideline |
| guideline | string | Relevant guideline text |
| explanation | string | Reason for violation |
| suggestion | string | Suggested correction |
| confidence | number/null | Model confidence or calibrated confidence |
| detection_method | string | semantic, rule_based, hybrid |

Severity must be one of:

- `critical`
- `high`
- `medium`
- `low`

`start_index` and `end_index` must reference the original submitted content, using Python-compatible zero-based character offsets.

The frontend must not attempt to locate passages by searching for text alone.

### Overall status

Use:

- `compliant`
- `non_compliant`
- `needs_review`

Do not equate the confidence score with the compliance score.

### Compatibility requirement

Keep these existing response properties:

- `review_id`
- `organisation_id`
- `issues`
- `suggestions`
- `overall_status`

The meaning of `overall_status` will be normalized to the new status values. The frontend must be updated accordingly.

---

## 3.2 Guideline document upload

### POST `/api/guidelines/{organisation_id}/documents`

Authentication: Organization administrator required.

Content-Type:

```http
multipart/form-data
```

Form fields:

| Field | Type | Required |
|---|---|---|
| file | PDF | Yes |
| document_name | string | No |

Purpose:
- Upload organization brand guideline documents.
- Extract text from PDF.
- Parse guideline content.
- Prepare extracted sections for semantic retrieval.
- Associate the document with its organization.

Proposed response: 201

```json
{
  "success": true,
  "document": {
    "id": 12,
    "organisation_id": 1,
    "document_name": "Brand Guidelines.pdf",
    "status": "processed"
  },
  "message": "Guideline document processed successfully."
}
```

Possible document statuses:

- `uploaded`
- `processing`
- `processed`
- `failed`

Implementation requirements:
- Validate PDF type.
- Enforce upload size limits.
- Validate extracted text.
- Prevent cross-organization access.
- Handle extraction failures.
- Never expose internal storage paths.

---

# Feature 2 — AI-Powered Content Rewriting

## 3.3 Generate rewriting suggestions

### POST `/api/reviews/{review_id}/rewrite`

Authentication: Organization member required.

Request:

```json
{
  "violation_ids": [
    "v1",
    "v2"
  ],
  "content": "Our product guarantees complete protection for every customer."
}
```

`content` is the original submitted content and must match the content associated with the review.

If the field is omitted, the backend may use the stored original content.

### Processing

1. Retrieve the requested review.
2. Verify organization access.
3. Retrieve selected violations.
4. Retrieve their associated guidelines.
5. Generate context-aware corrections.
6. Preserve factual meaning.
7. Validate the generated response.
8. Return individual suggestions.

Response: 200

```json
{
  "review_id": 42,
  "suggestions": [
    {
      "id": "s1",
      "violation_id": "v1",
      "original_text": "guarantees complete protection",
      "revised_text": "helps provide comprehensive protection",
      "explanation": "Removes the absolute guarantee while retaining the intended message.",
      "guideline_id": 5,
      "status": "pending"
    }
  ]
}
```

### Suggestion object

| Field | Type | Description |
|---|---|---|
| id | string | Stable suggestion ID |
| violation_id | string | Associated violation |
| original_text | string | Original passage |
| revised_text | string | Proposed replacement |
| explanation | string | Reason for the revision |
| guideline_id | integer/null | Guideline used |
| status | string | pending, accepted, rejected |

Rules:
- Preserve the intended meaning.
- Do not invent product features or factual claims.
- Follow relevant terminology and tone.
- Generate only corrections for requested violations.
- Preserve unmodified text.

---

## 3.4 Accept or reject individual suggestions

### PATCH `/api/reviews/{review_id}/suggestions/{suggestion_id}`

Authentication: Organization member required.

Request — accept:

```json
{
  "status": "accepted"
}
```

Request — reject:

```json
{
  "status": "rejected"
}
```

Response: 200

```json
{
  "success": true,
  "review_id": 42,
  "suggestion_id": "s1",
  "status": "accepted"
}
```

Behavior:
- Update only the selected suggestion.
- Persist the decision.
- Prevent access to suggestions belonging to another organization.
- Do not automatically accept other suggestions.

---

## 3.5 Apply accepted suggestions

### POST `/api/reviews/{review_id}/apply-rewrites`

Authentication: Organization member required.

Request:

```json
{
  "accepted_suggestion_ids": [
    "s1",
    "s3"
  ]
}
```

Response: 200

```json
{
  "success": true,
  "review_id": 42,
  "original_content": "Our product guarantees complete protection for every customer.",
  "revised_content": "Our product helps provide comprehensive protection for every customer.",
  "applied_suggestion_ids": [
    "s1",
    "s3"
  ]
}
```

Rules:
- Only apply suggestions previously accepted.
- Preserve original content in review history.
- Do not overwrite the original submitted content.
- Apply replacements safely without corrupting overlapping text spans.
- Return the complete revised content.

The frontend can use the returned `revised_content` as its current working document.

---

# Feature 3 — Brand Compliance Analytics

## 3.6 Organization analytics overview

### GET `/api/analytics/{organisation_id}`

Authentication: Organization member required.

Optional query parameters:

| Parameter | Type | Default |
|---|---|---|
| period | string | 30d |
| start_date | date | null |
| end_date | date | null |

Supported periods:

- `7d`
- `30d`
- `90d`
- `all`

Example:

```http
GET /api/analytics/1?period=30d
```

### Response: 200

```json
{
  "organisation_id": 1,
  "period": "30d",
  "summary": {
    "total_reviews": 120,
    "compliant_reviews": 95,
    "non_compliant_reviews": 25,
    "compliance_rate": 79.17,
    "total_violations": 56
  },
  "severity_breakdown": {
    "critical": 3,
    "high": 12,
    "medium": 25,
    "low": 16
  },
  "category_breakdown": [
    {
      "category": "Unsupported Claims",
      "count": 22
    },
    {
      "category": "Tone Mismatch",
      "count": 18
    }
  ],
  "trends": [
    {
      "date": "2026-11-01",
      "total_reviews": 10,
      "compliance_rate": 80.0,
      "violation_count": 5
    }
  ]
}
```

All numerical values must be calculated from actual persisted review data.

---

## 3.7 Recurring violations

### GET `/api/analytics/{organisation_id}/recurring`

Authentication: Organization member required.

Optional parameters:

- `period`
- `limit`

Example:

```http
GET /api/analytics/1/recurring?period=30d&limit=10
```

Response: 200

```json
{
  "organisation_id": 1,
  "recurring_violations": [
    {
      "category": "Unsupported Claims",
      "count": 22,
      "percentage": 39.29,
      "most_violated_guideline": {
        "id": 5,
        "text": "Avoid absolute or unsubstantiated claims."
      }
    }
  ]
}
```

Purpose:
- Identify repeated compliance mistakes.
- Identify frequently violated guidelines.
- Help organizations understand their recurring problems.

---

## 3.8 Compliance recommendations

### GET `/api/analytics/{organisation_id}/recommendations`

Authentication: Organization member required.

Optional parameter:

- `period`

Response: 200

```json
{
  "organisation_id": 1,
  "recommendations": [
    {
      "id": "r1",
      "category": "Unsupported Claims",
      "priority": "high",
      "title": "Improve claim verification",
      "description": "Repeated unsupported claims have been detected.",
      "suggested_action": "Provide writers with examples of acceptable qualified claims.",
      "based_on_violation_count": 22
    }
  ]
}
```

Implementation:
- Derive recommendations from aggregated historical violations.
- Rule-based recommendations are sufficient for the MVP.
- AI may optionally generate more readable recommendations from the aggregated data.
- Never generate recommendations from fabricated statistics.

---

# 4. Database requirements

## Existing models

The current database contains:

### Organisation
- id
- name
- industry
- website
- governance_contact
- created_at

### BrandGuideline
- id
- organisation_id
- tone
- restricted_words
- approved_terms
- approved_facts
- created_at

### ReviewHistory
- id
- organisation_id
- submitted_content
- issues
- suggestions
- overall_status
- created_at

### User
- id
- name
- email
- password_hash
- created_at

### OrganisationMember
- id
- user_id
- organisation_id
- role
- created_at

## Proposed additions

These are logical requirements, not necessarily five new tables.

### GuidelineDocument

Recommended fields:
- id
- organisation_id
- document_name
- storage_reference
- extracted_text
- processing_status
- created_at

### GuidelineSection

Recommended fields:
- id
- document_id
- organisation_id
- section_text
- category
- embedding or retrieval metadata, if needed

### ReviewViolation

Optional normalized storage if violation-level queries become difficult with JSON fields.

Recommended fields:
- id
- review_id
- category
- severity
- original_text
- start_index
- end_index
- guideline_id
- explanation
- confidence
- detection_method

### RewriteSuggestion

Recommended fields:
- id
- review_id
- violation_id
- original_text
- revised_text
- explanation
- guideline_id
- status
- created_at

### Important database decision

For the hackathon, you can continue using JSON fields in `ReviewHistory.issues` and `ReviewHistory.suggestions` if that is faster and the analytics service can aggregate them reliably.

Do not introduce unnecessary migrations just to normalize everything.

However, document uploads and rewriting decisions must be persisted if those workflows are presented as completed features.

---

# 5. AI service responsibilities

The following service separation is recommended.

| Service | Responsibility |
|---|---|
| `pdf_extractor.py` | Extract text from PDF documents |
| `rag_engine.py` | Retrieve relevant guideline sections |
| `ai_analyzer.py` | Semantic compliance analysis |
| `rewriting_service.py` | Generate compliant alternatives |
| `analytics_service.py` | Historical aggregation and recommendations |

### Semantic analysis flow

```text
Submitted content
       |
       v
Retrieve organization guidelines
       |
       v
Retrieve relevant guideline sections
       |
       v
LLM semantic analysis
       |
       v
Validate structured response
       |
       v
Calculate/validate text offsets
       |
       v
Persist review and violations
       |
       v
Return analysis response
```

### Rewriting flow

```text
Review ID + Selected Violations
              |
              v
Retrieve original content
              |
              v
Retrieve associated guidelines
              |
              v
Generate corrections
              |
              v
Validate generated suggestions
              |
              v
Return individual suggestions
              |
              v
Accept / Reject
              |
              v
Apply accepted changes
```

### Analytics flow

```text
Review History
      |
      v
Filter by organization and period
      |
      v
Aggregate review and violation data
      |
      v
Calculate trends and recurring issues
      |
      v
Generate recommendations
      |
      v
Return analytics
```

---

# 6. API ownership and implementation allocation

| Endpoint / Group | Owner |
|---|---|
| Existing authentication APIs | Toshit — maintain |
| Existing organization APIs | Toshit — maintain |
| Existing guideline APIs | Toshit — maintain |
| Existing analysis API | Toshit — extend |
| Guideline document upload | Toshit |
| Semantic retrieval and analysis | Toshit |
| Rewrite generation | Toshit |
| Suggestion persistence and application | Toshit |
| Analytics endpoints | Toshit |
| Existing history and approvals | Toshit — maintain |
| All new frontend API integrations | Aditya |
| Violation visualization | Aditya |
| Rewrite interface | Aditya |
| Analytics interface | Aditya |
| API contract validation | Aditya + Toshit |
| Test scenarios and regression testing | Vivek |
| Demo validation and documentation | Alok |

---

# 7. Mandatory integration rules

1. All API responses must be JSON.
2. All authenticated frontend requests must send the JWT token.
3. Frontend must not contain LLM API keys.
4. Organization membership must be checked on the backend.
5. Organization ID supplied by the client must never be treated as proof of authorization.
6. Existing endpoint paths must not change without agreement.
7. Existing response fields must remain compatible unless both frontend and backend are updated together.
8. New endpoints must use the exact field names specified here.
9. All new analysis and rewriting operations must validate LLM output before returning it.
10. All analysis records must be associated with an organization.
11. Analytics must use real persisted data.
12. Accepted and rejected rewriting decisions must be persisted.
13. Failed AI operations must return meaningful errors and must not create misleading successful review records.
14. Backend must not expose internal exception traces or API credentials.
15. Every new endpoint must have at least one successful test and one failure/permission test.

---

# 8. Items requiring final verification

Before treating this document as a completely frozen contract, inspect the full current implementation of:

- `backend/routes/approvals.py`
- `backend/routes/organisations.py`
- `frontend/js/api.js`
- `frontend/js/approvals.js`
- `backend/services/access_control.py`

Verify:
- Existing approvals paths and payloads.
- All existing organization operations.
- Actual frontend request/response dependencies.
- Role-specific access restrictions.
- Whether any frontend calls rely on compatibility aliases.

Also verify the existing deployment's actual URL and the configured API base URL.

---

# 9. Contract freeze

**Existing API policy:** Preserve existing working behavior.

**New API policy:** Implement the new proposed contracts as written, unless both Aditya and Toshit explicitly agree to a change.

**Frontend owner:** Aditya.

**Backend owner:** Toshit.

**Integration owner:** Aditya + Toshit.

**Final objective:** All three new features must work with real organization-specific guidelines and persisted review data, without breaking authentication, approvals, history or existing content analysis.

**End of API Contract — BrandTrace Round 3.**