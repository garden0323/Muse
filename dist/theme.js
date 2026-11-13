(() => {
  'use strict';
  const key = 'muse-theme';
  const modes = ['system', 'light', 'dark'];
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  try {
    const saved = localStorage.getItem(key);
    if (modes.includes(saved)) preference = saved;
  } catch {}
  function apply() {
    document.documentElement.dataset.theme = preference === 'system'
      ? (system.matches ? 'dark' : 'light')
      : preference;
  }
  function set(mode) {
    if (!modes.includes(mode)) return;
    preference = mode;
    try { localStorage.setItem(key, mode); } catch {}
    apply();
  }
  apply();
  if (system.addEventListener) system.addEventListener('change', apply);
  else system.addListener(apply);
  window.MuseTheme = {get: () => preference, set};
})();
