const SampleData = (() => {
  const draft =
`Introducing the NovaBook Pro, the cheapest premium laptop on the market. 
With a battery that lasts 20 hours on a single charge, you can work from anywhere. 
Its stunning 14-inch OLED display and featherlight design make it perfect for creators.`;

  const response = {
    issues: [
      {
        id: "iss-1", category: "Restricted Word", severity: "high",
        original_text: "cheapest",
        explanation: "“Cheapest” is on the restricted list. Price-superlative claims are unverifiable and can create legal exposure.",
        suggestion: "most affordable",
      },
      {
        id: "iss-2", category: "Factual Mismatch", severity: "high",
        original_text: "20 hours",
        explanation: "The approved spec states battery life is “Up to 12 hours”. The draft overstates it by 8 hours.",
        suggestion: "up to 12 hours",
      },
      {
        id: "iss-3", category: "Tone Violation", severity: "low",
        original_text: "stunning",
        explanation: "Highly subjective adjectives drift from the confident-but-factual brand tone.",
        suggestion: "vivid",
      },
    ],
  };

  // Offline analysis: keep canned issues that appear in the text, plus any restricted words from guidelines.
  function mockAnalyze(content, guidelines) {
    const text = content.toLowerCase();
    const issues = response.issues.filter(i => text.includes(i.original_text.toLowerCase()));
    const seen = new Set(issues.map(i => i.original_text.toLowerCase()));
    (guidelines.restricted_words || []).forEach((w, n) => {
      if (w && text.includes(w.toLowerCase()) && !seen.has(w.toLowerCase())) {
        issues.push({
          id: "mock-rw-" + n, category: "Restricted Word", severity: "medium", original_text: w,
          explanation: `“${w}” is on your restricted words list.`,
          suggestion: "[rephrase without this term]",
        });
      }
    });
    return { issues: JSON.parse(JSON.stringify(issues)), source: "mock" };
  }
  return { draft, response, mockAnalyze };
})();
