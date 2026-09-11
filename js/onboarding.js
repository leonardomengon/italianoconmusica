// ==================== ONBOARDING (FUNNEL DI PRIMO AVVIO) ====================
      // Sostituisce il vecchio "onboardingModal" con un funnel a fasi che guida
      // il nuovo utente dentro la prima canzone, aderendo al principio della
      // Divulgazione Progressiva. FLAG di completamento: 'onboardingCompleted'.
      //
      // NB: durante l'onboarding concorrono alla progressione SOLO i versi aperti
      // e i preferiti salvati; ascolti ed esercizi NON vengono conteggiati
      // (guardie già aggiunte in recordListen / recordSfidaCompleta).

      const ONB_COMPLETED_KEY = 'onboardingCompleted';
      const ONB_COMPLETED_VALUE = '1';
      const ONB_VERSES_COUNT = 3; // versi tutorial usati nelle Fasi 1/2/3

      // ===== TIMESTAMP AUDIO (solo per i versi del tutorial) =====
      // Il karaoke sincronizzato NON è implementato: questi secondi servono solo
      // a riprodurre il frammento del verso durante la Fase 2.
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
      let _onbVerses = [];
      let _onbAudio = null;

      function onbIsDone() {
        try { return localStorage.getItem(ONB_COMPLETED_KEY) === ONB_COMPLETED_VALUE; } catch (e) { return false; }
      }

      // ---- decorazioni (tooltip / CTA) ----
      function clearOnbDecos() {
        document.querySelectorAll('.onb-tooltip,.onb-cta,.onb-msg,.onb-excerpt').forEach(e => e.remove());
      }
      function onbSetVersesVisible(maxIndex) {
        document.querySelectorAll('.verse[data-index]').forEach(v => {
          const i = Number(v.dataset.index);
          v.classList.toggle('onb-hidden', i > maxIndex);
        });
      }
      function onbAddTooltip(verseIndex, html) {
        const v = document.querySelector('.verse[data-index="' + verseIndex + '"]');
        if (!v) return;
        const t = document.createElement('div');
        t.className = 'onb-tooltip';
        t.innerHTML = html;
        v.prepend(t);
      }

      // ---- avanzamento fasi ----
      function onbToPhase(n) {
        _onbPhase = n;
        clearOnbDecos();
        if (n === 1) {
          onbSetVersesVisible(_onbVerses[0]);
          onbAddTooltip(_onbVerses[0], 'Intenta adivinar el significado. Toca el verso para ver la traducción.');
          const v = document.querySelector('.verse[data-index="' + _onbVerses[0] + '"]');
          if (v) v.addEventListener('click', () => onbToPhase(2), { once: true });
        } else if (n === 2) {
          onbSetVersesVisible(_onbVerses[1]);
          onbAddTooltip(_onbVerses[1], '¡Excelente! Ahora, toca el botón de reproducción para escuchar cómo suena.');
          const v = document.querySelector('.verse[data-index="' + _onbVerses[1] + '"]');
          if (v) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn btn-sm btn-primary onb-excerpt';
            b.innerHTML = '▶ Escuchar';
            b.addEventListener('click', (e) => { e.stopPropagation(); onbPlayExcerpt(); });
            v.appendChild(b);
          }
        } else if (n === 3) {
          onbSetVersesVisible(_onbVerses[2]);
          onbAddTooltip(_onbVerses[2], 'Guarda las frases que te gusten en tu cuaderno personal. Toca la ⭐ para guardar esta línea.');
          const v = document.querySelector('.verse[data-index="' + _onbVerses[2] + '"]');
          const star = v ? v.querySelector('button[data-lyric-index="' + _onbVerses[2] + '"]') : null;
          if (star) {
            star.classList.add('onb-star-pulse');
            star.addEventListener('click', () => setTimeout(onbStarTapped, 80));
          }
        } else if (n === 4) {
          onbSetVersesVisible(Number.POSITIVE_INFINITY);
          onbRevealUi();
          onbShowEphemeral();
          onbShowSfidaCta();
        }
      }

      function onbStarTapped() {
        const lyr = _onbSong && _onbSong.lyrics && _onbSong.lyrics[_onbVerses[2]];
        if (lyr && isSaved(lyr.text1)) {
          showToast('⭐ ¡Misión Completada! Guarda 1 frase', 3000);
          onbToPhase(4);
        }
      }

      // Fase 2: audio del frammento (senza conteggio dell'ascolto).
      function onbPlayExcerpt() {
        const ts = onbTimestampFor(_onbSong.id, _onbVerses[1]);
        if (!_onbAudio) {
          _onbAudio = document.createElement('audio');
          _onbAudio.id = 'onb-excerpt';
          _onbAudio.src = _onbSong.soundcloud_link || '';
          document.body.appendChild(_onbAudio);
        }
        playVerseInterval(_onbAudio, ts[0], ts[1], () => {
          const idx = _onbVerses[1];
          const t = document.getElementById('translation-' + idx);
          if (t && t.style.display !== 'block') toggleTranslation(idx);
          onbToPhase(3);
        });
      }

      function onbRevealUi() {
        showBottomNav();
        const fp = document.getElementById('fixedPlayer');
        if (fp) fp.style.display = '';
        renderFixedPlayerMissions();
        document.body.classList.add('onboarding-revealed');
      }

      function onbShowEphemeral() {
        const m = document.createElement('div');
        m.className = 'onb-msg';
        m.innerHTML = '¡Ya casi dominas la aplicación! Explora los últimos versos y escucha la estrofa para desbloquear el desafío final.';
        document.body.appendChild(m);
        setTimeout(() => m.classList.add('onb-fade'), 3500);
        setTimeout(() => m.remove(), 4100);
      }

      function onbShowSfidaCta() {
        const c = document.createElement('div');
        c.className = 'onb-cta';
        c.innerHTML =
          '<div class="onb-cta-text">El desafío final pondrá a prueba tu memoria. Se sentirá un poco difícil, pero está científicamente comprobado para que nunca olvides las palabras.</div>' +
          '<button type="button" class="btn btn-primary onb-start-sfida">🔒 Desbloquear desafío →</button>';
        document.body.appendChild(c);
        const btn = c.querySelector('.onb-start-sfida');
        if (btn) btn.addEventListener('click', onbStartSfida);
      }

      async function onbStartSfida() {
        if (!_onbActive) return;
        _onbPhase = 5;
        _onbSfida = true;
        clearOnbDecos();
        const s = _onbSong;
        const fav = getAppunti().find(a => String(a.songId) === String(s.id) && a.testo && a.testo.trim());
        const lyr = s.lyrics[_onbVerses[2]] || {};
        const txt = fav ? fav.testo : (lyr.text1 || '');
        const hint = fav ? (fav.traduzione || '') : (lyr.text2 || '');
        _exerciseMode = true;
        _exerciseQueue = [];
        _exerciseIndex = 0;
        _reviewMode = false;
        _ripassoMode = true; // la macchina esercizi non conteggia nulla in modalità ripasso
        _exerciseQueue = [
          { text: txt, hint: hint, mode: 'review' },
          { text: txt, hint: hint, mode: 'complete' }
        ];
        await openSong(s.id);
        if (!_onbActive) return;
        hidePrimaryViews();
        document.body.classList.remove('view-song');
        document.getElementById('esercizi').classList.remove('d-none');
        updateNavigation('home');
        updateBottomNav('home');
        window.scrollTo(0, 0);
        renderCurrentExercise();
      }

      // Chiusura onboarding (invocata dal ramo fine-coda in renderEsercizio).
      function onbComplete() {
        if (!_onbActive) return;
        _onbActive = false;
        _onbSfida = false;
        document.body.classList.remove('onboarding-active', 'onboarding-revealed');
        try { localStorage.setItem(ONB_COMPLETED_KEY, ONB_COMPLETED_VALUE); } catch (e) {}
        clearOnbDecos();
        if (_onbAudio) { try { _onbAudio.pause(); } catch (e) {} _onbAudio = null; }
        chiudiEsercizi();
        const m = document.getElementById('onbEndModal');
        if (m) {
          m.classList.add('open');
          setTimeout(() => { try { if (typeof sincronizzaBackup === 'function') sincronizzaBackup(); } catch (e) {} }, 500);
        }
        const ok = document.getElementById('onbEndClose');
        if (ok) ok.addEventListener('click', () => m.classList.remove('open'), { once: true });
      }

      async function avviaOnboarding() {
        if (onbIsDone()) return;
        const s = getCurrentSong();
        if (!s) return;
        _onbActive = true;
        _onbSfida = false;
        _onbSong = s;
        // I testi si caricano lazy: li precarichiamo per individuare i versi tutorial
        // prima di aprire la canzone (openSong riusa la cache di fetchLyrics).
        try {
          if (!s.lyrics || !s.lyrics.length) s.lyrics = await fetchLyrics(s.id);
        } catch (e) { s.lyrics = s.lyrics || []; }
        if (!s.lyrics || !s.lyrics.length) { _onbActive = false; return; }
        _onbVerses = [];
        (s.lyrics || []).forEach((lyric, i) => {
          if (_onbVerses.length < ONB_VERSES_COUNT && lyric.text1 && lyric.text1.trim()) _onbVerses.push(i);
        });
        if (_onbVerses.length === 0) { _onbActive = false; return; }
        document.body.classList.add('onboarding-active');
        _exerciseMode = false;
        _exerciseQueue = [];
        _exerciseIndex = 0;
        _reviewMode = false;
        _ripassoMode = false;
        await openSong(s.id);
        if (!_onbActive) return;
        hideBottomNav();
        const fp = document.getElementById('fixedPlayer');
        if (fp) fp.style.display = 'none';
        onbToPhase(1);
      }
