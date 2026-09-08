      // ==================== NUOVA MODALITÀ ESERCIZI ====================
      function generaCodaEsercizi(song) {
        if (!song || !song.lyrics) return;
        const currentSongId = String(song.id);
        const appunti = getAppunti();

        // Categoria 1: Preferiti della canzone corrente
        let cat1 = appunti
          .filter(a => String(a.songId) === currentSongId && a.testo && a.testo.trim())
          .map(a => ({ text: a.testo, hint: a.traduzione || '', isAlt: false, isFav: true, isCurrent: true }));

        // Categoria 2: Frasi originali della canzone corrente
        let cat2 = (song.lyrics || [])
          .filter(l => l.text1 && l.text1.trim())
          .map(l => ({ text: l.text1, hint: l.text2 || '', isAlt: false, isFav: false, isCurrent: true }));

        // Categoria 3: Preferiti delle canzoni precedenti
        let cat3 = appunti
          .filter(a => String(a.songId) !== currentSongId && a.testo && a.testo.trim())
          .map(a => ({ text: a.testo, hint: a.traduzione || '', isAlt: false, isFav: true, isCurrent: false }));

        // Categoria 4: Frasi alternative della canzone corrente
        let cat4 = [];
        (song.lyrics || []).forEach(l => {
          if (l.alternative && l.alternative.trim()) {
            l.alternative.split('\n').filter(line => line.trim()).forEach(line => {
              const match = line.trim().match(/^(.+?)\s*\(([^)]+)\)\s*$/);
              if (match) {
                cat4.push({ text: match[1].trim(), hint: match[2].trim(), isAlt: true, isFav: false, isCurrent: true });
              } else {
                cat4.push({ text: line.trim(), hint: '', isAlt: true, isFav: false, isCurrent: true });
              }
            });
          }
        });

        // Deduplica ogni categoria
        const dedup = arr => arr.filter((v, i, self) => i === self.findIndex(x => normalizza(x.text) === normalizza(v.text)));
        cat1 = dedup(cat1);
        cat2 = dedup(cat2);
        cat3 = dedup(cat3);
        cat4 = dedup(cat4);

        // Mescola ogni categoria
        const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
        shuffle(cat1);
        shuffle(cat2);
        shuffle(cat3);
        shuffle(cat4);

        // Assegna quote (3-2-1-1 = 7 frasi), con redistribuzione
        let queue = [];
        const take = (arr, n) => { const taken = arr.splice(0, n); queue = queue.concat(taken); return taken.length; };

        // 3 preferiti canzone corrente
        let taken1 = take(cat1, 3);
        let remaining = 3 - taken1;
        if (remaining > 0) {
          let taken2extra = take(cat2, remaining);
          remaining -= taken2extra;
        }
        if (remaining > 0) {
          let taken3extra = take(cat3, remaining);
          remaining -= taken3extra;
        }
        if (remaining > 0) {
          take(cat4, remaining);
        }

        // 2 preferiti canzoni precedenti
        let taken3 = take(cat3, 2);
        remaining = 2 - taken3;
        if (remaining > 0) {
          take(cat4, remaining);
        }

        // 1 frase principale canzone corrente
        let taken2 = take(cat2, 1);
        remaining = 1 - taken2;
        if (remaining > 0) {
          take(cat4, remaining);
        }

        // 1 frase alternativa canzone corrente
        take(cat4, 1);

        // Se la coda è vuota (nessuna frase disponibile), aggiungi un fallback
        if (queue.length === 0) {
          queue = cat2.concat(cat4).concat(cat3).concat(cat1);
          shuffle(queue);
          queue = queue.slice(0, 7);
        }

        _exerciseQueue = [];
        _exerciseIndex = 0;
        _sfidaCountedSession = false;
        _eserciziFatti = 0;
        // Sfida: 7 frasi → 14 esercizi (7 pensa + 7 completa), ripetendo se necessario
        if (queue.length > 7) queue = queue.slice(0, 7);
        const poolFrasi = [...queue];
        while (queue.length < 7) {
          for (let i = 0; i < poolFrasi.length && queue.length < 7; i++) {
            queue.push({ ...poolFrasi[i] });
          }
        }
        const total = queue.length;
        for (let k = 0; k < total * 2; k++) {
          const mode = k % 2 === 0 ? 'review' : 'complete';
          const textIndex = k % 2 === 0
            ? (k / 2) % total
            : (Math.floor(k / 2) + 2) % total;
          _exerciseQueue.push({ ...queue[textIndex], mode });
        }
      }

// ==================== RENDER ESERCIZI UNIFICATO ====================
      // Unica funzione che renderizza gli esercizi. Adatta il render in base
      // al "tipo": 'studio' = esercizi della canzone corrente,
      // 'ripasso' = ripasso generale dagli appunti. Entrambi popolano la
      // stessa sezione nascosta (#eserciziLyrics): il layout è identico,
      // cambiano solo le frasi proposte e il numero di parole nascoste.
      function renderEsercizio(tipo) {
        const isRipasso = tipo === 'ripasso';
        const wrap = document.getElementById('eserciziLyrics');
        if (!wrap) return;

        const phase = _exercisePhase;
        const proceedBtnId = 'exerciseProceedBtn';
        const proceedHandler = 'advanceExercisePhase()';
        const nextHandler = 'nextExercise()';
        const hintHandler = 'useHint(this)';
        const hintTitle = isRipasso ? 'Revela la primera palabra que falta' : 'Revelar una letra';
        const numBlanks = isRipasso ? 2 : 1;
        const etichetta = 'Ejercicio';
        const num = isRipasso ? (_exerciseIndex + 1) : _eserciziFatti;
        const tot = isRipasso ? _exerciseQueue.length : ESERCIZI_PER_SFIDA;

        if (_exerciseQueue.length === 0 || _exerciseIndex >= _exerciseQueue.length) {
          if (isRipasso) {
            wrap.innerHTML = `<div class="exercise-card text-center p-4">
              <div class="celebration-icon">🎉</div>
              <h3 style="font-weight:900;color:#3D2B52;">¡Repaso completado!</h3>
              <p class="text-muted">Has completado ${_exerciseQueue.length} ejercicios de tus notas.</p>
              <div class="exercise-actions">
                <button class="btn btn-primary" onclick="openRipasso()">🔀 Nuevo repaso</button>
                <button class="btn btn-outline-secondary" onclick="chiudiEsercizi()">← Inicio</button>
              </div>
            </div>`;
          } else {
            if (_exerciseIndex > 0) recordSfidaCompleta();
            const sfideCompleted = Math.min((currentSongBackup ? (ensureSongProgress(currentSongBackup.id).completedSfideCount || 0) : 0), REQUIRED_SFIDE());
            wrap.innerHTML = `
              <div class="exercise-card text-center p-4">
                <div class="celebration-icon">🍾</div>
                <h3 style="font-weight:900;color:#3D2B52;">¡Desafío completado! (${sfideCompleted}/${REQUIRED_SFIDE()})</h3>
                <p class="text-muted">Has completado el lote de 20 ejercicios (10 piensa, 10 completa).</p>
                <div class="exercise-actions">
                  <button class="btn btn-primary" onclick="generaCodaEsercizi(currentSongBackup); renderCurrentExercise();">🔀 Nuevo desafío</button>
                  <button class="btn btn-outline-secondary" onclick="chiudiEsercizi()">← Inicio</button>
                </div>
              </div>
            `;
          }
          return;
        }

        const exercise = _exerciseQueue[_exerciseIndex];
        const rawMain = exercise.text || '';
        const isSavedFlag = isSaved(rawMain);
        const appunto = findAppuntoByTesto(rawMain);
        const notaValue = appunto ? escapeHtml(appunto.nota) : '';
        const starIcon = isSavedFlag ? '⭐' : '☆';
        const btnClass = isSavedFlag ? 'btn-outline-warning' : 'btn-outline-secondary';
        // Layout identico per studio e ripasso: la stella preferito appare
        // allo stesso modo (inline) sia in modalità review sia complete.
        const starBtnInReview = `<button class="btn btn-sm ${btnClass} exercise-fav-btn" style="padding: 2px 8px; font-size: 14px; border-radius: 6px;" onclick="event.stopPropagation(); togglePreferitoFromExercise(this, ${_exerciseIndex});">${starIcon}</button>`;
        const starBtnCompleteStyle = 'padding: 2px 8px; font-size: 14px; border-radius: 6px;';
if (exercise.mode === 'review') {
          if (phase === 'translation') {
            wrap.innerHTML = `
              <div class="exercise-card">
                <div class="exercise-header"><span class="exercise-progress">Piensa en la traducción</span></div>
                <div class="exercise-body">
                  <div class="exercise-text">
                    <div class="exercise-verse-text ">${escapeHtml(exercise.hint) || '<em>Traducción no disponible</em>'}</div>
                    ${starBtnInReview}
                  </div>
                  <div class="exercise-note" id="exercise-note-${_exerciseIndex}">
                    <textarea placeholder="Añade nota" onblur="saveNotaFromExercise(this, ${_exerciseIndex})">${notaValue}</textarea>
                  </div>
                  <div class="exercise-actions">
                    <button id="${proceedBtnId}" class="btn btn-primary" onclick="${proceedHandler}" disabled>5</button>
                    <span class="exercise-counter">${num}/${tot}</span>
                  </div>
                </div>
              </div>
            `;

            if (_exerciseTimer) clearInterval(_exerciseTimer);
            let secondsLeft = 5;
            const timerId = setInterval(() => {
              secondsLeft--;
              const btn = document.getElementById(proceedBtnId);
              if (btn) {
                btn.textContent = secondsLeft > 0 ? secondsLeft : 'Mostrar';
                if (secondsLeft <= 0) {
                  btn.disabled = false;
                  clearInterval(timerId);
                  _exerciseTimer = null;
                }
              }
            }, 1000);
            _exerciseTimer = timerId;
            return;
          } else {
            wrap.innerHTML = `
              <div class="exercise-card">
                <div class="exercise-header"><span class="exercise-progress">Piensa en la traducción</span></div>
                <div class="exercise-body">
                  <div class="exercise-text">
                    <div class="exercise-verse-text ">${escapeHtml(exercise.hint) || '<em>Traducción no disponible</em>'}</div>
                    ${starBtnInReview}
                  </div>
                  <div class="exercise-text"><strong>${escapeHtml(exercise.text || '')}</strong></div>
                  <div class="exercise-note" id="exercise-note-${_exerciseIndex}">
                    <textarea placeholder="Añade nota" onblur="saveNotaFromExercise(this, ${_exerciseIndex})">${notaValue}</textarea>
                  </div>
                  <div class="exercise-actions">
                    <button class="btn btn-primary" onclick="${proceedHandler}">Continuar</button>
                    <span class="exercise-counter">${num}/${tot}</span>
                  </div>
                </div>
              </div>
            `;
            if (_exerciseTimer) { clearInterval(_exerciseTimer); _exerciseTimer = null; }
            return;
          }
        }

        const textWithBlanks = generaVersoStudio(escapeHtml(exercise.text || ''), numBlanks);
        wrap.innerHTML = `
          <div class="exercise-card">
            <div class="exercise-header"><span class="exercise-progress">Completa la frase</span></div>
            <div class="exercise-text">
              <span class="exercise-verse-text">${textWithBlanks || '<em>Texto no disponible</em>'}</span>
              <button class="btn btn-sm ${btnClass} exercise-fav-btn" style="${starBtnCompleteStyle}" onclick="event.stopPropagation(); togglePreferitoFromExercise(this, ${_exerciseIndex});">${starIcon}</button>
            </div>
            ${exercise.hint ? `<div class="exercise-translation">${escapeHtml(exercise.hint)}</div>` : ''}
            <div class="exercise-note" id="exercise-note-${_exerciseIndex}">
              <textarea placeholder="Añade nota" onblur="saveNotaFromExercise(this, ${_exerciseIndex})">${notaValue}</textarea>
            </div>
            <div class="exercise-actions">
              <button class="btn btn-primary exercise-hint-btn" onclick="${hintHandler}" title="${hintTitle}">💡 Ayuda</button>
              <button class="btn btn-primary exercise-next-btn exercise-next-hidden" onclick="${nextHandler}">Siguiente →</button>
              <span class="exercise-counter">${num}/${tot}</span>
            </div>
          </div>`;
      }
      function renderCurrentExercise() {
        renderEsercizio(_ripassoMode ? 'ripasso' : 'studio');
      }

      // Sostituisce startExerciseFromReview() + startRipassoFromReview():
      // fa avanzare la fase dell'esercizio corrente (studio o ripasso).
      function advanceExercisePhase() {
        if (_exercisePhase === 'translation') {
          if (_exerciseTimer) {
            clearInterval(_exerciseTimer);
            _exerciseTimer = null;
          }
          _exercisePhase = 'revealed';
          renderCurrentExercise();
        } else {
          // Il conteggio della sfida vale solo in modalità studio, non in ripasso.
          if (!_ripassoMode) _eserciziFatti = Math.min(_eserciziFatti + 1, ESERCIZI_PER_SFIDA);
          nextExercise();
        }
      }

      // Sostituisce nextExercise() + nextRipassoExercise().
      function nextExercise() {
        if (_exerciseTimer) {
          clearInterval(_exerciseTimer);
          _exerciseTimer = null;
        }
        _exercisePhase = 'translation';
        _exerciseIndex++;
        renderCurrentExercise();
      }

      function togglePreferitoFromExercise(btn, exerciseIdx) {
        const exercise = _exerciseQueue[exerciseIdx];
        if (!exercise) return;

        const testo = exercise.text;
        if (!testo) return;

        const added = _togglePreferitoCore(btn, {
            testo: testo,
            traduzione: exercise.hint || '',
            songId: currentSongBackup ? currentSongBackup.id : '',
            songTitle: currentSongBackup ? (currentSongBackup.title || '') : '',
            artist: currentSongBackup ? (currentSongBackup.artist || '') : '',
            lingua: currentSongBackup ? (currentSongBackup.lang1 || '') : '',
            linguaTrad: currentSongBackup ? (currentSongBackup.lang2 || '') : ''
        });

        if (added) {
          let noteEl = document.getElementById(`exercise-note-${exerciseIdx}`);
          if (!noteEl) {
              noteEl = document.createElement('div');
              noteEl.className = 'exercise-note';
              noteEl.id = `exercise-note-${exerciseIdx}`;
              noteEl.innerHTML = `<textarea placeholder="Añade nota" onblur="saveNotaFromExercise(this, ${exerciseIdx})"></textarea>`;
              const root = btn.closest('.exercise-card') || getActiveExerciseRoot();
              const actionsEl = btn.closest('.exercise-card')?.querySelector('.exercise-actions');
              if (actionsEl) {
                  actionsEl.parentNode.insertBefore(noteEl, actionsEl);
              } else {
                  root.appendChild(noteEl);
              }
          }
        } else {
          const noteEl = document.getElementById(`exercise-note-${exerciseIdx}`);
          if (noteEl) noteEl.remove();
        }
      }

      function generaVersoStudio(testoOriginale, numBlanks) {
        if (!testoOriginale) return "";
        let frammenti = testoOriginale.split(/([\s.,!?'";:]+)/);
        function contaOccorrenze(parola, lista) {
          let target = parola.toLowerCase();
          return lista.filter(f => f.toLowerCase() === target).length;
        }
        function trovaCandidati(lunghezzaMinima, richiediUnicita) {
          let candidati = [];
          frammenti.forEach((frammento, idx) => {
            let valido = /^[\p{L}\p{N}]+$/u.test(frammento) && frammento.length >= lunghezzaMinima;
            if (valido && richiediUnicita) {
              if (contaOccorrenze(frammento, frammenti) > 1) valido = false;
            }
            if (valido) candidati.push({ testo: frammento, index: idx });
          });
          return candidati;
        }
        let candidati = trovaCandidati(5, true);
        if (candidati.length === 0) candidati = trovaCandidati(3, true);
        if (candidati.length === 0) candidati = trovaCandidati(1, false);
        let quante = Math.max(1, (typeof numBlanks === 'number' ? numBlanks : 1));
        let poolCand = [...candidati];
        let scelti = [];
        while (scelti.length < quante && poolCand.length > 0) {
          scelti.push(poolCand.splice(Math.floor(Math.random() * poolCand.length), 1)[0]);
        }
        scelti.forEach(scelta => {
          let targetParola = scelta.testo.toLowerCase();
          let larghezza = Math.max(80, targetParola.length * 16);
          frammenti[scelta.index] = `<input type="text" autocomplete="off" autocorrect="off" spellcheck="false"
            class="form-control form-control-sm d-inline-block study-input text-center"
            data-answer="${targetParola}"
            data-answer-original="${scelta.testo}"
            data-hint-state="0"
            data-hint-used="false"
            placeholder="${'*'.repeat(targetParola.length)}"
            style="width: ${larghezza}px; height: 28px; padding: 0 4px; vertical-align: middle; box-sizing: border-box;">`;
        });
        return frammenti.join("");
      }

      // Sostituisce useHint() + useRipassoHint(). In modalità studio c'è un
      // solo blank per esercizio; in ripasso possono essercene di più: in
      // entrambi i casi si agisce sul primo input non ancora completato.
      function useHint(btn) {
        const inputs = getExerciseInputs();
        const input = inputs.find(inp => !inp.disabled);
        if (!input) { maybeShowNextButton(); return; }
        const answer = input.getAttribute("data-answer");
        const answerOriginal = input.getAttribute("data-answer-original") || answer;
        if (!answer) return;
        const revealed = parseInt(input.getAttribute("data-hint-state") || "0");
        const currentValue = input.value || '';

        let newRevealed;
        if (revealed === 0) {
          // Primo click: mostra metà parola (o metà delle lettere mancanti se l'utente ha scritto correttamente)
          const isCorrectPrefix = currentValue.length > 0 && answer.startsWith(currentValue.toLowerCase());
          if (!isCorrectPrefix) {
            newRevealed = Math.ceil(answer.length / 2);
          } else {
            const remaining = answer.length - currentValue.length;
            newRevealed = currentValue.length + Math.ceil(remaining / 2);
          }
        } else {
          // Secondo click: completa la parola
          newRevealed = answer.length;
        }

        newRevealed = Math.min(newRevealed, answer.length);

        input.setAttribute("data-hint-used", "true");
        input.value = answerOriginal.substring(0, newRevealed);
        input.setAttribute("data-hint-state", newRevealed.toString());
        input.focus();
        // Analytics: uso del hint (livello 1 = metà parola, 2 = soluzione completa).
        try {
          const _hintLevel = newRevealed >= answer.length ? 2 : 1;
          logEvent('hint_used', { hintLevel: _hintLevel });
          if (newRevealed >= answer.length) {
            logEvent('exercise_attempted', { exerciseType: _analyticsExerciseType(), isCorrect: false, hintUsed: true });
          }
        } catch (e) {}

        if (newRevealed >= answer.length) {
          input.classList.add("is-valid");
          input.disabled = true;
          if (!_ripassoMode) {
            // Solo in modalità studio: rivelare l'intera parola non conta come
            // punteggio e l'esercizio torna in fondo alla coda.
            btn.disabled = true;
            btn.style.display = 'none';
            const ex = _exerciseQueue[_exerciseIndex];
            if (ex) _exerciseQueue.push({ ...ex });
          }
          maybeShowNextButton();
        }
      }

      function getActiveExerciseRoot() {
        const esercizi = document.getElementById('esercizi');
        if (esercizi && !esercizi.classList.contains('d-none')) return esercizi;
        return document.getElementById('songLyrics');
      }
      function getExerciseInputs() {
        const root = getActiveExerciseRoot();
        return root ? [...root.querySelectorAll('.study-input')] : [];
      }
      function maybeShowNextButton() {
        const inputs = getExerciseInputs();
        const allDone = inputs.length > 0 && inputs.every(inp => inp.disabled);
        const root = getActiveExerciseRoot();
        const hintBtn = root ? root.querySelector('.exercise-hint-btn') : null;
        const nextBtn = root ? root.querySelector('.exercise-next-btn') : null;
        if (allDone) {
          if (hintBtn) { hintBtn.disabled = true; hintBtn.style.display = 'none'; }
          if (nextBtn) nextBtn.classList.remove('exercise-next-hidden');
        }
      }

      document.addEventListener("input", function (e) {
        if (e.target.classList.contains("study-input")) {
          const rispostaCorretta = e.target.getAttribute("data-answer");
          const normalize = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
          const testoUtente = normalize(e.target.value);
          const targetNormalizzato = normalize(rispostaCorretta);
          if (testoUtente === targetNormalizzato && e.target.dataset.progressCounted !== "1") {
            e.target.dataset.progressCounted = "1";
            if (!_ripassoMode) _eserciziFatti = Math.min(_eserciziFatti + 1, ESERCIZI_PER_SFIDA);
            e.target.value = rispostaCorretta;
            e.target.classList.add("is-valid");
            e.target.disabled = true;
            // Analytics: tentativo esercizio riuscito (senza o con hint).
            try {
              logEvent('exercise_attempted', {
                exerciseType: _analyticsExerciseType(),
                isCorrect: true,
                hintUsed: e.target.getAttribute('data-hint-used') === 'true'
              });
            } catch (err) {}
            maybeShowNextButton();
          }
        }
      });

      // ==================== RIPASSO (tutte le canzoni completate) ====================
      const RIPASSO_QUANTI = 10;
      function shuffleArr(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }

      function openRipasso() {
        const appunti = getAppunti().filter(a => a.testo && a.testo.trim());
        if (appunti.length === 0) {
          alert('Aún no has guardado frases en las notas.');
          return;
        }
        _ripassoMode = true;
        _reviewMode = false;
        const poolRip = shuffleArr(appunti).slice(0, RIPASSO_QUANTI).map(a => ({
          text: a.testo,
          hint: a.traduzione || '',
          source: 'ripasso'
        }));
        const totalRip = poolRip.length;
        _exerciseQueue = [];
        for (let k = 0; k < totalRip * 2; k++) {
          const mode = k % 2 === 0 ? 'review' : 'complete';
          const textIndex = k % 2 === 0 ? (k / 2) % totalRip : (Math.floor(k / 2) + 2) % totalRip;
          _exerciseQueue.push({ ...poolRip[textIndex], mode });
        }
        _exercisePhase = 'translation';
        _exerciseTimer = null;
        _exerciseIndex = 0;
        hidePrimaryViews();
        document.body.classList.remove('view-song');
        document.getElementById('esercizi').classList.remove('d-none');
        updateNavigation('home');
        updateBottomNav('home');
        window.scrollTo(0, 0);
        renderCurrentExercise();
      }

      function chiudiEsercizi() {
        _ripassoMode = false;
        if (_exerciseTimer) { clearInterval(_exerciseTimer); _exerciseTimer = null; }
        _exerciseQueue = [];
        _exerciseIndex = 0;
        _exercisePhase = 'translation';
        showHomeView();
      }

      // renderRipassoExercise, useRipassoHint, nextRipassoExercise e
      // startRipassoFromReview sono stati unificati rispettivamente in
      // renderCurrentExercise, useHint, nextExercise e advanceExercisePhase.

