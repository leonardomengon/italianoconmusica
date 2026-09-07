      // ==================== ANALYTICS / EVENT LOG ====================
      // Coda eventi in localStorage, flush batched verso Google Sheets (doPost
      // action=saveEvents, foglio "Eventi"). Fire-and-forget, mai bloccante.
      const ANALYTICS_QUEUE_KEY = 'appEventQueue';
      const ANALYTICS_SESSION_KEY = 'appSessionCounter';
      const ANALYTICS_FLUSH_SIZE = 10;
      const ANALYTICS_FLUSH_INTERVAL_MS = 30000;
      const ANALYTICS_MAX_QUEUE = 2000;

      let _analyticsSessionId = null;
      let _analyticsFlushTimer = null;
      let _analyticsCurrentTab = 'home';

      function _analyticsTs() { return new Date().toISOString(); }

      function getAnalyticsSessionId() {
        if (_analyticsSessionId) return _analyticsSessionId;
        let n = 0;
        try { n = parseInt(localStorage.getItem(ANALYTICS_SESSION_KEY) || '0', 10) || 0; } catch (e) {}
        n++;
        try { localStorage.setItem(ANALYTICS_SESSION_KEY, String(n)); } catch (e) {}
        _analyticsSessionId = 'sess_' + getUserCode() + '_' + String(n).padStart(3, '0');
        return _analyticsSessionId;
      }

      function logEvent(eventName, eventData) {
        let queue = [];
        try { queue = JSON.parse(localStorage.getItem(ANALYTICS_QUEUE_KEY) || '[]'); } catch (e) { queue = []; }
        queue.push({
          eventName: String(eventName || ''),
          timestamp: _analyticsTs(),
          sessionId: getAnalyticsSessionId(),
          eventData: eventData || {}
        });
        try { localStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(queue)); } catch (e) {}
        if (queue.length >= ANALYTICS_FLUSH_SIZE) flushEvents();
      }

      // Rimette in coda gli eventi non consegnati (in testa, senza duplicare).
      function _analyticsRequeue(events) {
        try {
          const queue = JSON.parse(localStorage.getItem(ANALYTICS_QUEUE_KEY) || '[]');
          localStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(events.concat(queue).slice(0, ANALYTICS_MAX_QUEUE)));
        } catch (e) {}
      }

      async function flushEvents() {
        let queue = [];
        try { queue = JSON.parse(localStorage.getItem(ANALYTICS_QUEUE_KEY) || '[]'); } catch (e) { queue = []; }
        if (!queue.length) return;
        try { localStorage.setItem(ANALYTICS_QUEUE_KEY, '[]'); } catch (e) {}
        const payload = { action: 'saveEvents', userId: getUserCode(), events: queue };
        // Quando la pagina sta per andare via (tab in background / chiusura),
        // sendBeacon ha molte più probabilità di completare l'invio della fetch.
        if (document.visibilityState === 'hidden' && typeof navigator.sendBeacon === 'function') {
          try {
            const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain;charset=utf-8' });
            if (navigator.sendBeacon(API_URL, blob)) return;
          } catch (e) {}
          // Beacon fallita (coda piena/non supportata): rimetti in coda,
          // gli eventi verranno consegnati al prossimo flush/sessione.
          _analyticsRequeue(queue);
          return;
        }
        try {
          const resp = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          });
          const res = await resp.json().catch(() => null);
          if (!res || !res.ok) _analyticsRequeue(queue);
        } catch (err) {
          _analyticsRequeue(queue);
        }
      }

      function initAnalytics() {
        logEvent('session_started', {});
        if (_analyticsFlushTimer) clearInterval(_analyticsFlushTimer);
        _analyticsFlushTimer = setInterval(flushEvents, ANALYTICS_FLUSH_INTERVAL_MS);
        // Flush "best effort" quando la pagina viene nascosta o chiusa.
        // Logga il passaggio a background/ritorno in primo piano: con entrambi
        // gli stati (e i timestamp) si può misurare la durata della pausa e
        // capire in quale vista l'utente ha lasciato l'app.
        document.addEventListener('visibilitychange', () => {
          try {
            logEvent('app_visibility_changed', {
              state: document.visibilityState,
              activeView: _analyticsCurrentTab,
              songId: currentSongId != null ? String(currentSongId) : null,
              exerciseMode: !!_exerciseMode
            });
          } catch (e) {}
          if (document.visibilityState === 'hidden') flushEvents();
        });
        window.addEventListener('pagehide', () => { flushEvents(); });
      }

      // ==================== ESERCIZI ====================
      // Tipo di esercizio corrente: "think_translation" (rivedi frase) o
      // "fill_blank" (completa parola); "ripasso" nella modalità ripasso.
      function _analyticsExerciseType() {
        try {
          if (_ripassoMode) return 'ripasso';
          const ex = _exerciseQueue && _exerciseQueue[_exerciseIndex];
          return ex && ex.mode === 'review' ? 'think_translation' : 'fill_blank';
        } catch (e) { return 'fill_blank'; }
      }

      // ==================== NAVIGAZIONE (nav_tab_clicked) ====================
      function trackNavigation(toTab) {
        if (!toTab || toTab === _analyticsCurrentTab) return;
        logEvent('nav_tab_clicked', { fromTab: _analyticsCurrentTab, toTab: toTab });
        _analyticsCurrentTab = toTab;
      }

      // Wrappa le funzioni di navigazione globali per loggare i click sulle tab
      // senza toccare ogni singolo punto di chiamata nell'app.
      (function initAnalyticsNavTracking() {
        const views = [
          ['showHomeView', 'home'],
          ['openNotebookView', 'appunti'],
          ['showLibreria', 'libreria'],
          ['openSettingsView', 'settings']
        ];
        views.forEach(([fnName, tab]) => {
          if (typeof window[fnName] !== 'function') return;
          const orig = window[fnName];
          window[fnName] = function (...args) {
            try { trackNavigation(tab); } catch (e) {}
            return orig.apply(this, args);
          };
        });
        // openSong è un caso a parte: la vista è "canzone" o "esercizio"
        // a seconda della modalità in cui viene chiamata (_exerciseMode è
        // già true quando si entra dagli esercizi, es. openSongStudyMode).
        if (typeof window.openSong === 'function') {
          const origOpenSong = window.openSong;
          window.openSong = function (...args) {
            try { trackNavigation(_exerciseMode ? 'esercizio' : 'canzone'); } catch (e) {}
            return origOpenSong.apply(this, args);
          };
        }
      })();

      // ==================== MISSIONI (mission_completed) ====================
      // Logga ogni missione appena completata (una sola volta per tipo/canzone).
      const ANALYTICS_MISSION_MAP = [
        ['translationsDone', 'esplora_traduzioni'],
        ['notesDone', 'guarda_3_frasi'],
        ['listensDone', 'escucha_10_veces'],
        ['exercisesDone', 'completa_3_ejercicios']
      ];

      function trackMissionCompletion(song) {
        if (!song || typeof missionState !== 'function') return;
        try {
          const m = missionState(song);
          const key = 'appMissionLogged_' + String(song.id);
          let logged = [];
          try { logged = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
          ANALYTICS_MISSION_MAP.forEach(([flag, missionType]) => {
            if (m[flag] && !logged.includes(missionType)) {
              logged.push(missionType);
              logEvent('mission_completed', { missionType: missionType, songId: String(song.id) });
            }
          });
          localStorage.setItem(key, JSON.stringify(logged));
        } catch (e) {}
      }
