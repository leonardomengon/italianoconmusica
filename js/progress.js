  // ==================== PROGRESSION MVP ====================
  const PROGRESS_KEY = 'lyricalProgress';
  // Requisiti missioni DINAMICI in base al progresso:
  // - senza canzoni completate → 1/1/1
  // - dalla prima canzone completata in poi → 3/10/3
  function REQUIRED_NOTES() { return hasCompletedAnySong() ? 3 : 1; }
  function REQUIRED_LISTENS() { return hasCompletedAnySong() ? 10 : 1; }
  function REQUIRED_SFIDE() { return hasCompletedAnySong() ? 3 : 1; }
  function hasCompletedAnySong() {
    const p = getProgress();
    return (p.completedSongIds || []).length > 0;
  }
  const ESERCIZI_PER_SFIDA = 14;
  let _reviewMode = false;
  let _completionLock = false;
  let _animatingMissions = false;

  function defaultProgress() {
    return { version: 1, currentSongId: null, completedSongIds: [], songs: {} };
  }
  function getProgress() {
    try {
      const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null');
      return p && p.songs ? p : defaultProgress();
    } catch { return defaultProgress(); }
  }
  function saveProgress(p) { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); }
  function ensureSongProgress(songId) {
    const p = getProgress();
    const key = String(songId);
    if (!p.songs[key]) p.songs[key] = { completed:false, completedAt:null, openedVerseKeys:[], savedNoteKeys:[], listenedCount:0, completedSfideCount:0 };
    saveProgress(p);
    return p.songs[key];
  }
  function normalizeProgressKey(text) { return normalizza(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function uniqueMainVerseKeys(lyrics) {
    return [...new Set((lyrics || []).map(x => normalizeProgressKey(x.text1)).filter(Boolean))];
  }
  function missionState(song) {
    const sp = ensureSongProgress(song.id);
    const totalVerses = uniqueMainVerseKeys(song.lyrics || []).length;
    const validKeys = new Set(uniqueMainVerseKeys(song.lyrics || []));
    const opened = [...new Set(sp.openedVerseKeys || [])].filter(k => validKeys.has(k)).length;
    const notes = Math.min((sp.savedNoteKeys || []).length, REQUIRED_NOTES());
    const listens = Math.min(sp.listenedCount || 0, REQUIRED_LISTENS());
    const exercises = Math.min(sp.completedSfideCount || 0, REQUIRED_SFIDE());
    return {
      opened, totalVerses, notes, listens, exercises,
      translationsDone: totalVerses > 0 && opened >= totalVerses,
      notesDone: notes >= REQUIRED_NOTES(),
      listensDone: listens >= REQUIRED_LISTENS(),
      exercisesDone: exercises >= REQUIRED_SFIDE()
    };
  }
  function completedMissionCount(m) { return [m.translationsDone,m.notesDone,m.listensDone,m.exercisesDone].filter(Boolean).length; }
  function isSfidaUnlocked(m) { return m.translationsDone && m.notesDone && m.listensDone; }
  function missionRowsHtml(m, compact=false, group='all') {
    const rn = REQUIRED_NOTES(), rl = REQUIRED_LISTENS(), rs = REQUIRED_SFIDE();
    const allRows = [
      ['📖','Explora las traducciones',m.opened,m.totalVerses,m.translationsDone],
      ['⭐',`Guarda ${rn} frase${rn > 1 ? 's' : ''}`,m.notes,rn,m.notesDone],
      ['🎧',`Escucha ${rl} ${rl > 1 ? 'veces' : 'vez'}`,m.listens,rl,m.listensDone],
      ['✏️',`Completa ${rs} ejercicio${rs > 1 ? 's' : ''}`,m.exercises,rs,m.exercisesDone]
    ];
    const rows = group === 'basic' ? allRows.slice(0, 3)
      : group === 'sfida' ? [allRows[3]]
      : allRows;
    return `<div class="mission-list">${rows.map(r => `<div class="mission-row ${r[4]?'done':''}"><div class="mission-icon">${r[4]?'✓':r[0]}</div><div><div class="mission-name">${r[1]}</div></div><div class="mission-value">${Math.min(r[2],r[3])} / ${r[3]}</div></div>`).join('')}</div>`;
  }
  function missionIconsHtml(m) {
    const rn = REQUIRED_NOTES(), rl = REQUIRED_LISTENS();
    const all = [
      ['translationsDone', '📖', m.opened, m.totalVerses, 'Explora las traducciones'],
      ['notesDone', '⭐', m.notes, rn, `Guarda ${rn} frase${rn > 1 ? 's' : ''}`],
      ['listensDone', '🎧', m.listens, rl, `Escucha ${rl} ${rl > 1 ? 'veces' : 'vez'}`]
    ];
    return `<div class="mission-icons">${all.map(([k, icon, val, max, name]) =>
      `<div class="mission-icon-chip ${m[k] ? 'done' : ''}" title="${name}">` +
        `<span class="mission-icon-badge">${icon}</span>` +
        `<span class="mission-icon-status">${m[k] ? '✓' : `${Math.min(val, max)}/${max}`}</span>` +
      `</div>`).join('')}</div>`;
  }
  // Aggiorna il pannello missioni del player fisso (senza tornare alla home).
  function renderFixedPlayerMissions() {
    const rows = document.getElementById('missionProgressRows');
    if (!rows) return;
    const song = (currentSongBackup && currentSongBackup.lyrics && currentSongBackup.lyrics.length)
      ? currentSongBackup
      : getCurrentSong();
    if (!song) return;
    rows.innerHTML = missionIconsHtml(missionState(song));
  }
  // Nomi delle 3 missioni di base (stesse stringhe usate nella lista).
  function basicMissionNames() {
    const rn = REQUIRED_NOTES(), rl = REQUIRED_LISTENS();
    return [
      ['translationsDone', 'Explora las traducciones'],
      ['notesDone', `Guarda ${rn} frase${rn > 1 ? 's' : ''}`],
      ['listensDone', `Escucha ${rl} ${rl > 1 ? 'veces' : 'vez'}`]
    ];
  }
  // Se tra before e after è appena stata completata una missione base, mostra il feedback.
  function maybeShowMissionFeedback(before, after) {
    if (!before || !after) return;
    const row = basicMissionNames().find(([k]) => after[k] && !before[k]);
    if (row) showMissionFeedback(row[1]);
  }
  let _missionsSwapTimer = null;
  // Chiude subito le missioni e torna alla barra di avanzamento.
  function closeMissionsSwap() {
    const progress = document.getElementById("playerProgressWrap");
    const swap = document.getElementById("playerMissionsSwap");
    const fb = document.getElementById("missionFeedbackText");
    const rows = document.getElementById("missionProgressRows");
    if (_missionsSwapTimer) { clearTimeout(_missionsSwapTimer); _missionsSwapTimer = null; }
    if (swap && swap.classList.contains("visible")) {
      // Animazione di chiusura
      _animatingMissions = true;
      swap.classList.add("closing");
      swap.classList.remove("visible");
      setTimeout(() => {
        swap.classList.remove("closing");
        // Mostra la barra dopo l animazione
        if (progress) progress.classList.remove("collapsed");
        if (rows) rows.hidden = false;
        if (fb) fb.hidden = true;
        _animatingMissions = false;
      }, 250);
    } else {
      if (progress) progress.classList.remove("collapsed");
      if (rows) rows.hidden = false;
      if (fb) fb.hidden = true;
    }
  }
  // Mostra le missioni (o il feedback di una sola missione) al posto della barra.
  function openMissionsSwap(durationMs, feedbackText) {
    const progress = document.getElementById("playerProgressWrap");
    const swap = document.getElementById("playerMissionsSwap");
    const fb = document.getElementById("missionFeedbackText");
    const rows = document.getElementById("missionProgressRows");
    if (!progress || !swap) return;
    renderFixedPlayerMissions();
    if (feedbackText) {
      // Feedback: solo la missione completata, senza lo stato delle altre
      if (rows) rows.hidden = true;
      if (fb) { fb.textContent = feedbackText; fb.hidden = false; }
    } else {
      if (rows) rows.hidden = false;
      if (fb) fb.hidden = true;
    }
    // Animazione espansione: nascondi barra e mostra missioni
    _animatingMissions = true;
    progress.classList.add("collapsed");
    swap.classList.add("visible");
    setTimeout(() => { _animatingMissions = false; }, 300);
    if (_missionsSwapTimer) clearTimeout(_missionsSwapTimer);
    _missionsSwapTimer = setTimeout(closeMissionsSwap, durationMs || 3000);
  }
  // Bottone missioni: se aperte le chiude subito, altrimenti le apre.
  function toggleMissionsSwap(durationMs) {
    if (_animatingMissions) return;
    const swap = document.getElementById("playerMissionsSwap");
    if (swap && swap.classList.contains("visible")) { closeMissionsSwap(); return; }
    openMissionsSwap(durationMs || 3000, null);
  }
  // Se tra before e after è appena stata completata una missione base, mostra il feedback.
  function showMissionFeedback(text) {
    openMissionsSwap(2200, text + " ✓");
  }
  function getCurrentSong() {
    const p=getProgress();
    return songs.find(s => String(s.id)===String(p.currentSongId)) || songs.find(s => !(p.completedSongIds||[]).map(String).includes(String(s.id))) || null;
  }
  function getNextSong(song) {
    if (!song) return null;
    const i=songs.findIndex(s => String(s.id)===String(song.id));
    return i>=0 ? songs[i+1] || null : null;
  }
  function initializeProgression() {
    if (!songs.length) return;
    const p=getProgress();
    if (!p.currentSongId || !songs.some(s => String(s.id)===String(p.currentSongId))) {
      const first=songs.find(s => !(p.completedSongIds||[]).map(String).includes(String(s.id))) || null;
      p.currentSongId=first ? first.id : null;
    }
    if (p.currentSongId) ensureSongProgress(p.currentSongId);
    saveProgress(p);
  }
  async function ensureLyricsFor(song) {
    if (!song || (song.lyrics && song.lyrics.length)) return song;
    try { song.lyrics=await fetchLyrics(song.id); } catch { song.lyrics=[]; }
    return song;
  }
  async function renderProgressionHome() {
    initializeProgression();
    const p=getProgress();
    const current=getCurrentSong();
    const box=document.getElementById('currentSongHome');
    const nextBox=document.getElementById('nextSongHome');
    if (!current) {
      box.innerHTML=`<div class="current-song-card text-center"><div class="celebration-icon">🏆</div><h2 class="current-song-title">Recorrido completado</h2><p>Has completado todas las canciones disponibles.</p><div class="current-actions" style="align-items:center;margin:20px auto 0;"><button class="btn btn-primary" onclick="openRipasso()">🔁 REPASO COMPLETO</button></div></div>`;
      document.getElementById('ripassoHome').innerHTML=``;
      nextBox.innerHTML=``; return;
    }
    await ensureLyricsFor(current);
    const m=missionState(current);
    const sfidaUnlocked = isSfidaUnlocked(m);
    const sfidaBtnHtml = sfidaUnlocked
      ? `<button class="btn btn-challenge" onclick="openSongStudyMode()">Ejercicio</button>`
      : '';
    box.innerHTML=`<div class="song-box-container"><h2 class="current-song-title">${escapeHtml(current.title)}</h2><article class="current-song-card"><div class="course-missions-section"><div class="course-missions-basic">${missionRowsHtml(m, false, 'basic')}</div><div class="course-missions-open-wrap"><button class="btn btn-primary" onclick="openCurrentSong()">CANCIÓN</button></div></div><div class="course-missions-divider"></div><div class="course-missions-sfida ${sfidaUnlocked ? 'unlocked' : ''}"><div class="mission-list">${missionRowsHtml(m, false, 'sfida')}</div>${sfidaBtnHtml}</div></article></div>`;
    const appuntiCount = getAppunti().filter(a => a.testo && a.testo.trim()).length;
    const ripassoBox = document.getElementById('ripassoHome');
    if (appuntiCount >= 10) {
      ripassoBox.innerHTML=`<article class="ripasso-card" onclick="openRipasso()" role="button"><div class="ripasso-icon"><span class="material-symbols-outlined">description</span></div><div class="ripasso-info"><h3>Practica con tus notas</h3><p>${appuntiCount} frases guardadas</p></div><span class="ripasso-arrow material-symbols-outlined">chevron_right</span></article>`;
    } else {
      ripassoBox.innerHTML=``;
    }
    const next=getNextSong(current);
    nextBox.innerHTML= (next ? `<div class="eyebrow mb-2">PRÓXIMA CANCIÓN</div><article class="next-song-card"><div class="next-song-lock"><span class="material-symbols-outlined">lock</span></div><div><h3>${escapeHtml(next.title)}</h3><p>Completa las misiones para desbloquearla.</p></div></article>` : '<div class="next-song-card"><div class="next-song-lock">🏁</div><div><h3>Última canción del recorrido</h3><p>Completa las misiones para terminar el recorrido.</p></div></div>');
  }
  function updateNavigation(view) {
    const header = document.getElementById('mainHeader');
    const notebookButton = document.getElementById('navNotebook');
    if (!header) return;

    header.classList.toggle('d-none', view === 'song');
    if (notebookButton) notebookButton.style.display = view === 'home' ? 'inline-flex' : 'none';
  }

  function hidePrimaryViews() {
    document.getElementById('progressionHome')?.classList.add('d-none');
    document.getElementById('libreria')?.classList.add('d-none');
    document.getElementById('appuntiSection')?.classList.add('d-none');
    document.getElementById('settings')?.classList.add('d-none');
    document.getElementById('song').classList.add('d-none');
    document.getElementById('fixedPlayer').classList.add('d-none');
    document.getElementById('esercizi')?.classList.add('d-none');
  }

  function resetSongViewState() {
    if (currentSongId !== null) stopSong(currentSongId);
    document.getElementById('songPlayer').innerHTML = '';
    audioPlayers = {};
    _playerSongId = null;
    currentSongId = null;
    currentSongBackup = null;
    _exerciseMode = false;
    _exerciseQueue = [];
    _exerciseIndex = 0;
    swapLanguages = false;
    _reviewMode = false;
    _ripassoMode = false;
    _exercisePhase = 'translation';
    if (_exerciseTimer) { clearInterval(_exerciseTimer); _exerciseTimer = null; }
  }

  function hideAppLoader() {
    const el = document.getElementById('appLoader');
    if (el) el.style.display = 'none';
  }

  async function showHomeView() {
    const token = ++_loadToken;
    hidePrimaryViews();
    document.getElementById('loadingMessage').innerHTML = '<span class="loading-spinner"></span> <span>Cargando...</span>';
    document.getElementById('loadingMessage').style.display = "block";
    hideBottomNav();
    updateBottomNav('home');
    resetSongViewState();
    document.body.classList.remove('view-song');
    updateNavigation('home');
    window.scrollTo(0, 0);

    try {
      await renderProgressionHome();
    } catch (e) {
      console.error('Errore caricamento home:', e);
    }

    // Difesa race: se showHomeView è ancora in corso (avviata prima del funnel,
    // es. da boot.js) la sua continuation non deve ri-mostrare home/navbar
    // mentre l'onboarding è attivo.
    if (token !== _loadToken || _onboardingActive) return;
    document.getElementById('loadingMessage').style.display = "none";
    document.getElementById('progressionHome').classList.remove('d-none');
    showBottomNav();
    hideAppLoader();
  }

  function openNotebookView() {
    _loadToken++;
    document.getElementById('loadingMessage').style.display = "none";
    updateBottomNav('appunti');
    resetSongViewState();
    hidePrimaryViews();
    document.getElementById('appuntiSection')?.classList.remove('d-none');
    updateNavigation('notebook');
    // Ripristina il padding normale del body
    document.body.classList.remove('view-song');

    _appuntiSwap = false;
    _appuntiStudyMode = false;
    const filters = document.querySelector('.appunti-filters');
    if (filters) filters.style.display = 'none';
    const filterToggle = document.getElementById('appuntiFilterToggle');
    if (filterToggle) filterToggle.classList.remove('active');

    popolaFiltriAppunti();
    renderAppuntiAuto();
    window.scrollTo(0, 0);
  }

  function showLibreria() {
    _loadToken++;
    document.getElementById('loadingMessage').style.display = "none";
    updateBottomNav('library');
    _ripassoMode = false;
    // Ferma la canzone in riproduzione prima di cambiare vista (navbar)
    if (currentSongId !== null) stopSong(currentSongId);
    hidePrimaryViews();
    document.getElementById('libreria').classList.remove('d-none');
    updateNavigation('library');
    // Ripristina il padding normale del body
    document.body.classList.remove('view-song');
    window.scrollTo(0, 0);
    renderLibreriaSongs(); // al final hace scrollIntoView hasta el curso abierto (canción actual)
  }

  function openSettingsView() {
    _loadToken++;
    document.getElementById('loadingMessage').style.display = "none";
    updateBottomNav('settings');
    _ripassoMode = false;
    resetSongViewState();
    hidePrimaryViews();
    document.getElementById('settings').classList.remove('d-none');
    updateNavigation('settings');
    document.body.classList.remove('view-song');
    try { renderCodiceUtente(); } catch (e) { console.warn('[settings] render codice:', e); }
    try { renderSettingsStats(); } catch (e) { console.warn('[settings] render stats:', e); }
    window.scrollTo(0, 0);
  }

  function renderSettingsStats() {
    const el = document.getElementById('settingsStats');
    if (!el || !songs) return;
    const p = getProgress();
    const completedIds = (p.completedSongIds || []).map(String);
    const completed = completedIds.length;
    const groups = raggruppaPerCorso();
    const completedCourses = groups.filter(g => g.songs.every(({ song }) => completedIds.includes(String(song.id)))).length;
    el.innerHTML = `
      <div class="settings-stat"><span class="settings-stat-num">${completed}</span><span>canciones completadas</span></div>
      <div class="settings-stat"><span class="settings-stat-num">${songs.length}</span><span>canciones totales</span></div>
      <div class="settings-stat"><span class="settings-stat-num">${completedCourses}</span><span>cursos completados (de ${groups.length})</span></div>`;
  }

  // Costruisce una voce di progresso "completata" per una canzone, riempiendo
  // anche strofe aperte, frasi salvate, ascolti e sfide in modo che la UI
  // mostri tutte le missioni come completate. È volontariamente SINCRONA:
  // usa solo i testi già caricati (se presenti) e nulla di rete, così il
  // loop di applicazione resta istantaneo e non supera il limite del preview.
  function buildCompleteSongEntry(song) {
    const verseKeys = uniqueMainVerseKeys((song && song.lyrics) || []);
    const openedVerseKeys = verseKeys.slice();
    // Servono REQUIRED_NOTES frasi salvate valide; se non ce ne sono
    // abbastanza, aggiungi segnaposto per raggiungere il requisito.
    const savedNoteKeys = verseKeys.slice(0, REQUIRED_NOTES());
    while (savedNoteKeys.length < REQUIRED_NOTES()) {
      savedNoteKeys.push('__test_note_' + Math.random().toString(36).slice(2, 8));
    }
    return {
      completed: true,
      completedAt: Date.now(),
      openedVerseKeys,
      savedNoteKeys,
      listenedCount: REQUIRED_LISTENS(),
      completedSfideCount: REQUIRED_SFIDE()
    };
  }

  // Applica uno scenario di avanzamento in modo deterministico (parte sempre
  // da zero): kind = 'partial' (primo corso completato) oppure 'total'.
  // Interamente sincrono: nessuna chiamata di rete nel loop.
  function applyProgressScenario(kind) {
    const groups = raggruppaPerCorso();
    const p = defaultProgress(); // reset al progresso vuoto

    if (kind === 'total') {
      groups.forEach(g => g.songs.forEach(({ song }) => {
        p.songs[String(song.id)] = buildCompleteSongEntry(song);
        p.completedSongIds.push(song.id);
      }));
    } else if (kind === 'partial' && groups.length > 0) {
      groups[0].songs.forEach(({ song }) => {
        p.songs[String(song.id)] = buildCompleteSongEntry(song);
        p.completedSongIds.push(song.id);
      });
    }

    // currentSongId = prima canzone del corso successivo (partial) o null (total)
    if (kind === 'partial' && groups.length > 1) {
      const next = groups[1].songs[0].song;
      p.currentSongId = next ? next.id : null;
    } else {
      p.currentSongId = null;
    }

    saveProgress(p);
    return p;
  }

  function setProgressPartial() {
    applyProgressScenario('partial');
    showToast('✅ Progreso parcial aplicado: <strong>primer curso completado</strong>.');
    showHomeView();
  }

  function setProgressTotal() {
    applyProgressScenario('total');
    showToast('🏁 Progreso total aplicado: <strong>todas las canciones completadas</strong>.');
    showHomeView();
  }

  // Simula un nuevo usuario desde el primer arranque (vuelve a aparecer la
  // selección de idioma). Se reescribe el progresso y la elección de idioma,
  // se reinicia la propina de Mercado Pago, pero se CONSERVAN las notas.
  async function resetProgressToNewUser() {
    try { localStorage.removeItem('onboardingCompleted'); } catch (e) {}
    try { localStorage.removeItem(PROGRESS_KEY); } catch (e) {}
    try { localStorage.removeItem('appLangChoice'); } catch (e) {}
    try { localStorage.removeItem('mpCursosOfertados'); } catch (e) {}
    // Azzera anche il registro anti-duplicati degli eventi mission_completed:
    // senza questa pulizia, dopo un reset le missioni ri-completate non
    // verrebbero mai più loggate (le chiavi appMissionLogged_<songId> restano).
    try {
      Object.keys(localStorage)
        .filter(k => k.indexOf('appMissionLogged_') === 0)
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    // Conserva 'mieiAppunti' y reconstruye el índice en memoria y el badge.
    rebuildSavedIndex();
    updateAppuntiBadge();

    // Recarga la lista completa de canciones (como al primer arranque).
    try { songs = await fetchSongs(); } catch (e) {}

    hideBottomNav();
    if (songs.length > 0) {
      // Clona i bottoni della modale per evitare di accumulare listener
      // duplicati quando si ri-simula il primo avvio più volte.
      const itDe = document.getElementById('langChoiceItDe');
      const esIt = document.getElementById('langChoiceEsIt');
      if (itDe) itDe.replaceWith(itDe.cloneNode(true));
      if (esIt) esIt.replaceWith(esIt.cloneNode(true));
      // appLangChoice está vacío → aplicaSceltaLingua muestra la modale.
      applicaSceltaLingua();
    } else {
      showHomeView();
    }
  }

  async function openCurrentSong() { const s=getCurrentSong(); if (s) { _exerciseMode=false; _exerciseQueue=[]; _exerciseIndex=0; _reviewMode=false; await openSong(s.id); } }
  async function openSongStudyMode() {
    const s=getCurrentSong();
    if (!s) return;
    _exerciseMode = true;
    _exerciseQueue = [];
    _exerciseIndex = 0;
    _reviewMode = false;
    _ripassoMode = false;
    await openSong(s.id);
    // Apri la sezione nascosta degli esercizi con lo stesso layout del ripasso.
    if (!_exerciseMode) return;
    hidePrimaryViews();
    document.body.classList.remove('view-song');
    document.getElementById('esercizi').classList.remove('d-none');
    updateNavigation('home');
    updateBottomNav('home');
    window.scrollTo(0, 0);
    if (_exerciseQueue.length === 0) generaCodaEsercizi(currentSongBackup);
    renderCurrentExercise();
  }
  async function openCompletedSong(id) { _exerciseMode=false; _exerciseQueue=[]; _exerciseIndex=0; _reviewMode=true; await openSong(id); }
  function recordVerseExplored(index) {
    if (_reviewMode || !currentSongBackup) return;
    const song = currentSongBackup;
    const before = missionState(song);
    const lyric=song.lyrics[index], key=normalizeProgressKey(lyric?.text1); if(!key) return;
    const p=getProgress(), sp=p.songs[String(song.id)] || ensureSongProgress(song.id);
    if (!(sp.openedVerseKeys||[]).includes(key)) sp.openedVerseKeys.push(key);
    saveProgress(p); markExploredTiles(); checkSongCompletion(song);
    trackMissionCompletion(song);
    renderFixedPlayerMissions();
    maybeShowMissionFeedback(before, missionState(song));
  }
  function markExploredTiles() {
    if(!currentSongBackup) return;
    const opened=new Set(ensureSongProgress(currentSongBackup.id).openedVerseKeys||[]);
    document.querySelectorAll('.verse[data-index]').forEach(v => { const i=Number(v.dataset.index), key=normalizeProgressKey(currentSongBackup.lyrics[i]?.text1); v.classList.toggle('explored-verse',opened.has(key)); });
  }
  function recordSavedNoteForProgress(text) {
    if (_reviewMode || !currentSongBackup) return;
    const song = currentSongBackup;
    const before = missionState(song);
    const p=getProgress(), sp=p.songs[String(song.id)] || ensureSongProgress(song.id), key=normalizeProgressKey(text); if(!key) return;
    if(!(sp.savedNoteKeys||[]).includes(key) && sp.savedNoteKeys.length<REQUIRED_NOTES()) sp.savedNoteKeys.push(key);
    saveProgress(p); checkSongCompletion(song);
    trackMissionCompletion(song);
    renderFixedPlayerMissions();
    maybeShowMissionFeedback(before, missionState(song));
  }
  function recordListen(songId) {
    if (_reviewMode || _onboardingActive) return;
    const current=getCurrentSong(); if(!current || String(current.id)!==String(songId)) return;
    const song = currentSongBackup || current;
    const before = missionState(song);
    const p=getProgress(), sp=p.songs[String(songId)] || ensureSongProgress(songId); sp.listenedCount=Math.min((sp.listenedCount||0)+1,REQUIRED_LISTENS()); saveProgress(p);
    checkSongCompletion(song);
    trackMissionCompletion(song);
    renderFixedPlayerMissions();
    maybeShowMissionFeedback(before, missionState(song));
  }
  function recordSfidaCompleta() {
    if (_onboardingActive || _ripassoMode || _reviewMode || !currentSongBackup) return;
    if (_sfidaCountedSession) return;
    _sfidaCountedSession = true;
    const p=getProgress(), sp=p.songs[String(currentSongBackup.id)] || ensureSongProgress(currentSongBackup.id); sp.completedSfideCount=Math.min((sp.completedSfideCount||0)+1,REQUIRED_SFIDE()); saveProgress(p);
    checkSongCompletion(currentSongBackup);
    trackMissionCompletion(currentSongBackup);
    renderFixedPlayerMissions();
  }
  function checkSongCompletion(song) {
    if (_reviewMode || _completionLock || !song) return;
    const p=getProgress(), sp=p.songs[String(song.id)], m=missionState(song);
    if(sp?.completed || !(m.translationsDone&&m.notesDone&&m.listensDone&&m.exercisesDone)) return;
    _completionLock=true; sp.completed=true; sp.completedAt=Date.now();
    logEvent('song_completed', { songId: String(song.id) });
    if(!(p.completedSongIds||[]).map(String).includes(String(song.id))) p.completedSongIds.push(song.id);
    const next=getNextSong(song); p.currentSongId=next?next.id:null; saveProgress(p); showCompletionModal(song,next);
  }
  function showCompletionModal(song,next) {
    document.getElementById('completionMessage').textContent=next ? ('¡Has desbloqueado: “'+next.title+'”') : '¡Has completado tutte le canzoni disponibili!';
    const nb=document.getElementById('completionNextBtn'); nb.style.display='none'; nb.onclick=null;
    document.getElementById('completionHomeBtn').onclick=function(){closeCompletionModal();location.reload();};
    document.getElementById('completionModal').classList.add('open');
  }
  function closeCompletionModal(){ document.getElementById('completionModal').classList.remove('open'); _completionLock=false; }

  function nomeCorso(song) {
    const raw = song && (song.Corso ?? song.corso);
    return (raw || '').toString().trim();
  }

  // Raggruppa le canzoni per corso mantenendo l'ordine di apparizione sul foglio.
  // L'ordine dei corsi è quello della prima comparsa; dentro ogni corso le canzoni
  // restano nell'ordine originale (più uno pseudo-ordine >0 per le canzoni in coda al foglio).
  function raggruppaPerCorso() {
    const groups = [];
    const indexByKey = new Map();
    let counter = 0;
    songs.forEach((s, idx) => {
      const nome = nomeCorso(s) || 'Otros';
      // === DEBUG ===
      console.log(`[gruppo] idx=${idx} title="${s.title}" id=${s.id} corso="${nomeCorso(s)}" rawCorso=${JSON.stringify(s.Corso)} rawCorsoMin=${JSON.stringify(s.corso)}`);
      // ============
      const key = normalizza(nome);
      let g = indexByKey.get(key);
      if (!g) {
        g = { nome, key, order: counter++, songs: [] };
        indexByKey.set(key, g);
        groups.push(g);
      }
      g.songs.push({ song: s, sheetOrder: idx + 1 });
    });
    return groups;
  }

  function courseCardHtml(s, completedIds, currentSong) {
    const sId = String(s.id);
    const isCompleted = completedIds.includes(sId);
    const isCurrent = currentSong && String(currentSong.id) === sId;
    const isUnlocked = isCompleted || isCurrent;

    const badge = isCompleted
      ? '<span class="course-song-badge course-song-completed">COMPLETADA</span>'
      : '<span class="course-song-badge course-song-current">ACTUAL</span>';

    if (isUnlocked) {
      return `
        <div class="course-song-row" role="button" tabindex="0" onclick="openCompletedSong('${s.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openCompletedSong('${s.id}')}">
          <div class="course-song-meta">
            ${badge}
            <h3 class="course-song-title">${escapeHtml(s.title)}</h3>
            <p class="course-song-sub">${s.artist ? escapeHtml(s.artist) + ' ' : ''}(${escapeHtml(s.lang1)} / ${escapeHtml(s.lang2)})</p>
          </div>
          <span class="course-song-chevron material-symbols-outlined">chevron_right</span>
        </div>
      `;
    }

    return `
      <div class="course-song-row course-song-locked">
        <div class="course-song-lock">
          <span class="material-symbols-outlined">lock</span>
        </div>
        <div class="course-song-meta">
          <h3 class="course-song-title">${escapeHtml(s.title)}</h3>
          <p class="course-song-sub">${s.artist ? escapeHtml(s.artist) + ' ' : ''}(${escapeHtml(s.lang1)} / ${escapeHtml(s.lang2)})</p>
        </div>
      </div>
    `;
  }
// ==================== MERCADO PAGO POR CURSO ====================
  // Persistencia: el curso se marcará como "ofrecido" (por localStorage) SOLO
  // cuando el usuario acepta donar (o se marca automáticamente el primer curso).
  // El conjunto _skipMp guarda en memoria (NO persistente) los cursos en los que
  // el usuario eligió "No": así la propuesta reaparece en la próxima visita pero
  // no se vuelve a insistir dentro de la misma sesión tras un "No".
  let _skipMp = new Set();
  // Estado de la pestaña activa por curso (in-memory): 'songs' | 'temas'.
  let _cursoTabs = {};

  // Descrizione del corso caricata dal backend (foglio "Corsi", colonna "Descrizione").
  // courseKey è la chiave normalizzata del nome corso (stessa usata da courseDescriptions).
  // Se restituisce '', si nasconde la scheda "Argomenti".
  function cursoDescripcion(courseKey) {
    return (courseDescriptions && courseDescriptions[courseKey]) || '';
  }

  // Converte la descrizione dal formato backoffice (righe con "-" inizio riga)
  // in un elenco puntato HTML (<ul><li>...</li></ul>).
  function descripcionToListHtml(descripcion) {
    if (!descripcion) return '';
    // Normalizza i newline (accetta sia \n che \r\n)
    const righe = descripcion.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const items = righe.map(riga => {
      // Rimuove il trattino iniziale se presente
      const testo = riga.replace(/^-/, '').trim();
      return testo ? `<li>${escapeHtml(testo)}</li>` : '';
    }).filter(Boolean);
    if (items.length === 0) return escapeHtml(descripcion);
    return `<ul class="course-temas-list">${items.join('')}</ul>`;
  }

  // Persistencia: cada curso guarda si ya se ofreció la propina.
  function getCursosOfrecidos() {
    try {
      const raw = JSON.parse(localStorage.getItem('mpCursosOfertados') || '[]');
      return Array.isArray(raw) ? raw.map(String) : [];
    } catch(e) { return []; }
  }
  function cursoYaOfrecido(courseKey) {
    return getCursosOfrecidos().includes(String(courseKey));
  }
  function marcarCursoOfrecido(courseKey) {
    const arr = getCursosOfrecidos();
    const key = String(courseKey);
    if (!arr.includes(key)) {
      arr.push(key);
      localStorage.setItem('mpCursosOfertados', JSON.stringify(arr));
    }
  }
  function courseSafeId(courseKey) {
    return 'crs-' + String(courseKey).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  }
  // Gate de la donación: el tile de Mercado Pago solo se activa cuando el
  // usuario ya completó al menos una canción (en cualquier curso). Sin progreso
  // no se muestra ningún tile de propina en la librería.
  function hayProgresoMp() {
    try {
      const p = getProgress();
      return ((p.completedSongIds || []).length > 0);
    } catch (e) { return false; }
  }
  function mpTileHtml(courseKey, visible = true) {
    const safeId = courseSafeId(courseKey);
    return `
      <div class="course-group mp-tile" id="mp-tile-${safeId}" style="${visible ? '' : 'display:none;'}">
        <button class="mp-close-x" type="button" onclick="mpSkipClick('${escapeHtml(courseKey)}')" title="Cerrar y ver las canciones" aria-label="Cerrar"></button>
        <div class="mp-panel" id="mp-panel-1-${safeId}">
          <p class="mp-copy">Las canciones de este curso siempre serán <strong>gratis</strong> y <strong>disponibles</strong><br>Si te está gustando el proyecto, ayúdame a mejorarlo con una donación.</p>
          <button class="btn-open-mp" type="button" onclick="mpDonateClick('${escapeHtml(courseKey)}')">
            Quiero ayudar con una donacion
          </button>
          <button class="btn-skip-mp" type="button" onclick="mpSkipClick('${escapeHtml(courseKey)}')">
            No quiero, mostrame las canciones.
          </button>
        </div>
        <div class="mp-panel mp-panel-alias" id="mp-panel-2-${safeId}" style="display:none;">
          <div class="mp-alias-row">
            <p class="mp-alias">Alias: <strong>${escapeHtml(MP_ALIAS)}</strong></p>
            <button class="btn-copy-mp" type="button" onclick="mpCopyAlias('${escapeHtml(courseKey)}')" aria-label="Copiar alias" title="Copiar alias">
              <span class="material-symbols-outlined">content_copy</span>
            </button>
          </div>
          <p class="mp-owner">Nombre: Leonardo Salvador Mengon</p>
          <button class="btn-open-mp btn-logo-only" type="button" id="mp-open-btn-${safeId}" onclick="mpGoMP('${escapeHtml(courseKey)}')" aria-label="Ir a Mercado Pago" title="Ir a Mercado Pago">
            <img class="mp-logo" src="resources/mp-logo.png" alt="Ir a Mercado Pago">
          </button>
          <span class="mp-feedback" id="copyFeedback-${safeId}"></span>
        </div>
      </div>
    `;
  }
  function courseGroupCardHtml(g, completedIds, currentSong, isOpen, mpActivo) {
    const safeId = courseSafeId(g.key);
    const offered = cursoYaOfrecido(g.key);
    const skipped = _skipMp.has(String(g.key));
    const showMp = mpActivo && !offered && !skipped;
    const descripcion = cursoDescripcion(g.key);
    const tabActual = _cursoTabs[g.key] || 'songs';
    const tabSongs = tabActual === 'songs';
    const completedInCourse = g.songs.filter(({ song }) => completedIds.includes(String(song.id))).length;
    const songsHtml = g.songs.map(({ song, sheetOrder }) => courseCardHtml(song, completedIds, currentSong)).join('');
    const mpBlock = showMp ? mpTileHtml(g.key, tabSongs) : '';
    const hideSongs = isOpen && showMp;
    const tabsHtml = descripcion
      ? `
        <div class="course-tabs">
          <button type="button" class="course-tab ${tabSongs ? 'active' : ''}" onclick="setCourseTab('${escapeHtml(g.key)}','songs')">🎵 Canciones</button>
          <button type="button" class="course-tab ${tabSongs ? '' : 'active'}" onclick="setCourseTab('${escapeHtml(g.key)}','temas')">📚 Temario</button>
        </div>`
      : '';
    const songsStyle = `${hideSongs ? 'display:none;' : ''}${tabSongs ? '' : 'display:none;'}`;
    const temasStyle = tabSongs ? 'display:none;' : '';
    const temasHtml = descripcion
      ? `<div class="course-temas-body" id="course-temas-${safeId}" style="${temasStyle}">${descripcionToListHtml(descripcion)}</div>`
      : '';
    return `
      <div class="course-group ${isOpen ? 'open' : ''}" data-course-key="${escapeHtml(g.key)}">
        <button class="course-header" type="button" onclick="toggleCourse('${escapeHtml(g.key)}')">
          <span class="course-title">${escapeHtml(g.nome)}</span>
          <span class="course-count">${completedInCourse}/${g.songs.length}</span>
          <span class="course-chevron material-symbols-outlined">expand_more</span>
        </button>
        <div class="course-body" style="${isOpen ? '' : 'display:none;'}">
          ${tabsHtml}
          ${mpBlock}
          <div class="course-song-list" id="course-songs-${safeId}" style="${songsStyle}">
            ${songsHtml}
          </div>
          ${temasHtml}
        </div>
      </div>
    `;
  }

  function setCourseTab(courseKey, tab) {
    _cursoTabs[courseKey] = tab === 'temas' ? 'temas' : 'songs';
    const safeId = courseSafeId(courseKey);
    const songsEl = document.getElementById('course-songs-' + safeId);
    const temasEl = document.getElementById('course-temas-' + safeId);
    const tileEl = document.getElementById('mp-tile-' + safeId);
    // En "Argomenti" se oculta la propuesta de donación; vuelve a "Canzoni"
    // solo si el curso sigue sin donar/saltar.
    const mpVisible = tab === 'songs' && hayProgresoMp() && !cursoYaOfrecido(courseKey) && !_skipMp.has(String(courseKey));
    if (tileEl) tileEl.style.display = mpVisible ? '' : 'none';
    if (songsEl) {
      // Si la propina vuelve a estar visible, las canciones siguen ocultas.
      songsEl.style.display = (tab === 'temas' || mpVisible) ? 'none' : '';
    }
    if (temasEl) temasEl.style.display = (tab === 'temas') ? '' : 'none';
    // Resalta la pestaña activa dentro del curso.
    const group = document.querySelector(`.course-group[data-course-key="${CSS.escape(courseKey)}"]`);
    if (group) {
      group.querySelectorAll('.course-tab').forEach(btn => {
        const isTemas = btn.getAttribute('onclick').indexOf("'temas'") !== -1;
        btn.classList.toggle('active', (tab === 'temas') === isTemas);
      });
    }
  }

  function toggleCourse(courseKey) {
    // Comportamiento tipo acordeón: solo puede haber un curso abierto a la vez.
    if (_openCourses.has(courseKey)) {
      _openCourses.clear();
    } else {
      _openCourses = new Set([courseKey]);
    }
    document.querySelectorAll('.course-group').forEach(group => {
      const key = group.dataset.courseKey;
      const isOpen = _openCourses.has(key);
      group.classList.toggle('open', isOpen);
      const body = group.querySelector('.course-body');
      if (body) body.style.display = isOpen ? '' : 'none';
      // Si es un curso abierto y aún no ha recibido la oferta, oculta las
      // canciones y muestra solo el botón de propina (hasta que se done o se
      // elija "No"). La propina solo se activa cuando el usuario ya completó
      // al menos una canción, y se oculta si el usuario está en la pestaña
      // "Argomenti".
      const mpActivo = hayProgresoMp();
      const showMp = mpActivo && !cursoYaOfrecido(key) && !_skipMp.has(String(key));
      const tabActual = _cursoTabs[key] || 'songs';
      if (isOpen && showMp) {
        const songsEl = group.querySelector('.course-song-list');
        const tileEl = document.getElementById('mp-tile-' + courseSafeId(key));
        if (tabActual === 'songs') {
          if (songsEl) songsEl.style.display = 'none';
          if (tileEl) tileEl.style.display = '';
        } else {
          if (songsEl) songsEl.style.display = 'none';
          if (tileEl) tileEl.style.display = 'none';
        }
      }
    });
  }

  function renderLibreriaSongs() {
    const list = document.getElementById('completedSongsList');
    const empty = document.getElementById('completedEmpty');

    if (!songs || songs.length === 0) {
      empty.classList.remove('d-none');
      list.innerHTML = '';
      return;
    }

    const p = getProgress();
    const completedIds = (p.completedSongIds || []).map(String);
    const currentSong = getCurrentSong();
    const groups = raggruppaPerCorso();

    // Al entrar a la librería se abre siempre el curso de la canción actual;
    // el resto de los cursos quedan cerrados (sin recordar otros estados).
    let targetCourse = null;
    if (currentSong) {
      targetCourse = groups.find(g => g.songs.some(({ song }) => String(song.id) === String(currentSong.id))) || null;
    }
    if (!targetCourse && groups.length > 0) {
      targetCourse = groups[0];
    }
    // 1) Cerrar primero todos los demás cursos
    _openCourses.clear();

    // 2) Abrir después el curso de la canción actual
    if (targetCourse) _openCourses.add(targetCourse.key);

    // 3) El primer curso de la lista siempre muestra sus canciones directamente:
    //    se marca como "ya ofrecido" para que el botón de Mercado Pago
    //    nunca se cargue en él.
    if (groups.length > 0) marcarCursoOfrecido(groups[0].key);

    // La propina se activa solo cuando hay al menos una canción completada.
    const mpActivo = hayProgresoMp();

    list.innerHTML = groups.map(g => courseGroupCardHtml(g, completedIds, currentSong, _openCourses.has(g.key), mpActivo)).join('');

    empty.classList.toggle('d-none', songs.some(s => completedIds.includes(String(s.id))));

    // Desplaza la vista hasta el curso que quedó abierto (el de la canción actual).
    if (_openCourses.size > 0) {
      const key = [..._openCourses][0];
      const groupEl = document.querySelector(`.course-group[data-course-key="${CSS.escape(key)}"]`);
      if (groupEl) groupEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function showBottomNav() { const n = document.querySelector('.bottom-nav'); if (n) n.classList.remove('d-none'); }
  function hideBottomNav() { const n = document.querySelector('.bottom-nav'); if (n) n.classList.add('d-none'); }

  function updateBottomNav(activeView) {
    // Mappa gli ID dei pulsanti della bottom nav
    const navItems = {
      'home': document.getElementById('bottomNavHome'),
      'library': document.getElementById('bottomNavLibrary'),
      'appunti': document.getElementById('bottomNavAppunti'),
      'settings': document.getElementById('bottomNavSettings') // Se presente
    };

    // Rimuovi la classe 'active' da tutti e attivalo solo su quello corrente
    Object.keys(navItems).forEach(key => {
      if (navItems[key]) {
        if (key === activeView) {
          navItems[key].classList.add('active');
        } else {
          navItems[key].classList.remove('active');
        }
      }
    });
  }

  function mpDonateClick(courseKey) {
    const safeId = courseSafeId(courseKey);
    // Passa dalla prima alla seconda schermata (alias + azioni) e mostra la X.
    const panel1 = document.getElementById('mp-panel-1-' + safeId);
    const panel2 = document.getElementById('mp-panel-2-' + safeId);
    const closeX = document.querySelector(`#mp-tile-${safeId} .mp-close-x`);
    if (panel1) panel1.style.display = 'none';
    if (panel2) panel2.style.display = 'flex';
    if (closeX) closeX.style.display = 'block';
  }

  function mpCopyAlias(courseKey) {
    const safeId = courseSafeId(courseKey);
    const feedback = document.getElementById('copyFeedback-' + safeId);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(MP_ALIAS).then(function() {
        if (feedback) { feedback.textContent = '✅ ¡Alias copiado!'; feedback.style.color = '#1DB954'; }
      }).catch(function() {
        if (feedback) copiaFallback(feedback);
      });
    } else if (feedback) {
      copiaFallback(feedback);
    }
  }

  function mpGoMP(courseKey) {
    // Copia sempre l'alias, prima di navigare (fire-and-forget, senza await:
    // aspettare consumerebbe il gesto del tap e la navigazione potrebbe
    // cancellare le scritture negli appunti se fatte dopo).
    mpCopyAlias(courseKey);
    // Mostra subito lo stato "apertura wallet": NON mostrare le canzoni qui.
    // Le canzoni si mostrano solo quando la webapp torna visibile (ritorno
    // dal wallet), via listener visibilitychange qui sotto.
    const safeId = courseSafeId(courseKey);
    const openBtn = document.getElementById('mp-open-btn-' + safeId);
    if (openBtn && !openBtn.disabled) {
      openBtn.disabled = true;
      openBtn.setAttribute('aria-disabled', 'true');
      openBtn.innerHTML = '<span class="mp-opening"><span class="mp-spinner" aria-hidden="true"></span><span>Abriendo Mercado Pago…</span></span>';
    }
    // Sblocca il corso alla prima partenza verso il wallet.
    const mpRevealCourse = function() {
      try { marcarCursoOfrecido(courseKey); } catch (e) {}
      try {
        const songsEl = document.getElementById('course-songs-' + safeId);
        if (songsEl) songsEl.style.display = 'flex';
        const tileEl = document.getElementById('mp-tile-' + safeId);
        if (tileEl) tileEl.style.display = 'none';
        _cursoTabs[courseKey] = 'songs';
        const temasEl = document.getElementById('course-temas-' + safeId);
        if (temasEl) temasEl.style.display = 'none';
      } catch (e) {}
    };
    let _mpRevealed = false;
    const mpRevealOnce = function() {
      if (_mpRevealed) return;
      _mpRevealed = true;
      mpRevealCourse();
    };
    const mpUrl = 'https://www.mercadopago.com.ar/';
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.mercadopago.wallet';
    const ua = (navigator.userAgent || '');
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    if (isAndroid) {
      // Custom-scheme registrato nativamente dal wallet (verificato come
      // funzionante): apre l'app se installata, altrimenti va al Play Store.
      // NON usare scheme=https://www.mercadopago.com.ar/ qui: è un App-Link
      // che richiede assetlinks/verifica dominio e altrimenti ricade sul sito
      // senza aprire l'app ("non parte").
      const intentUrl = 'intent://home#Intent;scheme=mercadopago;' +
        'package=com.mercadopago.wallet;' +
        'S.browser_fallback_url=' + encodeURIComponent(playStoreUrl) + ';end';
      // Una sola navigazione, dentro il gesto del tap, via <a> cliccato:
      // più affidabile di window.top.location.href (bloccato in iframe/sandbox
      // senza allow-top-navigation) e non sovrascritta da un secondo timeout.
      let fallbackTimer = null;
      const cancelFallback = function() {
        if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
      };
      window.addEventListener('blur', cancelFallback, { once: true });
      document.addEventListener('visibilitychange', function onVis() {
        if (document.visibilityState === 'hidden') {
          cancelFallback();
          document.removeEventListener('visibilitychange', onVis);
          // Al ritorno in primo piano (ritorno dal wallet), sblocca il corso.
          document.addEventListener('visibilitychange', function onBack() {
            if (document.visibilityState === 'visible') {
              document.removeEventListener('visibilitychange', onBack);
              mpRevealOnce();
            }
          });
        }
      });
      window.addEventListener('pagehide', cancelFallback, { once: true });
      try {
        const a = document.createElement('a');
        a.href = intentUrl;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() { try { document.body.removeChild(a); } catch (e2) {} }, 500);
      } catch (e) {
        try { window.location.href = intentUrl; } catch (e2) {}
      }
      // Fallback al Play Store (non al sito): solo se dopo 2.5s la pagina è
      // ancora visibile = l'app non si è aperta (non installata o intent
      // bloccato, es. WebView/in-app browser). Se il wallet si è aperto, il
      // browser va in background e questo timeout viene cancellato sopra.
      fallbackTimer = setTimeout(function() {
        try {
          if (document.visibilityState === 'visible') window.location.href = playStoreUrl;
        } catch (e) {}
      }, 2500);
    } else if (isIOS) {
      // iOS: Universal Link top-level nel gesto del tap. Anche qui le canzoni
      // si mostrano solo al ritorno in primo piano (ritorno dal wallet).
      document.addEventListener('visibilitychange', function onBackIOS() {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', onBackIOS);
          mpRevealOnce();
        }
      });
      try { window.top.location.href = mpUrl; }
      catch(e) { window.location.href = mpUrl; }
    } else {
      // Desktop: nessuna app wallet, apri il sito in una nuova scheda e
      // sblocca al ritorno sulla scheda (o subito se la visibility API manca).
      let revealed = false;
      const revealOnce = function() { if (!revealed) { revealed = true; mpRevealOnce(); } };
      document.addEventListener('visibilitychange', function onBackDesk() {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', onBackDesk);
          revealOnce();
        }
      });
      // Sicurezza: se la scheda non va mai in background, sblocca comunque
      // dopo 3s (l'utente ha comunque cliccato verso MP).
      setTimeout(revealOnce, 3000);
      window.open(mpUrl, '_blank');
    }
  }

  function mpSkipClick(courseKey) {
    const safeId = courseSafeId(courseKey);
    // Solo in memoria (non persistente): la proposta riapparirà alla prossima
    // visita/ricaricamento, ma non viene ripetuta nella stessa sessione.
    _skipMp.add(String(courseKey));
    // Mostra subito le canzoni del corso.
    const songsEl = document.getElementById('course-songs-' + safeId);
    if (songsEl) songsEl.style.display = 'flex';
    const tileEl = document.getElementById('mp-tile-' + safeId);
    if (tileEl) tileEl.style.display = 'none';
    // Vuelve a la vista de canciones tras saltar.
    _cursoTabs[courseKey] = 'songs';
    const temasEl = document.getElementById('course-temas-' + safeId);
    if (temasEl) temasEl.style.display = 'none';
    const grp = document.querySelector(`.course-group[data-course-key="${CSS.escape(courseKey)}"]`);
    if (grp) grp.querySelectorAll('.course-tab').forEach(btn => {
      const isTemas = btn.getAttribute('onclick').indexOf("'temas'") !== -1;
      btn.classList.toggle('active', !isTemas);
    });
  }

  function copiaFallback(feedback) {
    try {
      var ta = document.createElement('textarea');
      ta.value = MP_ALIAS;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) {
        feedback.textContent = '✅ ¡Alias copiado!';
        feedback.style.color = '#1DB954';
      } else {
        feedback.textContent = '⚠️ Mantén presionado "' + MP_ALIAS + '" para copiar';
        feedback.style.color = '#FF6A00';
      }
    } catch(e) {
      feedback.textContent = '⚠️ Mantén presionado "' + MP_ALIAS + '" para copiar';
      feedback.style.color = '#FF6A00';
    }
  }

