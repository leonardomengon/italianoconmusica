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

      // Segmenti audio da riprodurre nelle fasi "play" (secondi reali della traccia):
      // - PRIMO ascolto (Fase 3): verso 1 → 10–15 s
      // - SECONDO ascolto (Fase 6): verso 1 + verso 2 → 0–20 s
      const ONB_PLAY_FIRST = [10, 15];
      const ONB_PLAY_SECOND = [0, 20];

      let _onbPhase = 0;
      let _onbSong = null;
      let _onbVerses = [];        // indici reali dei versi tutorial A/B/C
      let _onbAudio = null;
      let _onbPlayerBtn = null;
      let _onbPlayerRange = [0, 10];
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
      // Player ONBOARDING: renderizzato IN-FLOW (sotto il verso) con stile standard
      // (pulsante .btn .btn-primary + barra di progresso), senza essere fixed.
      function onbShowPlayer(container, range, onDone) {
        _onbPlayerRange = range || [0, 10];
        _onbPlayerOnDone = onDone;
        const p = document.createElement('div');
        p.className = 'onb-player onb-enter';
        p.innerHTML =
          '<div class="progress onb-progress"><div class="progress-bar onb-progress-bar" role="progressbar" style="width:0%"></div></div>' +
          '<div class="onb-controls">' +
          '<button type="button" class="btn btn-primary onb-play-btn" aria-label="Reproducir">' +
          '<span class="material-symbols-outlined onb-play-icon">play_arrow</span></button>' +
          '</div>';
        container.appendChild(p);
        _onbPlayerBtn = p.querySelector('.onb-play-btn');
        if (_onbPlayerBtn) _onbPlayerBtn.addEventListener('click', onbTogglePlay);
      }
      function onbSetPlayIcon(name) {
        const ic = document.querySelector('#onboardingSection .onb-play-icon');
        if (ic) ic.textContent = name;
      }
      function onbTogglePlay() {
        if (_onbAudio && !_onbAudio.paused && _onbAudio.currentTime > 0) return;
        const el = ensureOnbAudio();
        const range = _onbPlayerRange || [0, 10];
        const start = range[0], end = range[1];
        const bar = document.querySelector('#onboardingSection .onb-progress-bar');
        onbSetPlayIcon('pause');
        const tick = () => {
          if (bar && isFinite(el.duration)) {
            bar.style.width = Math.min(100, Math.max(0, ((el.currentTime - start) / (end - start)) * 100)) + '%';
          }
        };
        el.addEventListener('timeupdate', tick);
        playVerseInterval(el, start, end, () => {
          el.removeEventListener('timeupdate', tick);
          if (bar) bar.style.width = '100%';
          onbSetPlayIcon('play_arrow');
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
      function onbPhaseShell(title) {
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
        return wrap;
      }
      function onbAddAdelante(wrap, fn) {
        const row = document.createElement('div');
        row.className = 'onb-adelante-row onb-enter';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-primary onb-adelante';
        b.textContent = 'Adelante →';
        b.addEventListener('click', fn);
        row.appendChild(b);
        wrap.appendChild(row);
      }

      // Card verso con lo STESSO layout delle canzoni (.verse / .translation / ⭐).
      // opts: { tap, showStar, onStar, starIcon }
      function onbVerseCard(wrap, index, opts) {
        const lyr = _onbSong.lyrics[index];
        if (!lyr) return;
        const main = lyr.text1 || '';
        const trad = lyr.text2 || '';
        const verse = document.createElement('div');
        verse.className = 'verse onb-enter' + (opts.tap ? '' : ' onb-static');
        verse.dataset.index = index;
        const row = document.createElement('div');
        row.className = 'd-flex justify-content-between align-items-center gap-2';
        const left = document.createElement('div');
        left.className = 'd-flex align-items-center gap-2 flex-grow-1';
        const strong = document.createElement('strong');
        strong.textContent = main || 'Texto no disponible';
        left.appendChild(strong);
        if (opts.tap) {
          const hint = document.createElement('span');
          hint.className = 'toggle-hint';
          hint.title = 'Haz clic para mostrar/ocultar la traducción';
          hint.textContent = '▼';
          left.appendChild(hint);
        }
        row.appendChild(left);
        if (opts.showStar) {
          const star = document.createElement('button');
          star.type = 'button';
          star.className = 'btn btn-sm btn-outline-secondary ms-2';
          star.style.cssText = 'padding: 2px 8px; font-size: 14px; border-radius: 6px;';
          star.dataset.lyricIndex = index;
          star.textContent = opts.starIcon || '☆';
          star.addEventListener('click', (e) => { e.stopPropagation(); if (opts.onStar) opts.onStar(star, index); });
          row.appendChild(star);
        }
        verse.appendChild(row);
        const trans = document.createElement('div');
        trans.className = 'translation';
        trans.id = 'translation-' + index;
        const span = document.createElement('span');
        span.className = 'translation-text';
        span.textContent = trad || 'Traducción no disponible';
        trans.appendChild(span);
        verse.appendChild(trans);
        if (opts.tap) {
          verse.addEventListener('click', () => { try { toggleTranslation(index); } catch (e) {} });
        }
        wrap.appendChild(verse);
      }

      // ==================== DISPATCHER FASI ====================
      function onbFase(n) {
        _onbPhase = n;
        let wrap;
        if (n === 1) {
          // Fase 1: primo verso NON interattivo (nessuna traduzione) + Adelante.
          wrap = onbPhaseShell('Intenta entender esta frase italiana');
          onbVerseCard(wrap, _onbVerses[0], { tap: false });
          onbAddAdelante(wrap, () => onbFase(2));
        } else if (n === 2) {
          // Fase 2: toca la frase → traduzione (registra verso aperto).
          wrap = onbPhaseShell('Toca la frase para ver la traducción');
          onbVerseCard(wrap, _onbVerses[0], { tap: true });
          onbAddAdelante(wrap, () => onbFase(3));
        } else if (n === 3) {
          // Fase 3: player → PRIMO ascolto (verso 1, 10-15s). NON conteggiato.
          wrap = onbPhaseShell('Haz clic en play para escuchar cómo suena');
          onbVerseCard(wrap, _onbVerses[0], { tap: false });
          onbShowPlayer(wrap, ONB_PLAY_FIRST, null);
          onbAddAdelante(wrap, () => onbFase(4));
        } else if (n === 4) {
          // Fase 4: SOLO il prossimo verso, tap → traduzione (registra).
          wrap = onbPhaseShell('Intenta entender y toca para ver la traducción');
          onbVerseCard(wrap, _onbVerses[1], { tap: true });
          onbAddAdelante(wrap, () => onbFase(5));
        } else if (n === 5) {
          // Fase 5: SOLO bottone ⭐ (registra preferito) + nota di aiuto.
          wrap = onbPhaseShell('Esta frase parece difícil, guárdala en tus favoritos para estudiarla con más frecuencia');
          onbVerseCard(wrap, _onbVerses[1], { showStar: true, starIcon: '☆', onStar: onbFav });
          const note = document.createElement('p');
          note.className = 'onb-note-hint onb-enter';
          note.innerHTML = 'Puedes escribir notas que te ayuden a memorizar las frases difíciles.<br><em>Ejemplo:</em> «nota de ejemplo»';
          wrap.appendChild(note);
          onbAddAdelante(wrap, () => onbFase(6));
        } else if (n === 6) {
          // Fase 6: SECONDO ascolto (verso 1 + verso 2, 0-20s). NON conteggiato.
          wrap = onbPhaseShell('Escucha cómo suena');
          const idx = _onbVerses.length > 2 ? _onbVerses[2] : _onbVerses[1];
          onbVerseCard(wrap, _onbVerses[0], { tap: false });
          onbVerseCard(wrap, idx, { tap: false });
          onbShowPlayer(wrap, ONB_PLAY_SECOND, null);
          onbAddAdelante(wrap, () => onbFase(7));
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
        const wrap = onbPhaseShell('Completa la frase con la palabra que falta');
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
        onbAddAdelante(wrap, onbComplete);
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