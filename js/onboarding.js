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
      // - PRIMO ascolto (Fase 3): verso 1 → 10–15 s
      // - SECONDO ascolto (Fase 6): verso 1 + verso 2 → 0–20 s
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
      let _onbPlaying = false; // NEW: stato play/pausa del player onboarding
      let _onbPlayFrom = null; // posizione (sec) da cui riprendere dopo la pausa

      function onbIsDone() {
        try { return localStorage.getItem(ONB_COMPLETED_KEY) === ONB_COMPLETED_VALUE; } catch (e) { return false; }
      }
      function onbRoot() { return document.getElementById('onboardingSection'); }

      // ---- utilità DOM ----
      function onbClear() {
        const r = onbRoot();
        if (r) { const tb = document.getElementById('onbTopbar'); r.innerHTML = ''; if (tb) r.appendChild(tb); }
        if (_onbAudio) { try { _onbAudio.pause(); } catch (e) {} }
        if (_onbExTimer) { try { clearTimeout(_onbExTimer); } catch (e) {} _onbExTimer = null; }
        _onbPlayerOnDone = null; // evita callback audio "vecchie" sulla fase successiva
        onbHidePlayer();
      }
      function onbHidePlayer() {
        const p = document.getElementById('onbPlayer');
        if (p) p.style.display = 'none';
      }

      // ---- Gestore centrale dei timer di fase ----
      // Un SOLO timer di fase pendente: ogni nuovo onbPhaseTimeout annulla il
      // precedente e onbClear() lo azzera ad ogni cambio fase (niente timer zombie).
      function onbPhaseTimeout(ms, fn) {
        if (_onbExTimer) { try { clearTimeout(_onbExTimer); } catch (e) {} _onbExTimer = null; }
        const t = setTimeout(() => { _onbExTimer = null; try { fn(); } catch (e) {} }, ms);
        _onbExTimer = t;
        return t;
      }

      // Errore d'ingresso: canzone senza versi validi o senza testo → messaggio
      // chiaro (invece di uscire dall'onboarding in silenzio).
      function onbShowEntryError(msg) {
        _onboardingActive = false;
        const sec = onbRoot();
        if (!sec) return;
        onbClear();
        document.body.classList.add('onboarding-active'); // attiva l'overlay CSS della sezione
        sec.classList.remove('d-none');
        sec.className = 'onb-landing';
        sec.innerHTML =
          '<div class="onb-landing-card" style="max-width:420px;">' +
          '<div class="onb-brand">Italiano con Musica</div>' +
          '<p class="onb-landing-copy" style="font-size:14px;">' + escapeHtml(msg) + '</p>' +
          '<button type="button" class="btn btn-primary onb-adelante" id="onbEntryErrorOk">Continuar</button>' +
          '</div>';
        const ok = sec.querySelector('#onbEntryErrorOk');
        if (ok) ok.addEventListener('click', () => {
          try { localStorage.setItem(ONB_COMPLETED_KEY, ONB_COMPLETED_VALUE); } catch (e) {}
          document.body.classList.remove('onboarding-active', 'onboarding-revealed');
          sec.classList.add('d-none');
          if (typeof hidePrimaryViews === 'function') hidePrimaryViews();
          if (typeof showHomeView === 'function') showHomeView();
        });
      }

      // ---- Fit proporzionale: tiene l'area versi sopra il bottone Adelante ----
      // Il CSS posiziona i centri a 45/165/330/455 (in vh) sul riferimento 520px.
      // Quando il contenuto dei versi è più alto dello spazio tra istruzioni e
      // bottone, il corpo viene spostato verso l'alto (o limitato con scroll
      // interno) così non copre mai il bottone "Adelante".
      let _onbFitTimer = null;
      let _onbFitObserver = null;
      let _onbFitInitDone = false;
      
      function onbScheduleFit() {
        if (_onbFitTimer) return;
        _onbFitTimer = setTimeout(() => { _onbFitTimer = null; onbFitPhase(); }, 40);
      }
      function onbFitPhase() {
        const root = onbRoot();
        if (!root) return;
        const body = root.querySelector(':scope > .onb-phase-body, :scope > .exercise-card');
        if (!body) return;
        if (getComputedStyle(body).position !== 'absolute') return; // solo layout proporzionale vh
        const cta = root.querySelector(':scope > .onb-adelante-row');
        const instr = root.querySelector(':scope > .onb-phase-header');
        const vh = window.innerHeight || 520;
        const GAP = 16;
        const lower = cta ? cta.getBoundingClientRect().top - GAP : vh - 60;
        let upper = vh * 0.055;
        if (instr && instr.getBoundingClientRect().height > 0) upper = instr.getBoundingClientRect().bottom + 12;
        const band = Math.max(0, lower - upper);
        const contentH = body.scrollHeight;
        if (contentH > band) {
          body.style.maxHeight = Math.max(40, Math.floor(band)) + 'px';
          body.style.overflowY = 'auto';
        } else {
          body.style.maxHeight = '';
          body.style.overflowY = '';
        }
        // Verso ancorato in CIMA (top = instr.bottom + 12), INDIPENDENTE dall'altezza
        // del contenuto: aggiunte sotto il verso (traduzione / banner feedback) NON lo
        // spostano. (L'altezza è già limitata a `band` qui sopra → bottom sopra il bottone.)
        let top = upper;
        if (top < 4) top = 4;
        body.style.top = Math.round(top * 10) / 10 + 'px';
      }
      function onbInitFit() {
        const root = onbRoot();
        if (!root || _onbFitInitDone) return;
        _onbFitInitDone = true;
        try {
          _onbFitObserver = new MutationObserver(() => onbScheduleFit());
          _onbFitObserver.observe(root, { childList: true, subtree: true, characterData: true });
        } catch (e) {}
        window.addEventListener('resize', onbScheduleFit);
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
        _onbPlayFrom = null; // nuovo segmento: riparte dall'inizio
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
        if (_onbPlayerBtn) {
          _onbPlayerBtn.classList.add('onb-play-attention'); // pulse viola fino al primo play
          _onbPlayerBtn.addEventListener('click', onbTogglePlay);
        }
      }
      function onbSetPlayIcon(name) {
        const ic = document.querySelector('#onboardingSection .onb-play-icon');
        if (ic) ic.textContent = name;
      }
      function onbTogglePlay() {
        const el = ensureOnbAudio();
        if (!el) return;
        const range = _onbPlayerRange || [0, 10];
        const start0 = range[0], end = range[1];
        if (_onbPlaying) { // click durante la riproduzione: PAUSA (ricorda la posizione)
          try { el.pause(); } catch (e) {}
          if (isFinite(el.currentTime) && el.currentTime > start0 && el.currentTime < end) _onbPlayFrom = el.currentTime;
          _onbPlaying = false;
          onbSetPlayIcon('play_arrow');
          return;
        }
        // PLAY: riparte da dove si era messo in pausa (o dall'inizio del segmento)
        const start = (typeof _onbPlayFrom === 'number' && _onbPlayFrom > start0) ? Math.min(_onbPlayFrom, end - 0.05) : start0;
        const bar = document.querySelector('#onboardingSection .onb-progress-bar');
        onbSetPlayIcon('pause');
        const pulseBtn = document.querySelector('#onboardingSection .onb-play-btn.onb-play-attention'); // ferma il pulse al primo play
        if (pulseBtn) pulseBtn.classList.remove('onb-play-attention');
        const tick = () => {
          if (bar && isFinite(el.duration)) {
            bar.style.width = Math.min(100, Math.max(0, ((el.currentTime - start) / (end - start)) * 100)) + '%';
          }
        };
        el.addEventListener('timeupdate', tick);
        _onbPlaying = true;
        playVerseInterval(el, start, end, () => {
          el.removeEventListener('timeupdate', tick);
          if (bar) bar.style.width = '100%';
          onbSetPlayIcon('play_arrow');
          _onbPlaying = false;
          _onbPlayFrom = null;
          if (typeof _onbPlayerOnDone === 'function') _onbPlayerOnDone();
        });
      }

      // ==================== LANDING PAGE ====================
      

      // PIANO-1 EDIT (landing unica): sotto, il bottone punta a onbFase(1).
      // PIANO-1 EDIT (landing unica): la riga seguente avvia la Fase 1 invece della Landing 2.
      // PIANO-2..5: vedi commenti dedicati nelle rispettive funzioni.
      // ==================== SHELL DI FASE ====================
      // Renderizza: barra di avanzamento + header (spiegazione fase) + wrapper contenuto.
      // La barra + header sono in onbRenderStepsHeader() per riutilizzarli anche nelle
      // sotto-viste della Fase 8 (esercizi review/complete).
      // Barra di progresso PERSISTENTE: creata una sola volta (onbEnsureTopbar) e
      // mai ricreata tra le fasi (onbClear la preserva). La progressione è fluida
      // grazie alla transition width su .onb-steps-fill. Nessuna etichetta numerica:
      // la barra è solo grafica.
      function onbRenderStepsHeader(title) {
        onbUpdateTopbar();
        const r = onbRoot();
        const header = document.createElement('div');
        header.className = 'onb-phase-header'; // istruzione immediata, senza dissolvenza
        header.textContent = title;
        r.appendChild(header);
      }
      function onbEnsureTopbar() {
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
      function onbUpdateTopbar() {
        const tb = onbEnsureTopbar();
        if (!tb) return;
        const idx = ONB_ACTIVE_PHASES.indexOf(_onbPhase);
        const total = ONB_ACTIVE_PHASES.length;
        const pct = idx >= 0 ? Math.round(((idx + 1) / total) * 100) : 0;
        const fill = document.getElementById('onbStepsFill');
        if (fill) fill.style.width = pct + '%';
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
        // SLOT CTA: segnaposto invisibile, sostituito al momento giusto (layout stabile)
        const slot = document.createElement('div');
        slot.className = 'onb-adelante-row onb-cta-slot';
        slot.innerHTML = '<button type="button" class="btn btn-primary onb-adelante" tabindex="-1">Adelante</button>';
        r.appendChild(slot);

        return wrap;
      }
      function onbAddAdelante(wrap, fn, opts) {
        const fresh = document.createElement('div');
        fresh.className = 'onb-adelante-row' + (opts && opts.fade ? ' onb-fade-in' : '');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-primary onb-adelante';
        b.textContent = 'Adelante';
        b.addEventListener('click', fn);
        fresh.appendChild(b);
        // SLOT CTA: sostituisce il segnaposto invisibile (stessa posizione, zero salti)
        const host = onbRoot() || wrap;
        const slot = host.querySelector('.onb-cta-slot');
        if (slot) { host.replaceChild(fresh, slot); } else { host.appendChild(fresh); }
      return fresh;
      }
      // Bottone Adelante visibile subito ma disabilitato (in grigio). Si abilita con
      // un'animazione fluida di `delayMs` (default 3s) che porta da disabled→enabled.
      // Nessun countdown numerico: la transizione visiva comunica il tempo di attesa.
      function onbAddAdelanteEnabling(wrap, fn, delayMs) {
        const dur = delayMs != null ? delayMs : 3000;
        const fresh = document.createElement('div');
        fresh.className = 'onb-adelante-row';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-primary onb-adelante onb-enabling';
        b.textContent = 'Adelante';
        b.disabled = true;
        b.style.animationDuration = dur + 'ms';
        fresh.appendChild(b);
        // SLOT CTA: sostituisce il placeholder (visibile subito, disabilitato: come prima)
        const host = onbRoot() || wrap;
        const slot = host.querySelector('.onb-cta-slot');
        if (slot) { host.replaceChild(fresh, slot); } else { host.appendChild(fresh); }
        onbPhaseTimeout(dur, () => {
          b.classList.remove('onb-enabling');
          b.disabled = false;
          b.style.animation = '';
          b.onclick = fn;
        });
        return fresh;
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
          star.dataset.lyricIndex = index; // PIANO-6: stella vuota pulsante fino al click
          star.classList.add('onb-star-attention');
          star.textContent = opts.starIcon || '☆';
          star.addEventListener('click', (e) => { e.stopPropagation(); try { star.classList.remove('onb-star-attention'); } catch (err) {} if (opts.onStar) opts.onStar(star, index); }); // PIANO-6: stop pulse al click
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
          // Fase 2: toca → traduzione. Bottone appare con dissolvenza dopo il tap.
          wrap = onbPhaseShell('Toca la frase para ver la traducción');
          onbVerseCard(wrap, _onbVerses[0], { tap: true, onTap: () => onbShowAdelante(wrap, () => onbFase(3)) });
        } else if (n === 3) {
          wrap = onbPhaseShell('Haz clic en play para escuchar cómo suena');
          onbVerseCard(wrap, _onbVerses[0], { tap: false });
          onbShowPlayer(wrap, ONB_PLAY_FIRST, null, () => onbShowAdelante(wrap, () => onbFase(4)));
        } else if (n === 4) {
          wrap = onbPhaseShell('Intenta entender y toca para ver la traducción');
          onbVerseCard(wrap, _onbVerses[1], { tap: true, onTap: () => onbShowAdelante(wrap, () => onbFase(5)) });
        } else if (n === 5) {
          wrap = onbPhaseShell('<span class="onb-instr-base">Esta frase parece complicada, </span><span class="onb-instr-hl">guárdala en tus favoritos</span><span class="onb-instr-base"> para estudiarla con más frecuencia</span>');
          onbVerseCard(wrap, _onbVerses[1], { showStar: true, starIcon: '☆', onStar: (starBtn, idx) => {
            onbFav(starBtn, idx);
            onbShowSuccessBanner(wrap, 'Guardada en favoritos', 'Podrás escribir apuntes en tus frases guardadas', '⭐', '🎵');
            onbShowAdelante(wrap, () => onbFase(7));
          }});
        } else if (n === 7) {
          wrap = onbPhaseShell('Escucha cómo suena');
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
      // starClicked=true → mostra la stella già salvata (preferito già aggiunto).
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
          star.textContent = '⭐';
          star.disabled = true;
          row.appendChild(star);
        }
        verse.appendChild(row);
        const note = document.createElement('div');
        note.className = 'verse-note';
        const ta = document.createElement('textarea');
        ta.placeholder = 'Añade nota';
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
      function onbShowSuccessBanner(wrap, message, hint, icon, hintIcon) {
        const existing = wrap.querySelector('.onb-success-banner');
        if (existing) existing.remove();
        const banner = document.createElement('div');
        banner.className = 'onb-success-banner onb-inline onb-fade-in';
        const iconBox = (ic, sm) => ic ? '<span class="onb-fb-icon' + (sm ? ' onb-fb-icon-sm' : '') + '">' + escapeHtml(ic) + '</span>' : '';
        let html = '<div class="onb-success-msg">' + iconBox(icon, false) + escapeHtml(message) + '</div>';
        if (hint) html += '<div class="onb-success-hint">' + iconBox(hintIcon, true) + escapeHtml(hint) + '</div>';
        banner.innerHTML = html;
        const verse = wrap.querySelector('.verse');
        if (verse) {
          // Il feedback va SEMPRE sotto il verso (mai sopra).
          verse.insertAdjacentElement('afterend', banner);
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
        if (_onbExTimer) { try { clearTimeout(_onbExTimer); } catch (e) {} _onbExTimer = null; } // azzera timer di fase pendente (cambio fase)
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
        while (wrap.lastChild && wrap.lastChild.id !== 'onbTopbar') wrap.removeChild(wrap.lastChild); // preserva la barra persistente
        onbRenderStepsHeader('Completa tu primer ejercicio');
        const card = document.createElement('div');
        card.className = 'exercise-card onb-enter';
        card.innerHTML =
          '<div class="exercise-header"><span class="exercise-progress">Piensa en la traducción</span></div>' +
          '<div class="exercise-text"><span class="exercise-verse-text">' + escapeHtml(_onbExTrad || 'Traducción no disponible') + '</span></div>' +
          '<div class="exercise-actions"><button id="onbExBtn" class="btn btn-primary onb-enabling" disabled>Piensa...</button></div>';
        wrap.appendChild(card);
        const btn = card.querySelector('#onbExBtn');
        // Animazione fluida 3s (nessun countdown numerico): al termine il bottone si abilita.
        onbPhaseTimeout(3000, () => {
          if (btn) {
            btn.classList.remove('onb-enabling');
            btn.disabled = false;
            btn.textContent = 'Mostrar';
            btn.onclick = () => {
              card.innerHTML =
                '<div class="exercise-header"><span class="exercise-progress">Piensa en la traducción</span></div>' +
                '<div class="exercise-text"><span class="exercise-verse-text">' + escapeHtml(_onbExTrad || 'Traducción no disponible') + '</span></div>' +
                '<div class="exercise-translation">' + escapeHtml(_onbExFrase || 'Texto no disponible') + '</div>' +
                '<div class="exercise-actions"><button id="onbExBtn" class="btn btn-primary">Adelante</button></div>';
              const newBtn = card.querySelector('#onbExBtn');
              if (newBtn) newBtn.onclick = () => { if (_onbExTimer) { clearTimeout(_onbExTimer); _onbExTimer = null; } onbRenderExComplete(); };
            };
          }
        });
        if (btn) btn.onclick = null;
      }
      function onbRenderExComplete() {
        const frase = _onbExFrase;
        const wrap = onbRoot();
        wrap.className = 'onb-funnel';
        while (wrap.lastChild && wrap.lastChild.id !== 'onbTopbar') wrap.removeChild(wrap.lastChild); // preserva la barra persistente
        onbRenderStepsHeader('Completa tu primer ejercicio');
        const textWithBlanks = generaVersoStudio(escapeHtml(frase), 1);
        const card = document.createElement('div');
        card.className = 'exercise-card onb-enter';
        card.innerHTML =
          '<div class="exercise-header"><span class="exercise-progress">Completa la frase</span></div>' +
          '<div class="exercise-text"><span class="exercise-verse-text">' + (textWithBlanks || escapeHtml(frase)) + '</span></div>' +
          (_onbExTrad ? '<div class="exercise-translation">' + escapeHtml(_onbExTrad) + '</div>' : '') +
          '<div class="exercise-actions"><button class="btn btn-primary exercise-next-btn exercise-next-hidden" id="onbExNext" onclick="onbComplete()">Siguiente →</button></div>';
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
        // Nascondi subito il loader di app (evita race sul _loadToken → spinner infinito).
        if (typeof hideAppLoader === 'function') hideAppLoader();
        const s = getCurrentSong() || songs[0];
      // ===== PIANO 2026-09-11: OVERRIDE FUNZIONI (function hoisting: queste definizioni vincono) =====
      // PIANO-1: landing unica (fuse le 2 schermate, testo sintetico, bottone -> onbFase(1)).
      function onbLanding1() {
        onbClear();
        _onbPhase = 0;
        const root = onbRoot();
        const sec = document.createElement('div');
        sec.className = 'onb-landing onb-enter';
        sec.innerHTML =
          '<div class="onb-splash"><div class="onb-brand">Italiano con Musica</div>' +
          '<h1 class="onb-splash-title">Música creada para que aprendas</h1>' +
          '<p class="onb-splash-sub">Nuestros cursos utilizan canciones para que puedas progresar en el estudio del idioma.</p>' +
          '<button type="button" class="btn btn-primary onb-splash-btn">¡Empezamos!</button></div>';
        root.appendChild(sec);
        onbFitSplashType(sec); // NEW: adatta brand/sottotitolo alla larghezza
        sec.querySelector('.onb-splash-btn'); // noop (fix applicato sotto)
        const btnSplash = sec.querySelector('.onb-splash-btn'); if (btnSplash) btnSplash.addEventListener('click', () => onbFase(1), { once: true }); // PIANO-1: fix selettore splash
        const btn = sec.querySelector('.onb-landing-btn');
        if (btn) btn.addEventListener('click', () => onbFase(1), { once: true });
      }
      // NEW: adatta il tipo dello splash: brand quasi a piena larghezza (mobile),
      // sottotitolo su una riga all 80% della dimensione del brand (si riduce solo
      // se la riga non entra: nowrap prioritario).
      function onbFitSplashType(sec) {
        const brand = sec.querySelector('.onb-splash .onb-brand');
        const sub = sec.querySelector('.onb-splash-title');
        const box = sec.querySelector('.onb-splash');
        if (!brand || !box || !box.clientWidth) return;
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;white-space:nowrap;';
        document.body.appendChild(probe);
        const target = Math.floor(box.clientWidth * 0.88); // ONB: 94->88, respiro simmetrico (fix disallineamento ottico)
        const bs = getComputedStyle(brand);
        probe.style.fontFamily = bs.fontFamily; probe.style.fontWeight = bs.fontWeight; probe.style.letterSpacing = bs.letterSpacing;
        probe.textContent = brand.textContent; probe.style.fontSize = '100px';
        const w = probe.scrollWidth;
        if (!w) { document.body.removeChild(probe); return; }
        let px = Math.floor(100 * target / w);
        const cap = (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) ? 999 : 72;
        if (px > cap) px = cap;
        brand.style.fontSize = px + 'px';
        if (sub) {
          const ss = getComputedStyle(sub);
          probe.style.fontFamily = ss.fontFamily; probe.style.fontWeight = ss.fontWeight; probe.style.letterSpacing = ss.letterSpacing;
          probe.textContent = sub.textContent;
          let spx = Math.floor(px * 0.8);
          probe.style.fontSize = spx + 'px';
          if (probe.scrollWidth > target) spx = Math.floor(spx * target / probe.scrollWidth);
          sub.style.fontSize = spx + 'px';
        }
        document.body.removeChild(probe);
      }
      
  
  
      
      
      // ===== FINE OVERRIDE PIANO =====
      // Le funzioni di funnel (onbPhaseShell, onbEnsureTopbar, onbUpdateTopbar,
      // onbAddAdelanteEnabling, onbFav, onbRenderExReview) vivono UNA sola volta
      // a livello file (scope globale). Qui dentro resta SOLO la landing/splash.
        if (!s) return;
        _onboardingActive = true;
        // Invalida le viste pendenti (es. showHomeView avviata da boot.js prima
        // del funnel): la loro continuation uscirà via check sul token.
        _loadToken++;
        _onbSong = s;
        try { if (!s.lyrics || !s.lyrics.length) s.lyrics = await fetchLyrics(s.id); } catch (e) { s.lyrics = s.lyrics || []; }
        if (!s.lyrics || !s.lyrics.length) { onbShowEntryError('No logramos cargar la letra de la canción de introducción. Recarga la página para reintentar.'); return; }
        _onbVerses = [];
        (s.lyrics || []).forEach((l, i) => {
          if (_onbVerses.length < ONB_VERSES_COUNT && l.text1 && l.text1.trim()) _onbVerses.push(i);
        });
        if (_onbVerses.length < 2) { onbShowEntryError('Esta canción no tiene suficientes versos para la introducción. Prueba con otra canción o recarga la página.'); return; }
        // La canzone corrente come "current": fa contare versi aperti e preferiti
        // (recordVerseExplored / recordSavedNoteForProgress usano currentSongBackup).
        currentSongId = String(s.id);
        currentSongBackup = s;
        document.body.classList.add('onboarding-active');
        onbInitFit();
        hidePrimaryViews();
      // PIANO-DONE: override sotto (riga ~640+) attivi: landing unica, shell con barra,
      // bottoni 3s, fav con banner+hint, review esercizio 3s. Verificati visivamente.
        hideBottomNav();
        const sec = onbRoot();
        if (sec) sec.classList.remove('d-none');
        onbLanding1(); // PIANO-1: landing unica (sintetico) -> onbFase(1)
      } // fine avviaOnboarding
