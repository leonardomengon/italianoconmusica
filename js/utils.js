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

      // ==================== RIVELAZIONE DELLA SOLUZIONE ====================
      // La soluzione è UN UNICO elemento: l'intera frase compare in una volta,
      // con dissolvenza + blur applicati insieme a tutte le sue parole. Non è
      // più tokenizzata in span per parola, quindi non c'è (né serve) alcuno
      // stagger: un solo nodo, una sola animazione.
      // Nessun blocco: il tocco dell'utente è il momento di impegno,
      // l'animazione (vedi .reveal-phrase nel CSS) dà "peso" alla soluzione.
      // I tempi sono centralizzati qui per essere tarati facilmente.
      const REVEAL_PHRASE_DUR_MS = 2000;  // DEVE combaciare con --reveal-phrase-dur nel CSS (1.1s)
      const REVEAL_INITIAL_DELAY_MS = 200; // pausa prima che compaia la frase
      function revealPhraseHtml(text) {
        // Whitespace normalizzato come faceva la vecchia tokenizzazione
        // (split(/\s+/) + join(' ')): il rendering resta identico.
        const clean = String(text || '').replace(/\s+/g, ' ').trim();
        if (!clean) return '';
        // Un solo wrapper di solo testo, con il delay inline: la frase anima
        // come blocco unico, così il blur coinvolge insieme tutte le parole.
        return '<span class="reveal-phrase" style="animation-delay:' + REVEAL_INITIAL_DELAY_MS + 'ms">' + escapeHtml(clean) + '</span>';
      }
      // Durata totale (ms) della comparsa prodotta da revealPhraseHtml: serve per
      // mostrare il bottone "avanti" solo a frase comparsa. Essendo la frase un
      // unico elemento, la durata NON dipende dal numero di parole.
      // Se l'utente preferisce il movimento ridotto, la comparsa è istantanea → 0.
      function revealTotalMs(text) {
        try {
          if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
        } catch (e) {}
        if (!String(text || '').trim()) return 0;
        return REVEAL_INITIAL_DELAY_MS + REVEAL_PHRASE_DUR_MS;
      }

      // ==================== FINE REVEAL DELLA FRASE ====================
      // Aggancia una callback alla fine VERA della dissolvenza della frase
      // tramite l'evento `animationend`: l'evento viene emesso nel frame in cui
      // l'animazione è effettivamente conclusa, quindi non accumula il ritardo
      // di un timer "a orologio" (che in più slittava con il frame rate).
      // Il setTimeout resta solo come rete di sicurezza per i casi in cui
      // l'animazione non parte (testo vuoto, prefers-reduced-motion, browser
      // senza animationend utile).
      // Riceve il contenitore del reveal (per isolare il .reveal-phrase) e
      // restituisce la funzione di annullamento: annulla sia il listener che il
      // timer, così chiudere/ri-nascondere la frase non lascia callback appesi.
      function onPhraseRevealEnd(revealEl, text, cb) {
        let done = false;
        let timer = null;
        const phrase = revealEl ? revealEl.querySelector('.reveal-phrase') : null;
        const onEnd = (ev) => {
          // Ignora eventuali animationend di altri elementi/animazioni.
          if (!phrase || ev.target !== phrase) return;
          if (ev.animationName && ev.animationName !== 'reveal-phrase-kf') return;
          finish();
        };
        const finish = () => {
          if (done) return;
          done = true;
          if (timer) { clearTimeout(timer); timer = null; }
          if (phrase) phrase.removeEventListener('animationend', onEnd);
          cb();
        };
        if (phrase) phrase.addEventListener('animationend', onEnd);
        const total = revealTotalMs(text);
        // +60ms di margine sul fallback: rete di sicurezza, mai di ritardo
        // percepito (l'evento animationend di norma arriva prima).
        timer = setTimeout(finish, total > 0 ? total + 60 : 0);
        return function cancel() {
          if (done) return;
          done = true;
          if (timer) { clearTimeout(timer); timer = null; }
          if (phrase) phrase.removeEventListener('animationend', onEnd);
        };
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
      // ==================== PROVENIENZA CANZONE ====================
      // Cerca una canzone del catalogo per id. Le canzoni hanno `id`, gli
      // appunti `songId`: per questo accetta entrambi i confronti. Ritorna
      // null se l'id è assente o non corrisponde a nessuna canzone caricata
      // (es. canzone filtrata per lingua, o catalogo non ancora pronto).
      function findSongById(songId) {
        if (songId === null || songId === undefined || songId === '') return null;
        const target = String(songId);
        if (typeof songs === 'undefined' || !Array.isArray(songs)) return null;
        return songs.find(s => s && String(s.id) === target) || null;
      }
      // Metadati di provenienza di una frase, normalizzati dai tre "formati"
      // che circolano nell'app: un oggetto canzone (id/title/artist/lang1/lang2),
      // un appunto salvato (songId/songTitle/artist/lingua/linguaTrad) o un item
      // di coda esercizi ({songMeta}). I campi mancanti vengono completati dal
      // catalogo, così la stessa frase dà sempre lo stesso badge 🎵 nella tab
      // Note. Ritorna TUTTI i campi presenti (stringa vuota se sconosciuti).
      function songMetaDa(source) {
        const src = source || {};
        const hasId = v => v !== undefined && v !== null && v !== '';
        const songId = hasId(src.songId) ? src.songId : (hasId(src.id) ? src.id : '');
        // Se la fonte non ha un id usabile ma è già una canzone (ha il titolo),
        // la si usa direttamente; altrimenti si cerca nel catalogo.
        const song = findSongById(songId) || (src.title ? src : null);
        return {
          songId: hasId(songId) ? songId : '',
          songTitle: src.songTitle || (song && song.title) || '',
          artist: src.artist || (song && song.artist) || '',
          lingua: src.lingua || (song && song.lang1) || '',
          linguaTrad: src.linguaTrad || (song && song.lang2) || ''
        };
      }
      // Ripristina un appunto rimosso (snapshot completo: id, nota, data).
      // Lo reinserisce nella posizione originale, così l'ordine della lista
      // resta quello di prima. Non sovrascrive nulla: se l'id è già tornato
      // nel frattempo (es. la frase è stata ri-salvata a mano) non fa niente.
      function ripristinaAppunto(snapshot, index) {
        if (!snapshot) return false;
        const appunti = getAppunti();
        if (snapshot.id && appunti.some(a => a.id === snapshot.id)) return false;
        const target = normalizza(snapshot.testo || snapshot.text || '');
        if (target && appunti.some(a => normalizza(a.testo) === target || normalizza(a.traduzione) === target)) return false;
        const at = (typeof index === 'number' && index >= 0 && index <= appunti.length) ? index : appunti.length;
        appunti.splice(at, 0, snapshot);
        saveAppunti(appunti);
        return true;
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
          // Crea nuovo appunto dalla frase dell'esercizio. Stessa forma degli
          // altri salvaggi (campo `testo`, NON `text`) e provenienza presa dalla
          // coda: nel ripaso currentSongBackup è null, quindi senza songMeta la
          // nota resterebbe senza canzone nella tab Note.
          const meta = songMetaDa(exercise.songMeta || currentSongBackup);
          appunti.push({
            id: genId(),
            testo: testo,
            traduzione: exercise.hint || '',
            songId: meta.songId,
            songTitle: meta.songTitle,
            artist: meta.artist,
            lingua: meta.lingua,
            linguaTrad: meta.linguaTrad,
            nota: value,
            createdAt: Date.now()
          });
          saveAppunti(appunti);
          // La mission "note salvate" vale solo per la canzone aperta: una
          // frase che arriva da un'altra canzone non deve contarne.
          if (currentSongBackup && String(currentSongBackup.id) === String(meta.songId)) {
            recordSavedNoteForProgress(testo);
          }
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
        // Snapshot completo: "Deshacer" rimette l'appunto identico (nota, data
        // e posizione originali), senza passar da conferme.
        const rimosso = { ...appunti[idx] };
        appunti.splice(idx, 1);
        saveAppunti(appunti);
        showToast('Nota eliminada', 2400, {
          action: {
            label: 'Deshacer',
            onClick: () => {
              if (!ripristinaAppunto(rimosso, idx)) return;
              popolaFiltriAppunti();
              renderAppuntiAuto();
              if (currentSongBackup && _exerciseMode) renderCurrentExercise();
            }
          }
        });
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

