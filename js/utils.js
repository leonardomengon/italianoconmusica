  // ==================== UTILITY ====================
      function normalizza(s) {
        if (!s) return '';
        return s.trim().toLowerCase().replace(/\s+/g, ' ');
      }
      function genId() {
        if (window.crypto && crypto.randomUUID) return 'n_' + crypto.randomUUID();
        return 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      }
      function escapeHtml(text) {
        if (text === null || text === undefined) return "";
        const div = document.createElement("div"); div.textContent = text; return div.innerHTML;
      }

      // ==================== TAG DIDATTICI (P0.5) ====================
      // Ogni canzone espone le proprie etichette grammaticali/lessicali
      // (es. "futuro semplice", "indicazioni stradali") tramite:
      //  - campo "tag"      : array di stringhe (catalogo aggiornato)
      //  - campo "tagword"  : stringa comma-separated (catalogo corrente, es. "Pop,Dias,,Rutina")
      // Finché nessuno dei due campi è popolato si applicano questi placeholder.
      const DEFAULT_SONG_TAGS = ["verbos esenciales", "presente"];
      // Parsa il campo "tagword" (stringa comma-separated) in un array di
      // stringhe non vuote. Ritorna null se il valore è assente o vuoto.
      function parseTagword(tagword) {
        if (typeof tagword !== 'string' || tagword.trim() === '') return null;
        const parsed = tagword.split(',').map(t => t.trim()).filter(t => t !== '');
        return parsed.length ? parsed : null;
      }
      // Accetta indifferentemente un array di tag o un oggetto canzone.
      // Risoluzione in ordine di priorità: tag (array) → tagword (stringa) → DEFAULT_SONG_TAGS.
      function getSongTags(songOrTags) {
        let raw;
        if (Array.isArray(songOrTags)) {
          raw = songOrTags;
        } else if (songOrTags) {
          // 1) campo "tag" (array) — preferito se presente e non vuoto
          if (Array.isArray(songOrTags.tag) && songOrTags.tag.length > 0) {
            raw = songOrTags.tag;
          } else if (songOrTags.tagword) {
            // 2) campo "tagword" (stringa comma-separated)
            raw = parseTagword(songOrTags.tagword);
          }
        }
        const tags = (raw || []).filter(t => t !== null && t !== undefined && String(t).trim() !== '');
        return tags.length ? tags : DEFAULT_SONG_TAGS;
      }
      // Solo le pillole (span), senza contenitore.
      function songTagPillItemsHtml(songOrTags) {
        return getSongTags(songOrTags)
          .map(t => '<span class="song-tag-pill">' + escapeHtml(t) + '</span>')
          .join('');
      }
      // Contenitore + pillole, con eventuale classe aggiuntiva (es. "song-tag-pills-hero").
      function songTagPillsHtml(songOrTags, extraClass) {
        const items = songTagPillItemsHtml(songOrTags);
        if (!items) return '';
        const cls = 'song-tag-pills' + (extraClass ? ' ' + extraClass : '');
        return '<div class="' + cls + '">' + items + '</div>';
      }

      // ==================== RIVELAZIONE PROGRESSIVA ====================
      // Rivelazione della soluzione "parola per parola", molto lenta e calma:
      // ogni parola entra dopo una pausa iniziale e con un ampio intervallo.
      // Nessun blocco: il tocco dell'utente è il momento di impegno,
      // l'animazione dà "peso" alla soluzione.
      // I tempi (durata/stagger/cap) sono centralizzati qui per essere tarati facilmente.
      const REVEAL_WORD_DUR_MS = 1100;   // DEVE combaciare con --reveal-word-dur nel CSS (1.1s)
      const REVEAL_STAGGER_MS = 340;     // passo tra una parola e la successiva
      const REVEAL_INITIAL_DELAY_MS = 200; // pausa prima della prima parola
      const REVEAL_MAX_TOTAL_MS = 3000;  // cap: le frasi lunghe non superano ~3s
      function revealWordsHtml(text) {
        const safe = escapeHtml(text || '');
        const words = safe.split(/\s+/).filter(Boolean);
        if (!words.length) return '';
        // Stagger effettivo: quello nominale, ridotto (mai sotto 40ms) affinché
        // pausa iniziale + ultimo delay + durata non sfondino il cap totale.
        const gap = words.length <= 1 ? 0
          : Math.max(40, Math.min(REVEAL_STAGGER_MS,
              Math.floor((REVEAL_MAX_TOTAL_MS - REVEAL_INITIAL_DELAY_MS - REVEAL_WORD_DUR_MS) / (words.length - 1))));
        const usedGap = Number.isFinite(gap) ? gap : 0;
        return words
          .map((w, i) => '<span class="reveal-word" style="animation-delay:' + (REVEAL_INITIAL_DELAY_MS + i * usedGap) + 'ms">' + w + '</span>')
          .join(' ');
      }
      // Durata totale (ms) del reveal prodotto da revealWordsHtml: serve per
      // mostrare il bottone "avanti" solo a reveal concluso. Se l'utente
      // preferisce il movimento ridotto, il reveal è istantaneo → durata 0.
      function revealTotalMs(text) {
        try {
          if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
        } catch (e) {}
        const safe = String(text || '').split(/\s+/).filter(Boolean);
        if (!safe.length) return 0;
        const gap = safe.length <= 1 ? 0
          : Math.max(40, Math.min(REVEAL_STAGGER_MS,
              Math.floor((REVEAL_MAX_TOTAL_MS - REVEAL_INITIAL_DELAY_MS - REVEAL_WORD_DUR_MS) / (safe.length - 1))));
        const usedGap = Number.isFinite(gap) ? gap : 0;
        return REVEAL_INITIAL_DELAY_MS + usedGap * (safe.length - 1) + REVEAL_WORD_DUR_MS;
      }

      // ==================== MIGRAZIONE DATI ====================
      function migraAppunti() {
        const raw = JSON.parse(localStorage.getItem('mieiAppunti') || '[]');
        if (raw.length === 0) return;
        if (typeof raw[0] === 'object' && raw[0] !== null && 'id' in raw[0]) return;
        const migrati = raw.map(t => ({
          id: genId(),
          testo: typeof t === 'string' ? t : (t.testo || ''),
          traduzione: '',
          songId: null,
          songTitle: '',
          artist: '',
          lingua: '',
          linguaTrad: '',
          nota: '',
          createdAt: Date.now()
        }));
        localStorage.setItem('mieiAppunti', JSON.stringify(migrati));
      }

      // ==================== INDICE ====================
      function rebuildSavedIndex() {
        const appunti = getAppunti();
        _savedTextsIndex = new Set();
        appunti.forEach(a => {
          const t = normalizza(a.testo);
          const tr = normalizza(a.traduzione);
          if (t)  _savedTextsIndex.add(t);
          if (tr) _savedTextsIndex.add(tr);
        });
      }
      function isSaved(testo) {
        if (!testo) return false;
        return _savedTextsIndex.has(normalizza(testo));
      }
      function findAppuntoByTesto(testo) {
        if (!testo) return null;
        const appunti = getAppunti();
        const target = normalizza(testo);
        return appunti.find(a => normalizza(a.testo) === target || normalizza(a.traduzione) === target) || null;
      }
      function getAppunti() {
        return JSON.parse(localStorage.getItem('mieiAppunti') || '[]');
      }
      function saveAppunti(arr) {
        localStorage.setItem('mieiAppunti', JSON.stringify(arr));
        rebuildSavedIndex();
        updateAppuntiBadge();
      }
      // Core: imposta la nota sul primo appunto che soddisfa il predicato.
      function aggiornaNota(matchFn, value) {
        const appunti = getAppunti();
        const idx = appunti.findIndex(matchFn);
        if (idx >= 0) {
          appunti[idx].nota = value;
          saveAppunti(appunti);
        }
      }
      function saveNotaFromVerse(textarea, lyricIndex) {
        if (!currentSongBackup || !currentSongBackup.lyrics) return;
        const lyric = currentSongBackup.lyrics[lyricIndex];
        const testo = lyric && lyric.text1;
        if (!testo) return;
        const target = normalizza(testo);
        aggiornaNota(a => normalizza(a.testo) === target || normalizza(a.traduzione) === target, textarea.value.trim());
      }
      function saveNotaFromExercise(textarea, exerciseIdx) {
        const exercise = _exerciseQueue[exerciseIdx];
        const testo = exercise && exercise.text;
        if (!testo) return;
        const value = textarea.value.trim();
        if (!value) return;
        const target = normalizza(testo);
        const appunti = getAppunti();
        const idx = appunti.findIndex(a => normalizza(a.testo) === target || normalizza(a.traduzione) === target);
        if (idx >= 0) {
          appunti[idx].nota = value;
          saveAppunti(appunti);
        } else {
          // Crea nuovo appunto dalla frase dell'esercizio
          appunti.push({
            id: 'ex_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            text: testo,
            traduzione: exercise.hint || '',
            songId: currentSongBackup ? String(currentSongBackup.id) : '',
            songTitle: currentSongBackup ? currentSongBackup.title : '',
            artist: currentSongBackup ? currentSongBackup.artist : '',
            lingua: '',
            linguaTrad: '',
            nota: value,
            createdAt: Date.now()
          });
          saveAppunti(appunti);
          if (currentSongBackup) recordSavedNoteForProgress(testo);
        }
      }
      function saveNotaFromAppunto(textarea, id) {
        if (!id) return;
        aggiornaNota(a => a.id === id, textarea.value.trim());
      }
      function rimuoviAppuntoSilenzioso(id) {
        if (!id) return;
        let appunti = getAppunti();
        const idx = appunti.findIndex(a => a.id === id);
        if (idx < 0) return;
        appunti.splice(idx, 1);
        saveAppunti(appunti);
        showToast('🗑️ Nota eliminada');
        popolaFiltriAppunti();
        renderAppuntiAuto();
        if (currentSongBackup && _exerciseMode) {
            renderCurrentExercise();
        }
      }

      // ==================== BADGE ====================
      // ID canonico di un verso, usato da tutti gli eventi analytics
      // (verse_expanded, verse_favorited) per rendere i due log join-abili.
      // Formato: v_<songId>_<index> — stabile e indipendente dal testo del verso.
      function positionalVerseId(songId, index) {
        return 'v_' + String(songId ?? '') + '_' + String(index);
      }
      function updateAppuntiBadge() {
        const n = getAppunti().length;
        const badge = document.getElementById('appuntiBadge');
        if (n > 0) {
          badge.textContent = n;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
        const navBadge = document.getElementById('navAppuntiBadge');
        if (navBadge) { navBadge.textContent = n; navBadge.style.display = n > 0 ? 'inline-block' : 'none'; }
      }

