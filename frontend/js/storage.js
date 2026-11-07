const Storage = (() => {
  const KEY = "brandtrace.guidelines.v1";
  const DEFAULTS = {
    tone: "Confident, clear and customer-friendly. Avoid superlatives and unverifiable claims.",
    restricted_words: ["Cheapest", "Best in class", "Guaranteed"],
    // Store approved facts as a key-value dictionary to match backend expectations
    approved_facts: {
      "NovaBook Pro battery life": "Up to 12 hours",
      "NovaBook Pro display": "14-inch 2.8K OLED",
      "NovaBook Pro weight": "1.3 kg"
    },
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULTS);
      const parsed = JSON.parse(raw);
      
      // Backward compatibility if older storage used an array for approved_specs
      if (Array.isArray(parsed.approved_specs)) {
        const convertedFacts = {};
        parsed.approved_specs.forEach(line => {
          const parts = line.split(":");
          if (parts.length >= 2) {
            convertedFacts[parts[0].trim()] = parts.slice(1).join(":").trim();
          } else if (line.trim()) {
            convertedFacts[line.trim()] = "Verified";
          }
        });
        parsed.approved_facts = convertedFacts;
        delete parsed.approved_specs;
      }

      return { ...DEFAULTS, ...parsed };
    } catch (e) { 
      return structuredClone(DEFAULTS); 
    }
  }

  function save(g) {
    try { localStorage.setItem(KEY, JSON.stringify(g)); } catch (e) {}
  }
  
  function reset() { 
    localStorage.removeItem(KEY); 
  }

  return { load, save, reset, DEFAULTS };
})();
