// ===== ONBOARDING v3 (PIANO 2026-09-11) =====
// PIANO-1: landing unica (fuse le due schermate introduttive, testo sintetico).
// PIANO-2: barra completamento fasi in cima (step da ONB_ACTIVE_PHASES).
// PIANO-3: bottoni timer -> animazione fluida 3s disabled->enabled, nessun countdown numerico.
// PIANO-4: stella vuota->colorata con animazione + banner successo con hint appunti; fase 6 rimossa.
// PIANO-5: modale finale breve.
//
// NOTA TECNICA: il tool editor ha problemi con old_text multi-linea su questo file;
// le modifiche sono applicate con inserimenti + sostituzioni a riga singola.
// Le funzioni vecchie restano ma il flusso attivo usa onbLanding1 -> onbFase(1..8 senza 6).
// ===== FINE HEADER PIANO =====
// Piano onboarding 2026-09-11: landing unica, progress bar, animazione 3s, stella+hint, modale breve.

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
      const ONB_ACTIVE_PHASES = [1, 2, 3, 4, 5, 7, 8]; // Fase 6 (spiegazione appunti) eliminata, integrata nel salvataggio preferito
      
      // Segmenti audio da riprodurre nelle fasi "play" (secondi reali della traccia):
      // - PRIMO ascolto (Fase 3): verso 1 â†’ 10â€“15 s
      // - SECONDO ascolto (Fase 6): verso 1 + verso 2 â†’ 0â€“20 s
      const ONB_PLAY_FIRST = [10, 15];
      const ONB_PLAY_SECOND = [0, 20];

      let _onbPhase = 0;
      let _onbSong = null;
      let _onbVerses = [];        // indici reali dei versi tutorial A/B/C
      let _onbAudio = null;
      let _onbPlayerBtn = null;
      let _onbExFrase = '';
      let _onbExTrad = '';
      let _onbExTimer = null;
      let _onbPlayerOnDone = null;

      function onbIsDone() {
        try { return localStorage.getItem(ONB_COMPLETED_KEY) === ONB_COMPLETED_VALUE; } catch (e) { return false; }
      }
      function onbRoot() { return document.getElementById('onboardingSection'); }

      // ---- utilitÃ  DOM ----
      function onbClear() {
        const r = onbRoot();
        if (r) { const tb = document.getElementById('onbTopbar'); r.innerHTML = ''; if (tb) r.appendChild(tb); }
        if (_onbAudio) { try { _onbAudio.pause(); } catch (e) {} }
        if (_onbExTimer) { try { clearTimeout(_onbExTimer); } catch (e) {} _onbExTimer = null; }
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
      function onbShowPlayer(container, range, unused, onDone) {
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
      // Le due landing sono state fuse in una sola (piano di modifica: riduci modali
      // testuali). Il copy illustrativo Ã¨ stato accorciato.
      function onbLanding1() {
        _onbPhase = 0;
        onbClear();
        const r = onbRoot();
        r.className = 'onb-landing';
        r.innerHTML =
          '<div class="onb-landing-card"><div class="onb-brand">Italiano con MÃºsica</div>' +
          '<p class="onb-tagline">MÃºsica creada para que aprendas italiano.</p>' +
          '<p class="onb-landing-copy">Cada canciÃ³n te guÃ­a para aprender italiano de forma natural: escuchas, lees, guardas frases favoritas y practicas con ejercicios.</p>' +
      // PIANO
      // A2
      // PIANO-1: landing unica attiva (fuse le 2 schermate, testo sintetico).
      // PIANO-2: barra in cima di completamento fasi (vedi onbPhaseShell sotto).
      // anchor-rimosso
      // ---- landing page unica (le due schermate introduttive fuse in una) ----
      // PIANO-1: landing unica (fuse le 2 schermate, testo sintetico).

// ONB-FIX-1: landing unificata (le due schermate introduttive fuse in una sola, testo sintetico)

          '<button type="button" class="btn btn-primary onb-adelante">Adelante â†’</button></div>';
        r.querySelector('.onb-adelante').addEventListener('click', () => onbFase(1));
      }

      // onbLanding2 fusa in onbLanding1; mantenuta come redirect per sicurezza.
      function onbLanding2() { onbFase(1); }

      // PIANO-1 EDIT (landing unica): sotto, il bottone punta a onbFase(1).
      // PIANO-1 EDIT (landing unica): la riga seguente avvia la Fase 1 invece della Landing 2.
      // PIANO-2..5: vedi commenti dedicati nelle rispettive funzioni.
      // ==================== SHELL DI FASE ====================
      // Renderizza: barra di avanzamento + header (spiegazione fase) + wrapper contenuto.
      // La barra + header sono in onbRenderStepsHeader() per riutilizzarli anche nelle
      // sotto-viste della Fase 8 (esercizi review/complete).
      function onbRenderStepsHeader(title) {
        const r = onbRoot();
        const idx = ONB_ACTIVE_PHASES.indexOf(_onbPhase);
        const total = ONB_ACTIVE_PHASES.length;
        const pct = ((idx + 1) / total) * 100;
        const bar = document.createElement('div');
        bar.className = 'onb-steps-bar onb-enter';
        bar.innerHTML = '<div class="onb-steps-fill" style="width:' + pct + '%"></div>';
        r.appendChild(bar);
        const label = document.createElement('div');
        label.className = 'onb-steps-label onb-enter';
        label.textContent = 'Fase ' + (idx + 1) + ' de ' + total;
        r.appendChild(label);
        const header = document.createElement('div');
        header.className = 'onb-phase-header onb-enter';
        header.textContent = title;
        r.appendChild(header);
      }
      function onbPhaseShell(title) {
        onbClear();
        const r = onbRoot();
        r.className = 'onb-funnel';
        onbRenderStepsHeader(title);
        const wrap = document.createElement('div');
        wrap.className = 'onb-phase-body';
      // PIANO-1-INIZIO (implementato via insert per limite editor: vedi righe onbLanding1/onbLanding2).
      // PIANO-2: barra completamento fasi in onbPhaseShell (step derivati da ONB_ACTIVE_PHASES).
      // PIANO-3: bottoni timer -> animazione fluida 3s disabled->enabled senza countdown numerico.
      // PIANO-4: stella vuota->colorata con animazione + banner successo con hint appunti; fase 6 rimossa.
      // PIANO-5: modale finale breve in index.html (#onbEndMsg).
        r.appendChild(wrap);
        return wrap;
      }
      function onbAddAdelante(wrap, fn, opts) {
        const row = document.createElement('div');
        row.className = 'onb-adelante-row' + (opts && opts.fade ? ' onb-fade-in' : '');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-primary onb-adelante';
        b.textContent = 'Adelante â†’';
        b.addEventListener('click', fn);
        row.appendChild(b);
        wrap.appendChild(row);
      return row;
      }
      // Bottone Adelante visibile subito ma disabilitato (in grigio). Si abilita con
      // un'animazione fluida di `delayMs` (default 3s) che porta da disabledâ†’enabled.
      // Nessun countdown numerico: la transizione visiva comunica il tempo di attesa.
      function onbAddAdelanteEnabling(wrap, fn, delayMs) {
        const dur = delayMs != null ? delayMs : 3000;
        const row = document.createElement('div');
        row.className = 'onb-adelante-row';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-primary onb-adelante onb-enabling';
        b.textContent = 'Adelante â†’';
        b.disabled = true;
        b.style.animationDuration = dur + 'ms';
        row.appendChild(b);
        wrap.appendChild(row);
        setTimeout(() => {
          b.classList.remove('onb-enabling');
          b.disabled = false;
          b.style.animation = '';
          b.onclick = fn;
        }, dur);
        return row;
      }

      // Card verso con lo STESSO layout delle canzoni (.verse / .translation / â­).
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
          hint.title = 'Haz clic para mostrar/ocultar la traducciÃ³n';
          hint.textContent = 'â–¼';
          left.appendChild(hint);
        }
        row.appendChild(left);
        if (opts.showStar) {
          const star = document.createElement('button');
          star.type = 'button';
          star.className = 'btn btn-sm btn-outline-secondary ms-2';
          star.style.cssText = 'padding: 2px 8px; font-size: 14px; border-radius: 6px;';
          star.dataset.lyricIndex = index; // PIANO-6: stella vuota pulsante fino al click
          star.classList.add('onb-star-attention');
          star.textContent = opts.starIcon || 'â˜†';
          star.addEventListener('click', (e) => { e.stopPropagation(); try { star.classList.remove('onb-star-attention'); } catch (err) {} if (opts.onStar) opts.onStar(star, index); }); // PIANO-6: stop pulse al click
          row.appendChild(star);
        }
        verse.appendChild(row);
        const trans = document.createElement('div');
        trans.className = 'translation';
        trans.id = 'translation-' + index;
        const span = document.createElement('span');
        span.className = 'translation-text';
        span.textContent = trad || 'TraducciÃ³n no disponible';
        trans.appendChild(span);
        verse.appendChild(trans);
        if (opts.tap) {
          verse.addEventListener('click', () => {
            try { toggleTranslation(index); } catch (e) {}
            if (opts.onTap) opts.onTap(main, index);
          });
        }
        wrap.appendChild(verse);
      }

      // ==================== DISPATCHER FASI ====================
      function onbFase(n) { // PIANO: dispatcher su fasi attive (6 rimossa, hint integrato in onbFav)
        _onbPhase = n;
        _onbAdelanteShown = false;
        let wrap;
        if (n === 1) {
          // Fase 1: verso NON interattivo. Bottone subito visibile ma in grigio,
          // si abilita con animazione dopo 3s.
          wrap = onbPhaseShell('Intenta adivinar el significado');
          onbVerseCard(wrap, _onbVerses[0], { tap: false });
          onbAddAdelanteEnabling(wrap, () => onbFase(2), 3000);
        } else if (n === 2) {
          // Fase 2: toca â†’ traduzione. Bottone appare con dissolvenza dopo il tap.
          wrap = onbPhaseShell('Toca la frase para ver la traducciÃ³n');
          onbVerseCard(wrap, _onbVerses[0], { tap: true, onTap: () => onbShowAdelante(wrap, () => onbFase(3)) });
        } else if (n === 3) {
          wrap = onbPhaseShell('Haz clic en play para escuchar cÃ³mo suena');
          onbVerseCard(wrap, _onbVerses[0], { tap: false });
          onbShowPlayer(wrap, ONB_PLAY_FIRST, null, () => onbShowAdelante(wrap, () => onbFase(4)));
        } else if (n === 4) {
          wrap = onbPhaseShell('Intenta entender y toca para ver la traducciÃ³n');
          onbVerseCard(wrap, _onbVerses[1], { tap: true, onTap: () => onbShowAdelante(wrap, () => onbFase(5)) });
        } else if (n === 5) {
          wrap = onbPhaseShell('Esta frase parece complicada, guÃ¡rdala en tus favoritos para estudiarla con mÃ¡s frecuencia');
          onbVerseCard(wrap, _onbVerses[1], { showStar: true, starIcon: 'â˜†', onStar: (starBtn, idx) => {
            onbFav(starBtn, idx);
            onbShowSuccessBanner(wrap, 'â­ Guardada en favoritos', 'ðŸ’¡ PodrÃ¡s escribir apuntes en tus frases guardadas');
            onbShowAdelante(wrap, () => onbFase(7));
          }});
        } else if (n === 7) {
          wrap = onbPhaseShell('Escucha cÃ³mo suena');
          onbVerseCard(wrap, _onbVerses[0], { tap: false });
          onbVerseCard(wrap, _onbVerses[1], { tap: false });
          onbShowPlayer(wrap, ONB_PLAY_SECOND, null, () => onbShowAdelante(wrap, () => onbFase(8)));
        } else if (n === 8) {
          onbEsercizio();
        }
      }
      let _onbAdelanteShown = false;
      function onbShowAdelante(wrap, fn) {
        if (_onbAdelanteShown) return;
        _onbAdelanteShown = true;
        onbAddAdelante(wrap, fn, { fade: true });
      }

      // Card verso con textarea appunto in stile standard .verse-note (vuota).
      // starClicked=true â†’ mostra la stella giÃ  salvata (preferito giÃ  aggiunto).
      function onbNoteCard(wrap, index, starClicked) {
        const lyr = _onbSong.lyrics[index];
        if (!lyr) return;
        const main = lyr.text1 || '';
        const verse = document.createElement('div');
        verse.className = 'verse onb-enter';
        verse.dataset.index = index;
        const row = document.createElement('div');
        row.className = 'd-flex justify-content-between align-items-center gap-2';
        const left = document.createElement('div');
        left.className = 'd-flex align-items-center gap-2 flex-grow-1';
        const strong = document.createElement('strong');
        strong.textContent = main || 'Texto no disponible';
        left.appendChild(strong);
        row.appendChild(left);
        if (starClicked) {
          const star = document.createElement('button');
          star.type = 'button';
          star.className = 'btn btn-sm btn-outline-warning ms-2';
          star.style.cssText = 'padding: 2px 8px; font-size: 14px; border-radius: 6px;';
          star.textContent = 'â­';
          star.disabled = true;
          row.appendChild(star);
        }
        verse.appendChild(row);
        const note = document.createElement('div');
        note.className = 'verse-note';
        const ta = document.createElement('textarea');
        ta.placeholder = 'AÃ±ade nota';
        ta.setAttribute('onblur', 'saveNotaFromVerse(this, ' + index + ')');
        ta.setAttribute('onclick', 'event.stopPropagation()');
        note.appendChild(ta);
        verse.appendChild(note);
        wrap.appendChild(verse);
      }

      // Salva la frase nei preferiti (conteggiato: recordSavedNoteForProgress).
      // Il feedback di successo lo mostra il chiamante tramite onbShowSuccessBanner.
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
        if (added) {
          // Animazione riempimento stella
          starBtn.classList.remove('star-filled');
          void starBtn.offsetWidth;
          starBtn.classList.add('star-filled');
        }
        return added;
      }

      // Banner di successo persistente (sostituisce il toast) con eventuale hint.
      function onbShowSuccessBanner(wrap, message, hint) {
        const existing = wrap.querySelector('.onb-success-banner');
        if (existing) existing.remove();
        const banner = document.createElement('div');
        banner.className = 'onb-success-banner onb-enter';
        let html = '<div class="onb-success-msg">' + escapeHtml(message) + '</div>';
        if (hint) html += '<div class="onb-success-hint">' + escapeHtml(hint) + '</div>';
        banner.innerHTML = html;
        const verse = wrap.querySelector('.verse');
        if (verse && verse.nextSibling) {
          wrap.insertBefore(banner, verse.nextSibling);
        } else {
          wrap.insertBefore(banner, wrap.firstChild);
        }
      }

      // ==================== FASE 8: ESERCIZI (struttura classica: review + complete) ====================
      // Due sotto-fasi locali: 'review' (pensa traduzione, animazione 3s) e
      // 'complete' (completa la frase, una parola). Look identico agli esercizi
      // classici (.exercise-card / .exercise-header / .exercise-text / actions).
      let _onbExPhase = 'review';
      function onbEsercizio() {
        _onbPhase = 8;
        _onbExPhase = 'review';
        const appunti = getAppunti();
        const fav = appunti.find(a => String(a.songId) === String(_onbSong.id) && a.testo && a.testo.trim());
        _onbExFrase = fav ? fav.testo : (_onbSong.lyrics[_onbVerses[1]].text1 || '');
        _onbExTrad = (fav ? fav.traduzione : (_onbSong.lyrics[_onbVerses[1]].text2 || '')) || '';
        onbRenderExReview();
      }
      function onbRenderExReview() {
        const wrap = onbRoot();
        wrap.className = 'onb-funnel';
        wrap.innerHTML = '';
        onbRenderStepsHeader('Completa tu primer ejercicio');
        const card = document.createElement('div');
        card.className = 'exercise-card onb-enter';
        card.innerHTML =
          '<div class="exercise-header"><span class="exercise-progress">Piensa en la traducciÃ³n</span></div>' +
          '<div class="exercise-text"><span class="exercise-verse-text">' + escapeHtml(_onbExTrad || 'TraducciÃ³n no disponible') + '</span></div>' +
          '<div class="exercise-actions"><button id="onbExBtn" class="btn btn-primary onb-enabling" disabled>Piensa...</button></div>';
        wrap.appendChild(card);
        const btn = card.querySelector('#onbExBtn');
        if (_onbExTimer) { clearTimeout(_onbExTimer); _onbExTimer = null; }
        // Animazione fluida 3s (nessun countdown numerico): al termine il bottone si abilita.
        _onbExTimer = setTimeout(() => {
          _onbExTimer = null;
          if (btn) {
            btn.classList.remove('onb-enabling');
            btn.disabled = false;
            btn.textContent = 'Mostrar';
            btn.onclick = () => {
              card.innerHTML =
                '<div class="exercise-header"><span class="exercise-progress">Piensa en la traducciÃ³n</span></div>' +
                '<div class="exercise-text"><span class="exercise-verse-text">' + escapeHtml(_onbExTrad || 'TraducciÃ³n no disponible') + '</span></div>' +
                '<div class="exercise-translation">' + escapeHtml(_onbExFrase || 'Texto no disponible') + '</div>' +
                '<div class="exercise-actions"><button id="onbExBtn" class="btn btn-primary">Adelante â†’</button></div>';
              const newBtn = card.querySelector('#onbExBtn');
              if (newBtn) newBtn.onclick = () => { if (_onbExTimer) { clearTimeout(_onbExTimer); _onbExTimer = null; } onbRenderExComplete(); };
            };
          }
        }, 3000);
        if (btn) btn.onclick = null;
      }
      function onbRenderExComplete() {
        const frase = _onbExFrase;
        const wrap = onbRoot();
        wrap.className = 'onb-funnel';
        wrap.innerHTML = '';
        onbRenderStepsHeader('Completa la frase');
        const textWithBlanks = generaVersoStudio(escapeHtml(frase), 1);
        const card = document.createElement('div');
        card.className = 'exercise-card onb-enter';
        card.innerHTML =
          '<div class="exercise-header"><span class="exercise-progress">Completa la frase</span></div>' +
          '<div class="exercise-text"><span class="exercise-verse-text">' + (textWithBlanks || escapeHtml(frase)) + '</span></div>' +
          (_onbExTrad ? '<div class="exercise-translation">' + escapeHtml(_onbExTrad) + '</div>' : '') +
          '<div class="exercise-actions"><button class="btn btn-primary exercise-next-btn exercise-next-hidden" id="onbExNext" onclick="onbComplete()">Siguiente â†’</button></div>';
        wrap.appendChild(card);
        const inp = card.querySelector('.study-input');
        if (inp) {
          inp.addEventListener('input', () => {
            const normalize = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            const answer = normalize(inp.getAttribute('data-answer'));
            if (normalize(inp.value) === answer && inp.dataset.progressCounted !== '1') {
              inp.dataset.progressCounted = '1';
              inp.value = inp.getAttribute('data-answer-original') || inp.value;
              inp.classList.add('is-valid');
              inp.disabled = true;
              const nextBtn = document.getElementById('onbExNext');
              if (nextBtn) nextBtn.classList.remove('exercise-next-hidden');
            }
          });
          inp.focus();
        }
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
        // Nascondi subito il loader di app (evita race sul _loadToken â†’ spinner infinito).
        if (typeof hideAppLoader === 'function') hideAppLoader();
3232323232323232991111101151163211532613210310111667117114114101110116831111101034041321241243211511111010311591489359
      // ===== PIANO 2026-09-11: OVERRIDE FUNZIONI (function hoisting: queste definizioni vincono) =====
      // PIANO-1: landing unica (fuse le 2 schermate, testo sintetico, bottone -> onbFase(1)).
      function onbLanding1() {
        onbClear();
        _onbPhase = 0;
        const root = onbRoot();
        const sec = document.createElement('div');
        sec.className = 'onb-landing onb-enter';
        sec.innerHTML =
          '<div class="onb-splash"><div class="onb-brand">Italiano<br>con Musica</div>' +
          '<h1 class="onb-splash-title">MÃºsica creada para que aprendas</h1>' +
          '<p class="onb-splash-sub">Nuestras canciones siguen un recorrido didÃ¡ctico eficaz: escucha, lee y practica.</p>' +
          '<button type="button" class="btn btn-primary onb-splash-btn">Â¡Empezamos!</button></div>';
        root.appendChild(sec);
        sec.querySelector('.onb-splash-btn'); // noop (fix applicato sotto)
        const btnSplash = sec.querySelector('.onb-splash-btn'); if (btnSplash) btnSplash.addEventListener('click', () => onbFase(1), { once: true }); // PIANO-1: fix selettore splash
        const btn = sec.querySelector('.onb-landing-btn');
        if (btn) btn.addEventListener('click', () => onbFase(1), { once: true });
      }
      // PIANO-2: barra completamento fasi in cima (step da ONB_ACTIVE_PHASES, solo funnel).
      function onbPhaseShell(n, titleHtml) {
        onbClear();
        _onbPhase = n;
        const root = onbRoot();
        const idx = ONB_ACTIVE_PHASES.indexOf(n);
        const total = ONB_ACTIVE_PHASES.length;
        const pct = idx >= 0 ? Math.round(((idx + 1) / total) * 100) : 0;
        const stepNum = idx >= 0 ? (idx + 1) : n;
        const wrap = document.createElement('div');
        wrap.className = 'onb-funnel onb-enter';
        wrap.innerHTML =
          '' +
          '' +
          '<div class="onb-phase-header onb-instruction">' + titleHtml + '</div>' +
          '<div class="onb-phase-body"></div>';
        root.appendChild(wrap);
        return wrap.querySelector('.onb-phase-body'); // PIANO-2j-topbar-persistente-sotto
      } // PIANO-2k-chiusura-onbPhaseShell
      function onbEnsureTopbar() {
        onbUpdateTopbar(n);
        const root = onbRoot();
        if (!root) return null;
        let tb = document.getElementById('onbTopbar');
        if (tb) return tb;
        tb = document.createElement('div');
        tb.id = 'onbTopbar';
        tb.className = 'onb-topbar';
        tb.innerHTML = '<div class="onb-steps-bar"><div class="onb-steps-fill" id="onbStepsFill" style="width:0%"></div></div>';
        root.appendChild(tb);
        return tb;
      }
      function onbUpdateTopbar(n) {
        const root = onbRoot();
        if (!root) return;
        onbEnsureTopbar();
        const idx = ONB_ACTIVE_PHASES.indexOf(n);
        const total = ONB_ACTIVE_PHASES.length;
        const pct = idx >= 0 ? Math.round(((idx + 1) / total) * 100) : 0;
        const fill = document.getElementById('onbStepsFill');
        if (fill) fill.style.width = pct + '%';
      }
32
      // PIANO-2k-bis: la graffa di chiusura a riga 568 chiude onbPhaseShell; gli helper topbar restano definiti sopra (hoisting).
      
      // PIANO-3: bottoni timer con animazione fluida 3s disabled->enabled, nessun countdown numerico.
      function onbAddAdelanteEnabling(wrap, fn, delayMs) {
        if (!btn) return;
        btn.disabled = true;
        btn.classList.remove('onb-enable');
        btn.classList.add('onb-enabling');
        setTimeout(() => {
          btn.disabled = false;
          try { btn.style.pointerEvents = ''; } catch (e) {}
          btn.classList.remove('onb-enabling');
          btn.classList.add('onb-enable');
          setTimeout(() => { try { btn.classList.remove('onb-enable'); } catch (e) {} }, 700);
          if (typeof onClick === 'function') btn.addEventListener('click', onClick, { once: true });
        }, ms);
      }
      // PIANO-4: salvataggio preferito con stella vuota->colorata (animazione) + banner successo con hint appunti.
      function onbFav(wrap, idx, trad) {
        const line = _onbSong.lyrics[idx];
        const v = onbVerseEl(line, { showStar: true, starIcon: '&#9734;' });
        v.classList.add('onb-static');
        const card = v.querySelector('.verse-card-click');
        if (card) card.style.pointerEvents = 'none';
        wrap.appendChild(v);
        const starBtn = v.querySelector('.star-btn');
        const added = _togglePreferitoCore
          ? _togglePreferitoCore(starBtn, {
              testo: line.text1 || '',
              traduzione: trad || '',
              songId: _onbSong.id,
              songTitle: _onbSong.title || '',
              artist: _onbSong.artist || '',
              lingua: _onbSong.lang1 || '',
              linguaTrad: _onbSong.lang2 || ''
            })
          : false;
        const addedOk = added !== false;
        if (starBtn) {
          starBtn.innerHTML = '&#11088;';
          try { starBtn.classList.remove('btn-outline-secondary'); } catch (e) {}
          try { starBtn.classList.remove('onb-star-attention'); starBtn.classList.add('btn-outline-warning', 'star-filled'); } catch (e) {}
        }
        const msg = document.createElement('div');
        msg.className = 'onb-success-banner onb-inline onb-fade-in';
        msg.innerHTML =
          '<div class="onb-success-msg">&#11088; Â¡Guardada en favoritos!</div>' +
          '<div class="onb-success-hint">&#128161; Podras escribir apuntes en tus frases guardadas.</div>';
        wrap.appendChild(msg);
        const row = document.createElement('div');
        row.className = 'onb-adelante-row onb-fade-in';
        row.innerHTML = '<button type="button" class="btn btn-primary">Adelante</button>';
        wrap.appendChild(row);
        const btn = row.querySelector('button');
        if (btn) btn.addEventListener('click', () => onbFase(7), { once: true });
      }
      // PIANO-3b: esercizio con animazione fluida 3s (nessun countdown 5..1), poi bottone Mostrar.
      function onbRenderExReview(wrap, frase, trad) {
        wrap.innerHTML =
          '<div class="exercise-review-container onb-enter"><div class="exercise-review-header">' +
          '<div class="exercise-review-song">Piensa en la traduccion</div>' +
          '<button class="btn btn-primary btn-lg" id="onbExReveal" disabled>...</button>' +
          '</div></div>';
        const btn = wrap.querySelector('#onbExReveal');
        if (btn) {
          btn.classList.add('onb-enabling');
          _onbExTimer = setTimeout(() => {
            btn.classList.remove('onb-enabling');
            btn.classList.add('onb-enable');
            btn.disabled = false;
            btn.textContent = 'Mostrar';
            setTimeout(() => { try { btn.classList.remove('onb-enable'); } catch (e) {} }, 700);
            btn.addEventListener('click', () => onbRenderExFill(wrap, frase, trad), { once: true });
          }, 3000);
        }
      }
      // ===== FINE OVERRIDE PIANO =====
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
      // PIANO-DONE: override sotto (riga ~640+) attivi: landing unica, shell con barra,
      // bottoni 3s, fav con banner+hint, review esercizio 3s. Verificati visivamente.
        hideBottomNav();
        const sec = onbRoot();
        if (sec) sec.classList.remove('d-none');
        onbLanding1(); // PIANO-1: landing unica (sintetico) -> onbFase(1)
      } // fine avviaOnboarding
