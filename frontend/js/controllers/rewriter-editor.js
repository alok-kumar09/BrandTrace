// frontend/js/controllers/rewriter-editor.js
// Pure helpers for placing a suggestion into the draft. No DOM access here.
const RewriterEditor = (() => {
  "use strict";

  const isNum = Number.isInteger;

  // Find where a suggestion's original_text currently sits in the draft.
  // 1) trust the backend offsets if the text at that range still matches;
  // 2) otherwise take the closest exact match (the user may have typed since the analysis).
  // Returns { start, end } or null when the text is gone.
  function locate(text, suggestion) {
    const original = String(suggestion.original_text ?? "");
    if (!original) return null;

    const a = suggestion.start_offset;
    const b = suggestion.end_offset;
    if (isNum(a) && isNum(b) && text.slice(a, b) === original) return { start: a, end: b };

    let best = null;
    let from = 0;
    let idx;
    while ((idx = text.indexOf(original, from)) !== -1) {
      const distance = Math.abs(idx - (isNum(a) ? a : 0));
      if (!best || distance < best.distance) best = { start: idx, end: idx + original.length, distance };
      from = idx + 1;
    }
    return best ? { start: best.start, end: best.end } : null;
  }

  // After one suggestion is spliced in, every other pending suggestion that sits
  // after it moves by the length difference. Ones that overlap it can no longer apply.
  function shiftPending(suggestions, appliedId, oldRange, newLength) {
    const delta = newLength - (oldRange.end - oldRange.start);
    suggestions.forEach(s => {
      if (s.id === appliedId || s.status !== "pending" || !isNum(s.start_offset) || !isNum(s.end_offset)) return;
      if (s.start_offset >= oldRange.end) {
        s.start_offset += delta;
        s.end_offset += delta;
      } else if (s.end_offset > oldRange.start) {
        s.status = "stale";
      }
    });
  }

  return { locate, shiftPending };
})();