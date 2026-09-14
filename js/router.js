// ==================== ROUTER (hash-based, no dependencies) ====================
// Unico punto di ingresso della navigazione principale. Sincronizza l'URL (#/...)
// con la vista attiva, gestisce il back button del browser via hashchange e
// centralizza lo stato del tab della bottom-nav.
// Le funzioni di render esistenti (showHomeView, openNotebookView, showLibreria,
// openSettingsView, openSong) restano invariate: il router le invoca a dispatch.
(function () {
  // Rotte: più specifiche prima. `view` = tab da attivare nella bottom-nav.
  const ROUTES = [
    { re: /^#\/canzone\/([^/]+)\/esercizi$/, view: 'home',     default: false, handler: songExercisesHandler },
    { re: /^#\/canzone\/([^/]+)$/,            view: 'home',     default: false, handler: songHandler },
    { re: /^#\/notas$/,                       view: 'appunti',  default: false, handler: notebookHandler },
    { re: /^#\/biblioteca$/,                  view: 'library',  default: false, handler: libraryHandler },
    { re: /^#\/ajustes$/,                     view: 'settings', default: false, handler: settingsHandler },
    { re: /^#\/?$/,                           view: 'home',     default: true,  handler: homeHandler }
  ];

  // Parserizza l'hash corrente restituendo la rotta ({route, id}) o null.
  function parse() {
    const raw = location.hash || '#/';
    for (let i = 0; i < ROUTES.length; i++) {
      const m = raw.match(ROUTES[i].re);
      if (m) return { route: ROUTES[i], id: (m[1] != null) ? String(m[1]) : null };
    }
    return null;
  }

  function current() { return parse(); }

  // Cambia rotta aggiungendo una voce allo storico del browser (back button).
  // Con opts.replace sostituisce la voce corrente (render interni, no storico).
  function navigate(path, opts) {
    opts = opts || {};
    const target = path ? path : '#/';
    if (location.hash === target) return;
    try {
      if (opts.replace) history.replaceState(null, '', target);
      else location.hash = target;
    } catch (e) { console.error('[router] navigate:', e); }
  }

  function replace(path) { navigate(path, { replace: true }); }

  // Azzera i flag di sessione prima di aprire una canzone in modalità lettura,
  // così gli analytics e la UI trattano l'apertura come "canzone" (non esercizi).
  function resetOpenSongFlags() {
    try { _exerciseMode = false; } catch (e) {}
    try { _exerciseQueue = []; } catch (e) {}
    try { _exerciseIndex = 0; } catch (e) {}
    try { _reviewMode = false; } catch (e) {}
    try { _ripassoMode = false; } catch (e) {}
    try { _sfidaCountedSession = false; } catch (e) {}
  }

  function songExists(id) {
    if (typeof songs === 'undefined' || !Array.isArray(songs)) return false;
    return songs.some(s => s && String(s.id) === String(id));
  }

  function notFoundFallback() {
    try { navigate('#/', { replace: true }); } catch (e) {}
    if (typeof showHomeView === 'function') showHomeView();
    if (typeof showToast === 'function') showToast('⚠️ Canción no encontrada.');
  }

  function homeHandler()     { return (typeof showHomeView === 'function') ? showHomeView() : Promise.resolve(); }
  function notebookHandler() { return (typeof openNotebookView === 'function') ? openNotebookView() : Promise.resolve(); }
  function libraryHandler()  { return (typeof showLibreria === 'function') ? showLibreria() : Promise.resolve(); }
  function settingsHandler() { return (typeof openSettingsView === 'function') ? openSettingsView() : Promise.resolve(); }

  function songHandler(id) {
    if (!songExists(id)) { notFoundFallback(); return Promise.resolve(); }
    resetOpenSongFlags();
    return (typeof openSong === 'function') ? openSong(id) : Promise.resolve();
  }

  function songExercisesHandler(id) {
    if (!songExists(id)) { notFoundFallback(); return Promise.resolve(); }
    if (typeof openSongInStudyMode === 'function') return openSongInStudyMode(id);
    resetOpenSongFlags();
    return (typeof openSong === 'function') ? openSong(id) : Promise.resolve();
  }

  // Marca il tab della bottom-nav coerente con la rotta corrente.
  function syncBottomNav() {
    let view = 'home';
    const r = parse();
    if (r) view = r.route.view;
    if (typeof updateBottomNav === 'function') updateBottomNav(view);
    return view;
  }

  // Esegue la vista corrispondente alla rotta corrente.
  async function dispatch() {
    const r = parse();
    if (!r) {
      try { navigate('#/', { replace: true }); } catch (e) {}
      if (typeof showHomeView === 'function') showHomeView();
      return;
    }
    try {
      await r.route.handler(r.id);
    } catch (e) {
      console.error('[router] dispatch:', e);
    }
    syncBottomNav();
  }

  // Deep-link all'avvio: se nell'URL c'è una rotta specifica (es. #/canzone/123,
  // #/notas, ...) la esegue dopo il caricamento del catalogo e l'eventuale
  // onboarding. La home (#/) è già gestita dal flusso di avvio normale.
  function handleDeepLink() {
    const r = parse();
    if (!r || r.route.default) return;
    dispatch();
  }

  window.router = {
    navigate: navigate,
    replace: replace,
    current: current,
    dispatch: dispatch,
    syncBottomNav: syncBottomNav,
    handleDeepLink: handleDeepLink
  };

  window.addEventListener('hashchange', function () {
    dispatch();
  });
})();