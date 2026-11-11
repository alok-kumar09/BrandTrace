const SampleData = (() => {
  const draft =
`Our new NovaBook Pro is the cheapest laptop available, providing a guaranteed 20 hours of battery life.`;

  const analysisResponse = {
    review_id: 102,
    organisation_id: 1,
    overall_status: "Needs Review",
    semantic_score: 62.5,
    issues: [
      {
        id: "iss-1",
        category: "Terminology",
        severity: "high",
        original_text: "cheapest",
        start_offset: 28,
        end_offset: 36,
        explanation: "Restricted word 'cheapest' detected. Claiming superlatives violates marketing governance rules.",
        suggestion: "most competitive",
        rule_reference: {
          rule_type: "restricted_words",
          matched_value: "Cheapest",
          guideline_id: 1
        }
      },
      {
        id: "iss-2",
        category: "Fact Verification",
        severity: "high",
        original_text: "guaranteed 20 hours of battery life",
        start_offset: 60,
        end_offset: 95,
        explanation: "Fact mismatch detected. Approved specification for 'NovaBook Pro battery life' is 'Up to 12 hours'.",
        suggestion: "up to 12 hours of battery life",
        rule_reference: {
          rule_type: "approved_facts",
          matched_value: "NovaBook Pro battery life: Up to 12 hours",
          guideline_id: 1
        }
      }
    ],
    suggestions: [
      {
        id: "sug_01a2b3",
        original: "cheapest",
        replacement: "most competitive",
        start_offset: 28,
        end_offset: 36
      },
      {
        id: "sug_04c5d6",
        original: "guaranteed 20 hours of battery life",
        replacement: "up to 12 hours of battery life",
        start_offset: 60,
        end_offset: 95
      }
    ]
  };

  const rewriteSuggestionsResponse = {
    review_id: 102,
    organisation_id: 1,
    suggestions: [
      {
        suggestion_id: "sug_8f9a2b1c",
        issue_id: "iss-1",
        original_text: "cheapest",
        replacement_text: "most value-focused",
        start_offset: 28,
        end_offset: 36,
        status: "pending",
        explanation: "Replaces superlative claim with compliant value proposition phrasing."
      },
      {
        suggestion_id: "sug_3e4f5a6b",
        issue_id: "iss-2",
        original_text: "guaranteed 20 hours of battery life",
        replacement_text: "up to 12 hours of battery life",
        start_offset: 60,
        end_offset: 95,
        status: "pending",
        explanation: "Aligns battery specification with verified lab testing data."
      }
    ]
  };

  const analyticsResponse = {
    organisation_id: 1,
    timespan: "30d",
    summary: {
      total_reviews: 48,
      compliant_reviews: 32,
      non_compliant_reviews: 16,
      compliance_rate_percentage: 66.7,
      total_violations_detected: 38,
      average_semantic_score: 84.2
    },
    category_breakdown: [
      { category: "Terminology", count: 18, percentage: 47.4 },
      { category: "Fact Verification", count: 12, percentage: 31.6 },
      { category: "Tone", count: 8, percentage: 21.0 }
    ],
    severity_distribution: { high: 12, medium: 18, low: 8 },
    compliance_trends: [
      { date: "2026-11-01", total_reviews: 8, compliance_rate: 62.5 },
      { date: "2026-11-08", total_reviews: 14, compliance_rate: 78.5 }
    ],
    recurring_violations: [
      {
        matched_rule: "Cheapest",
        category: "Terminology",
        occurrences: 11,
        recommendation: "Update marketing team collateral; replace 'Cheapest' with 'Most Cost-Effective'."
      }
    ],
    actionable_recommendations: [
      "High volume of terminology violations detected. Host refresher training on restricted words."
    ]
  };

  function mockAnalyze(content, guidelines) {
    return JSON.parse(JSON.stringify(analysisResponse));
  }

  function mockRewrite(reviewId) {
    return JSON.parse(JSON.stringify(rewriteSuggestionsResponse));
  }

  function mockAnalytics(timespan) {
    return JSON.parse(JSON.stringify(analyticsResponse));
  }

  return { draft, analysisResponse, rewriteSuggestionsResponse, analyticsResponse, mockAnalyze, mockRewrite, mockAnalytics };
})();