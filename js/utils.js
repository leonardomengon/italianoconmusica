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

