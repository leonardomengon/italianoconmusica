// ==================== ONBOARDING v2 (LANDING + FUNNEL A FASI) ====================
      // Due landing page introduttive + funnel interattivo in una SEZIONE DEDICATA
      // (#onboardingSection). Ogni fase renderizza SOLO gli elementi necessari
      // (con transizioni percettibili) e registra SOLO le interazioni indicate.
      // Flag di completamento: 'onboardingCompleted'.
      //
      // Conteggio progressione: durante l'onboarding contano SOLO i versi aperti
      // (Fase 2/4) e i preferiti (Fase 5); ascolti ed esercizi NON contano.

      const ONB_COMPLETED_KEY = 'onboardingCompleted';
      const ONB_COMPLETED_VALUE = '1';
      const ONB_VERSES_COUNT = 3; // versi tutorial A/B/C

      // Timestamp audio (solo versi tutorial): il karaoke NON è usato; servono
      // per riprodurre i frammenti dei versi nelle fasi "play".
      // TODO: sostituire con i secondi reali (start/end) dei primi versi della
      // canzone iniziale. Chiave = song.id; valore = [ [start,end], [start,end], ... ]
      const ONB_TS = {
        // '1': [[0,8],[8,16],[16,24]],
        // '2': [[0,7],[7,15],[15,22]]
      };
      function onbTimestampFor(songId, verseIndex) {
        const arr = ONB_TS[String(songId)] || [];
        const t = arr[verseIndex];
        return (t && Array.isArray(t) && t.length === 2) ? t : [0, 10];
      }

      let _onbPhase = 0;
      let _onbSong = null;
      let _onbVerses = [];        // indici reali dei versi tutorial A/B/C
      let _onbAudio = null;
      let _onbPlayerBtn = null;
      let _onbPlayerVerse = -1;
      let _onbPlayerOnDone = null;

      function onbIsDone() {
        try { return localStorage.getItem(ONB_COMPLETED_KEY) === ONB_COMPLETED_VALUE; } catch (e) { return false; }
      }
      function onbRoot() { return document.getElementById('onboardingSection'); }

      // ---- utilità DOM ----
      function onbClear() {
        const r = onbRoot();
        if (r) r.innerHTML = '';
        if (_onbAudio) { try { _onbAudio.pause(); } catch (e) {} }
        onbHidePlayer();
      }
      function onbHidePlayer() {
        const p = document.getElementById('onbPlayer');
        if (p) p.style.display = 'none';
      }

      // ---- audio + player dedicato (pinato in basso, solo play) ----
      function ensureOnbAudio() {
        if (!_onbAudio) {
          _onbAudio = document.createElement('audio');
          _onbAudio.id = 'onb-audio';
          _onbAudio.src = _onbSong ? (_onbSong.soundcloud_link || '') : '';
          document.body.appendChild(_onbAudio);
        }
        return _onbAudio;
      }
      function onbShowPlayer(verseIndex, onDone) {
        let p = document.getElementById('onbPlayer');
        if (!p) {
          p = document.createElement('div');
          p.id = 'onbPlayer';
          p.className = 'onb-player';
          p.style.display = 'none';
          p.innerHTML = '<button type="button" class="onb-play-btn" aria-label="Reproducir">▶</button>';
          const btnEl = p.querySelector('.onb-play-btn');
          if (btnEl) btnEl.addEventListener('click', onbTogglePlay);
          document.body.appendChild(p);
        }
        _onbPlayerBtn = p.querySelector('.onb-play-btn');
        if (_onbPlayerBtn) _onbPlayerBtn.textContent = '▶';
        _onbPlayerVerse = verseIndex;
        _onbPlayerOnDone = onDone;
        p.style.display = '';
        p.classList.add('onb-enter');
      }
      function onbTogglePlay() {
        // Se già in riproduzione il pulsante diventa pause-only: non riavvia.
        if (_onbAudio && !_onbAudio.paused && _onbAudio.currentTime > 0) return;
        const el = ensureOnbAudio();
        const ts = onbTimestampFor(_onbSong.id, _onbPlayerVerse);
        if (_onbPlayerBtn) _onbPlayerBtn.textContent = '⏸';
        playVerseInterval(el, ts[0], ts[1], () => {
          if (_onbPlayerBtn) _onbPlayerBtn.textContent = '▶';
          if (typeof _onbPlayerOnDone === 'function') _onbPlayerOnDone();
        });
      }

      // ==================== LANDING PAGE ====================
      function onbLanding1() {
        _onbPhase = 0;
        onbClear();
        const r = onbRoot();
        r.className = 'onb-landing';
        r.innerHTML =
          '<div class="onb-landing-card"><div class="onb-brand">Italiano con Música</div>' +
          '<p class="onb-tagline">Música creada para que aprendas italiano.</p>' +
          '<button type="button" class="btn btn-primary onb-adelante">Adelante →</button></div>';
        r.querySelector('.onb-adelante').addEventListener('click', onbLanding2);
      }

      function onbLanding2() {
        _onbPhase = 0;
        onbClear();
        const r = onbRoot();
        r.className = 'onb-landing';
        r.innerHTML =
          '<div class="onb-landing-card"><div class="onb-brand">Italiano con Música</div>' +
          '<p class="onb-landing-copy">Cada canción y cada curso siguen un camino didáctico diseñado para que aprendas de forma natural y sin esfuerzo: escuchas, lees, guardas tus frases favoritas y practicas con ejercicios pensados para fijarlas para siempre.</p>' +
          '<button type="button" class="btn btn-primary onb-adelante">Adelante →</button></div>';
        r.querySelector('.onb-adelante').addEventListener('click', () => onbFase(1));
      }

      // ==================== SHELL DI FASE ====================
      // Renderizza: header (spiegazione fase) + wrapper contenuto + bottone Adelante.
      function onbPhaseShell(title, adelanteFn) {
        onbClear();
        const r = onbRoot();
        r.className = 'onb-funnel';
        const header = document.createElement('div');
        header.className = 'onb-phase-header onb-enter';
        header.textContent = title;
        r.appendChild(header);
        const wrap = document.createElement('div');
        wrap.className = 'onb-phase-body';
        r.appendChild(wrap);
        if (adelanteFn) {
          const row = document.createElement('div');
          row.className = 'onb-adelante-row';
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'btn btn-primary onb-adelante';
          b.textContent = 'Adelante →';
          b.addEventListener('click', adelanteFn);
          row.appendChild(b);
          wrap.appendChild(row);
        }
        return wrap;
      }

      // ==================== DISPATCHER FASI ====================
      function onbFase(n) {
        _onbPhase = n;
        if (n === 1) {
          // Fase 1: primo verso NON interattivo (nessuna traduzione) + Adelante.
          const wrap = onbPhaseShell('Intenta entender esta frase italiana', () => onbFase(2));
          onbVerseCard(wrap, _onbVerses[0], { tap: false });
        } else if (n === 2) {
          // Fase 2: toca la frase → traduzione (registra verso aperto).
          const wrap = onbPhaseShell('Toca la frase para ver la traducción', () => onbFase(3));
          onbVerseCard(wrap, _onbVerses[0], { tap: true, onTap: (m, i) => { try { recordVerseExplored(i); } catch (e) {} } });
        } else if (n === 3) {
          // Fase 3: player solo play → ascolto frammento (NON conteggiato).
          const wrap = onbPhaseShell('Haz clic en play para escuchar cómo suena', () => onbFase(4));
          onbVerseCard(wrap, _onbVerses[0], { tap: false });
          onbShowPlayer(_onbVerses[0], null);
        } else if (n === 4) {
          // Fase 4: SOLO il prossimo verso, tap → traduzione (registra).
          const wrap = onbPhaseShell('Intenta entender y toca para ver la traducción', () => onbFase(5));
          onbVerseCard(wrap, _onbVerses[1], { tap: true, onTap: (m, i) => { try { recordVerseExplored(i); } catch (e) {} } });
        } else if (n === 5) {
          // Fase 5: SOLO bottone ⭐ (registra preferito) + nota di aiuto.
          const wrap = onbPhaseShell('Esta frase parece difícil, guárdala en tus favoritos para estudiarla con más frecuencia', () => onbFase(6));
          onbVerseCard(wrap, _onbVerses[1], { showStar: true, starIcon: '☆', onStar: onbFav });
          const note = document.createElement('p');
          note.className = 'onb-note-hint onb-enter';
          note.innerHTML = 'Puedes escribir notas que te ayuden a memorizar las frases difíciles.<br><em>Ejemplo:</em> «nota de ejemplo»';
          wrap.appendChild(note);
        } else if (n === 6) {
          // Fase 6: nuovo verso + player play (NON conteggiato).
          const idx = _onbVerses.length > 2 ? _onbVerses[2] : _onbVerses[1];
          const wrap = onbPhaseShell('Escucha cómo suena', () => onbFase(7));
          onbVerseCard(wrap, idx, { tap: false });
          onbShowPlayer(idx, null);
        } else if (n === 7) {
          onbEsercizio();
        }
      }

      // Salva la frase nei preferiti (conteggiato: recordSavedNoteForProgress).
      function onbFav(starBtn, index) {
        const lyr = _onbSong.lyrics[index];
        if (!lyr) return;
        let added = false;
        try {
          added = _togglePreferitoCore(starBtn, {
            testo: lyr.text1,
            traduzione: lyr.text2 || '',
            songId: _onbSong.id,
            songTitle: _onbSong.title,
            artist: _onbSong.artist || '',
            lingua: _onbSong.lang1,
            linguaTrad: _onbSong.lang2,
            lyricIndex: index
          });
        } catch (e) { added = false; }
        if (added) showToast('⭐ Guardada en favoritos', 2600);
      }

      // ==================== FASE 7: ESERCIZIO (UNA SOLA PAROLA NASCOSTA) ====================
      function onbEsercizio() {
        _onbPhase = 7;
        const wrap = onbPhaseShell('Completa la frase con la palabra que falta', onbComplete);
        // Frase bersaglio: la preferita (Fase 5), altrimenti il verso B.
        const appunti = getAppunti();
        const fav = appunti.find(a => String(a.songId) === String(_onbSong.id) && a.testo && a.testo.trim());
        const frase = fav ? fav.testo : (_onbSong.lyrics[_onbVerses[1]].text1 || '');
        const words = frase.split(/\s+/).filter(Boolean);
        if (words.length < 2) { onbComplete(); return; }
        const hiddenIdx = words.length - 1; // nascondi l'ultima parola
        const hiddenWord = words[hiddenIdx].replace(/[^\p{L}\p{N}'’]/gu, '');
        const displayWords = words.map((w, i) =>
          i === hiddenIdx ? '<span class="onb-word-hidden">______</span>' : escapeHtml(w)
        ).join(' ');
        const card = document.createElement('div');
        card.className = 'onb-exercise onb-enter';
        card.innerHTML =
          '<div class="onb-exercise-text">' + displayWords + '</div>' +
          '<input type="text" class="onb-blank-input" placeholder="Escribe la palabra…" autocomplete="off">';
        wrap.appendChild(card);
        const inp = card.querySelector('.onb-blank-input');
        inp.addEventListener('input', () => {
          const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
          if (norm(inp.value) === norm(hiddenWord)) {
            inp.value = hiddenWord;
            inp.classList.add('is-valid');
            inp.disabled = true;
            showToast('🎉 ¡Correcto!', 2200);
            setTimeout(onbComplete, 700);
          }
        });
      }

      // ==================== CHIUSURA ====================
      function onbComplete() {
        if (!_onboardingActive) return;
        _onboardingActive = false;
        document.body.classList.remove('onboarding-active', 'onboarding-revealed');
        try { localStorage.setItem(ONB_COMPLETED_KEY, ONB_COMPLETED_VALUE); } catch (e) {}
        onbClear();
        if (_onbAudio) { try { _onbAudio.pause(); } catch (e) {} try { _onbAudio.removeAttribute('src'); } catch (e) {} }
        const sec = onbRoot();
        if (sec) sec.classList.add('d-none');
        showHomeView();
        const m = document.getElementById('onbEndModal');
        if (m) {
          m.classList.add('open');
          setTimeout(() => { try { if (typeof sincronizzaBackup === 'function') sincronizzaBackup(); } catch (e) {} }, 500);
        }
        const ok = document.getElementById('onbEndClose');
        if (ok) ok.addEventListener('click', () => m.classList.remove('open'), { once: true });
      }

      // ==================== ENTRY POINT ====================
      async function avviaOnboarding() {
        if (onbIsDone()) return;
        // Nascondi subito il loader di app (evita race sul _loadToken → spinner infinito).
        if (typeof hideAppLoader === 'function') hideAppLoader();
        const s = getCurrentSong();
        if (!s) return;
        _onboardingActive = true;
        _onbSong = s;
        try { if (!s.lyrics || !s.lyrics.length) s.lyrics = await fetchLyrics(s.id); } catch (e) { s.lyrics = s.lyrics || []; }
        if (!s.lyrics || !s.lyrics.length) { _onboardingActive = false; return; }
        _onbVerses = [];
        (s.lyrics || []).forEach((l, i) => {
          if (_onbVerses.length < ONB_VERSES_COUNT && l.text1 && l.text1.trim()) _onbVerses.push(i);
        });
        if (_onbVerses.length < 2) { _onboardingActive = false; return; }
        // La canzone corrente come "current": fa contare versi aperti e preferiti
        // (recordVerseExplored / recordSavedNoteForProgress usano currentSongBackup).
        currentSongId = String(s.id);
        currentSongBackup = s;
        document.body.classList.add('onboarding-active');
        hidePrimaryViews();
        hideBottomNav();
        const sec = onbRoot();
        if (sec) sec.classList.remove('d-none');
        onbLanding1();
      }