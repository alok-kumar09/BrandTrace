const AppState = (() => {
  let listeners = [];
  let state = {
    workbench: { content: "", issues: [], source: null },
    guidelines: { tone: "", words: [], specs: [] },
    settings: {},
  };

  function get() {
    return state;
  }

  function set(newState) {
    state = { ...state, ...newState };
    listeners.forEach(fn => fn(state));
  }

  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter(l => l !== fn);
    };
  }

  return { get, set, subscribe };
})();