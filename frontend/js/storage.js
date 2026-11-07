const Storage = (() => {
  const KEY = "brandtrace.guidelines.v1";
  const DEFAULTS = {
    tone: "Confident, clear and customer-friendly. Avoid superlatives and unverifiable claims.",
    restricted_words: ["Cheapest", "Best in class", "Guaranteed"],
    approved_specs: [
      "NovaBook Pro battery life: Up to 12 hours",
      "NovaBook Pro display: 14-inch 2.8K OLED",
      "NovaBook Pro weight: 1.3 kg",
    ],
  };
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : structuredClone(DEFAULTS);
    } catch (e) { return structuredClone(DEFAULTS); }
  }
  function save(g) { localStorage.setItem(KEY, JSON.stringify(g)); }
  function reset() { localStorage.removeItem(KEY); }
  return { load, save, reset, DEFAULTS };
})();
