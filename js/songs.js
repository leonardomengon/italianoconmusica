      // ==================== OVERLAY ALTERNATIVE ====================
      function openOverlay(e, index) {
        e.stopPropagation();
        const song = songs.find(s => String(s.id) === String(currentSongId));
        if (!song || !song.lyrics || !song.lyrics[index]) return;

        const altText = song.lyrics[index].alternative;
        const container = document.getElementById("altPhrasesContainer");

        if (altText && altText.trim() !== "") {
          const lines = altText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line !== '');

          _currentAlternatives = lines.map(line => {
            const match = line.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
            if (match) {
              return { original: match[1].trim(), translated: match[2].trim() };
            } else {
              return { original: line, translated: '' };
            }
          });

          container.innerHTML = _currentAlternatives.map((item, altIndex) => {
            const { original, translated } = item;
            const mainText = swapLanguages && translated ? translated : original;
            const hiddenText = swapLanguages ? original : translated;
            const hasTranslation = hiddenText && hiddenText.trim() !== '';

            const isSavedFlag = isSaved(original);
            const starIcon = isSavedFlag ? '⭐' : '☆';
            const btnClass = isSavedFlag ? 'btn-outline-warning' : 'btn-outline-secondary';

            return `
              <div class="alt-phrase-item"
                  data-alt-index="${altIndex}"
                  onclick="toggleAltTranslation(${altIndex})">
                <div class="alt-phrase-main">
                  <div class="d-flex align-items-center gap-2 flex-grow-1">
                    <strong>${escapeHtml(mainText)}</strong>
                    ${hasTranslation
                      ? `<span class="toggle-hint" title="Haz clic para mostrar/ocultar la traducción">▼</span>`
                      : ''
                    }
                  </div>
                  <button type="button"
                          class="btn btn-sm ${btnClass} ms-2"
                          style="padding: 2px 8px; font-size: 14px; border-radius: 6px;"
                          data-alt-fav-index="${altIndex}"
                          onclick="event.stopPropagation(); togglePreferitoAltByIndex(this, ${altIndex});">
                    ${starIcon}
                  </button>
                </div>
                ${hasTranslation
                  ? `<div class="alt-phrase-translation" id="alt-translation-${altIndex}">${escapeHtml(hiddenText)}</div>`
                  : ''
                }
              </div>
            `;
          }).join('');

        } else {
          _currentAlternatives = [];
          container.innerHTML = '<p class="text-muted italic">No hay expresiones guardadas.</p>';
        }

        document.getElementById("altOverlay").style.display = "flex";
      }

      function toggleAltTranslation(altIndex) {
        const item = document.querySelector(`.alt-phrase-item[data-alt-index="${altIndex}"]`);
        const translationEl = document.getElementById(`alt-translation-${altIndex}`);
        if (!item || !translationEl) return;

        if (translationEl.style.display === "block") {
          translationEl.style.display = "none";
          item.classList.remove("active");
        } else {
          translationEl.style.display = "block";
          item.classList.add("active");
        }
      }

      function closeOverlay() { document.getElementById("altOverlay").style.display = "none"; }

      // ==================== FETCH ====================
      async function fetchSongs() {
        const messageEl = document.getElementById("message");
        messageEl.innerHTML = `<span class="loading-spinner" style="margin-right: 10px; vertical-align: middle;"></span><span style="vertical-align: middle;">Cargando...</span>`;
        messageEl.style.display = "block";
        messageEl.className = "text-center text-primary";
        // Prova dapprima il catalogo statico su Cloudinary (più veloce), poi fallback su API Google Sheets.
        let data = null;
        let source = 'cloudinary';
        try {
          console.log('[fetchSongs] Tentativo Cloudinary:', CATALOGO_URL);
          const res = await fetch(CATALOGO_URL);
          if (!res.ok) throw new Error(`HTTP ${res.status} da Cloudinary`);
          data = await res.json();
          if (!Array.isArray(data) || data.length === 0) throw new Error('Catalogo Cloudinary vuoto o non valido');
        } catch (cloudErr) {
          console.warn('[fetchSongs] Cloudinary fallito, uso fallback API Google Sheets:', cloudErr);
          source = 'api';
          try {
            const res2 = await fetch(API_URL + "?action=list");
            if (!res2.ok) throw new Error(`HTTP ${res2.status} da API`);
            data = await res2.json();
          } catch (apiErr) {
            messageEl.textContent = `Error: ${apiErr.message}. Inténtalo de nuevo más tarde.`;
            messageEl.style.color = "#F43F5E";
            return [];
          }
        }
        // Popola la mappa corso -> descrizione leggendo i dati caricati.
        courseDescriptions = {};
        (data || []).forEach(s => {
          const n = normalizza(s.corso);
          if (n && s.corsoDesc) courseDescriptions[n] = s.corsoDesc;
        });
        // === DEBUG: sorgente usata e primi elementi ===
        console.log(`[fetchSongs] SORGENTE USATA: ${source} | canzoni: ${(data||[]).length}`);
        console.log(`[fetchSongs] primo elemento (${source}):`, data && data[0]);
        console.log(`[fetchSongs] titoli (${source}):`, (data||[]).map(s => ({ title: s.title, id: s.id, corso: s.corso, lyrics: Array.isArray(s.lyrics) ? s.lyrics.length : '?' })));
        // ============================
        return data || [];
      }
      async function fetchLyrics(songId) {
        // Se la canzone è già nel catalogo Caricato (con lyrics), usa quella senza chiamate di rete.
        const cached = songs.find(s => String(s.id) === String(songId));
        if (cached && Array.isArray(cached.lyrics) && cached.lyrics.length) {
          console.log(`[getLyrics] id=${songId} (dalla cache Cloudinary) versi: ${cached.lyrics.length}`);
          return cached.lyrics;
        }
        console.log(`[getLyrics] id=${songId} lyrics non in cache, chiama API Google Sheets`);
        try {
          const response = await fetch(API_URL + `?action=getLyrics&id=${songId}`);
          const data = await response.json();
          console.log(`[getLyrics] id=${songId} risposta:`, data);
          console.log(`[getLyrics] n. versi ricevuti:`, (data.lyrics || []).length);
          return data.lyrics || [];
        } catch (error) { throw error; }
      }

      // ==================== RENDER CANZONI ====================
      function renderSongs(songsToRender) {
        const homeDiv = document.getElementById("home");
        homeDiv.innerHTML = "";
        if (songsToRender.length === 0) {
          homeDiv.innerHTML = '<div class="col-12 text-center py-4">No se encontraron canciones.</div>';
          return;
        }
        const start = currentPage * songsPerPage;
        const pageSongs = songsToRender.slice(start, start + songsPerPage);
        pageSongs.forEach((song) => {
          const songCard = document.createElement("div");
          songCard.className = "col-md-6 col-lg-4 song-card";
          songCard.innerHTML = `
            <div class="card h-100" onclick="openSong(${song.id})">
              <div class="card-body d-flex flex-column justify-content-between">
                <div>
                  <div class="d-flex justify-content-between align-items-start mb-3">
                    <span class="song-lang-pill">${escapeHtml(song.lang1)} / ${escapeHtml(song.lang2)}</span>
                    <span class="material-symbols-outlined song-icon">music_note</span>
                  </div>
                  <h5 class="card-title">${escapeHtml(song.title)}</h5>
                  <p class="card-text text-muted">${escapeHtml(song.artist)}</p>
                </div>
                <div class="start-pill">START</div>
              </div>
            </div>
          `;
          homeDiv.appendChild(songCard);
        });
        updatePagination(songsToRender);
      }
      function updatePagination(songsToRender) {
        const totalPages = Math.ceil(songsToRender.length / songsPerPage);
        document.getElementById("pagination").innerHTML = `
          <button id="prevPage" class="btn btn-outline-primary" ${currentPage === 0 ? 'disabled' : ''}>Anterior</button>
          <span id="pageInfo" class="align-self-center">Página ${currentPage + 1} de ${Math.max(totalPages, 1)}</span>
          <button id="nextPage" class="btn btn-outline-primary" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Siguiente</button>
        `;
        document.getElementById("prevPage").addEventListener("click", () => { currentPage--; filterAndSortSongs(); });
        document.getElementById("nextPage").addEventListener("click", () => { currentPage++; filterAndSortSongs(); });
      }

      // ==================== RENDER DETTAGLI CANZONE ====================
      function renderSongDetails(song, lyrics) {
        document.getElementById("home").classList.add("d-none");
        document.getElementById("searchControls").classList.add("d-none");
        document.getElementById("pagination").classList.add("d-none");
        document.getElementById("song").classList.remove("d-none");
        document.getElementById("fixedPlayer").classList.remove("d-none");
        document.getElementById("songTitle").textContent = song.title;
        document.getElementById("songArtist").textContent = song.artist
          ? `${song.artist} (${song.lang1} / ${song.lang2})`
          : `(${song.lang1} / ${song.lang2})`;
        // In modalità esercizi: nascondi toggle e header canzone (solo herocard)
        const swapToggle = document.querySelector('.song-actions-header .toggle-switch');
        if (swapToggle) swapToggle.style.display = _exerciseMode ? 'none' : 'inline-flex';
        const songHeaderEl = document.querySelector('#song .card-header');
        if (songHeaderEl) songHeaderEl.style.display = _exerciseMode ? 'none' : '';
        const songLyrics = document.getElementById("songLyrics");

        if (_exerciseMode) {
          // La modalità esercizi ora vive nella sezione nascosta #esercizi
          // (gestita da openSongStudyMode). Qui non mostriamo la vista canzone
          // né ne popoliamo i testi: generiamo solo la coda degli esercizi.
          document.getElementById("song").classList.add("d-none");
          document.getElementById("fixedPlayer").classList.add("d-none");
          if (_exerciseQueue.length === 0) {
            generaCodaEsercizi(song);
          }
          return;
        } else {
          if (lyrics.length > 0) {
            let lyricsHTML = '<div class="lyrics-container">';
            lyrics.forEach((lyric, index) => {
              const originalText = escapeHtml(lyric.text1);
              const translationText = escapeHtml(lyric.text2);
              const mainText = swapLanguages ? translationText : originalText;
              const hiddenText = swapLanguages ? originalText : translationText;
              const hasAlternative = lyric.alternative && lyric.alternative.trim() !== "";
              const altButtonHTML = hasAlternative
                ? `
                  <div id="alt-link-${index}" class="text-center mt-2 d-none">
                    <a href="#"
                      class="link-primary fw-semibold text-decoration-underline"
                      onclick="event.preventDefault(); event.stopPropagation(); openOverlay(event, ${index});">
                      Mostrar más
                    </a>
                  </div>
                `
                : '';
              const rawMain = swapLanguages ? (lyric.text2 || '') : (lyric.text1 || '');
              const isSavedFlag = isSaved(rawMain);
              const starIcon = isSavedFlag ? '⭐' : '☆';
              const btnClass = isSavedFlag ? 'btn-outline-warning' : 'btn-outline-secondary';
              const appunto = findAppuntoByTesto(rawMain);
              const notaValue = appunto ? escapeHtml(appunto.nota) : '';
              const saveBtnHtml = rawMain
                ? `
                  <button class="btn btn-sm ${btnClass} ms-2"
                    style="padding: 2px 8px; font-size: 14px; border-radius: 6px;"
                    data-lyric-index="${index}"
                    onclick="event.stopPropagation(); togglePreferito(this, ${index});">
                    ${starIcon}
                  </button>
                `
                : '';
              const noteHtml = isSavedFlag ? `
                <div class="verse-note" id="verse-note-${index}">
                  <textarea placeholder="Añade nota" onblur="saveNotaFromVerse(this, ${index})" onclick="event.stopPropagation()">${notaValue}</textarea>
                </div>
              ` : '';
              lyricsHTML += `
                <div class="verse" onclick="toggleTranslation(${index})" data-index="${index}">
                  <div class="d-flex justify-content-between align-items-center gap-2">
                    <div class="d-flex align-items-center gap-2 flex-grow-1">
                      <strong>${mainText || '<em>Texto no disponible</em>'}</strong>
                      <span class="toggle-hint" title="Haz clic para mostrar/ocultar la traducción">▼</span>
                    </div>
                    ${saveBtnHtml}
                  </div>
                  ${noteHtml}
                  <div class="translation" id="translation-${index}">
                    <span class="translation-text">
                      ${hiddenText || '<em>Traducción no disponible</em>'}
                    </span>
                  </div>
                  ${altButtonHTML}
                </div>
              `;
            });
            lyricsHTML += '</div>';
            songLyrics.innerHTML = lyricsHTML;
          } else {
            songLyrics.innerHTML = '<p class="text-center"><em>No hay texto disponible.</em></p>';
          }
        }
        updateFixedPlayer(song);
        setTimeout(markExploredTiles, 0);
        renderFixedPlayerMissions();
      }

    function updateFixedPlayer(song) {
      const songPlayer = document.getElementById("songPlayer");
      if (!songPlayer) return;

      // Evita di rigenerare il player se è già caricata la stessa canzone
      if (_playerSongId === song.id && document.getElementById('custom-player')) return;

      songPlayer.innerHTML = "";

      const id = song.id;
      const audioUrl = song.soundcloud_link;
      if (audioUrl) {
        songPlayer.innerHTML = `
          <div id="custom-player" class="py-2">
            <!-- Audio nascosto -->
            <audio id="audio-element" preload="metadata">
              <source src="${audioUrl}" type="audio/mpeg">
              Tu navegador no soporta el elemento de audio.
            </audio>

            <!-- Barra di progresso (sopra i bottoni) -->
            <div id="playerProgressWrap" class="mb-2">
              <div class="progress" style="height: 6px; background-color: #e9ecef;">
                <div id="progress-bar" class="progress-bar bg-primary" role="progressbar" style="width: 0%; pointer-events: none;"></div>
              </div>
              <div class="d-flex justify-content-between text-muted mt-1" style="font-size: 12px;">
                <span id="current-time">0:00</span>
                <span id="duration-time">0:00</span>
              </div>
            </div>

            <!-- Righe missioni / feedback: sostituiscono la barra sopra i bottoni -->
            <div id="playerMissionsSwap" class="player-missions-swap">
              <span id="missionFeedbackText" class="mission-feedback-text" hidden></span>
              <div id="missionProgressRows" class="course-missions-basic"></div>
            </div>

            <!-- Controlli centrati + bottone missioni tutto a destra -->
            <div class="player-controls-row d-flex align-items-center justify-content-center gap-2">
              <button id="btn-back" class="btn btn-primary px-4" title="Rebobinar 5 segundos"><span class="material-symbols-outlined">fast_rewind</span></button>
              <button id="play-btn" class="btn btn-primary px-3"><span id="play-icon" class="material-symbols-outlined">play_arrow</span></button>
              <button id="btn-forward" class="btn btn-primary px-3" title="Adelantar 5 segundos"><span class="material-symbols-outlined">fast_forward</span></button>
              <button id="missions-btn" class="btn btn-missions px-3" title="Ver misiones" onclick="toggleMissionsSwap(3000)"><span class="material-symbols-outlined">format_list_bulleted</span></button>
            </div>
          </div>
        `;

        const audioElement = document.getElementById('audio-element');
        const playBtn = document.getElementById('play-btn');
        const playIcon = document.getElementById('play-icon');
        const backBtn = document.getElementById('btn-back');
        const forwardBtn = document.getElementById('btn-forward');
        const progressBar = document.getElementById('progress-bar');
        const currentTimeEl = document.getElementById('current-time');
        const durationTimeEl = document.getElementById('duration-time');

        // Helper per formattare i secondi in minuti:secondi (es. 03:45)
        const formatTime = (seconds) => {
          if (isNaN(seconds)) return "0:00";
          const mins = Math.floor(seconds / 60);
          const secs = Math.floor(seconds % 60);
          return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        };

        audioElement.addEventListener('loadedmetadata', () => {
          durationTimeEl.textContent = formatTime(audioElement.duration);
        });

        audioElement.addEventListener('timeupdate', () => {
          if (audioElement.duration) {
            const percent = (audioElement.currentTime / audioElement.duration) * 100;
            progressBar.style.width = `${percent}%`;
            currentTimeEl.textContent = formatTime(audioElement.currentTime);
          }
        });

        playBtn.addEventListener('click', () => {
          if (audioElement.paused) {
            audioElement.play();
            playIcon.textContent = 'pause';
          } else {
            audioElement.pause();
            playIcon.textContent = 'play_arrow';
          }
        });

        backBtn.addEventListener('click', () => {
          audioElement.currentTime = Math.max(0, audioElement.currentTime - 5);
        });

        forwardBtn.addEventListener('click', () => {
          if (audioElement.duration) {
            audioElement.currentTime = Math.min(audioElement.duration, audioElement.currentTime + 5);
          }
        });

        audioElement.addEventListener('ended', () => {
          // Il loop (in initAudioPlayer) riavvia subito la riproduzione
          playIcon.textContent = 'pause';
          progressBar.style.width = '0%';
          currentTimeEl.textContent = '0:00';
        });

        // Registra e inizializza contatore + loop
        audioPlayers[id] = audioElement;
        _playerSongId = id;
        initAudioPlayer(audioElement, id);
      } else {
        songPlayer.innerHTML = '<div class="text-center text-muted py-2">No hay reproductor de audio disponible</div>';
      }
    }

      function toggleTranslation(index) {
        if (_exerciseMode) return;
        const translationEl = document.getElementById(`translation-${index}`);
        const verseEl = document.querySelector(`.verse[data-index="${index}"]`);
        const altLinkEl = document.getElementById(`alt-link-${index}`);
        // Chiudi tutti gli altri versi aperti, tranne quello cliccato
        document.querySelectorAll(".verse.active").forEach(activeVerse => {
          const activeIndex = activeVerse.dataset.index;
          if (Number(activeIndex) !== index) {
            const activeTranslationEl = activeVerse.querySelector(".translation");
            if (activeTranslationEl) activeTranslationEl.style.display = "none";
            activeVerse.classList.remove("active");
            const activeAltLinkEl = document.getElementById(`alt-link-${activeIndex}`);
            if (activeAltLinkEl) activeAltLinkEl.classList.add("d-none");
          }
        });

        if (translationEl.style.display === "block") {
          translationEl.style.display = "none";
          if (verseEl) verseEl.classList.remove("active");
          if (altLinkEl) altLinkEl.classList.add("d-none");
          // Scrolla il verso chiuso solo se necessario (minimo movimento)
          setTimeout(() => {
            verseEl.scrollIntoView({
              behavior: "smooth",
              block: "nearest"
            });
          }, 100);
        } else {
          translationEl.style.display = "block";
          recordVerseExplored(index);
          try { logEvent('verse_expanded', { verseId: positionalVerseId(currentSongId, index) }); } catch (e) {}
          if (verseEl) verseEl.classList.add("active");
          if (altLinkEl) altLinkEl.classList.remove("d-none");
          // Scrolla il verso cliccato solo se necessario (minimo movimento),
          // dopo che la traduzione si è espansa
          setTimeout(() => {
            verseEl.scrollIntoView({
              behavior: "smooth",
              block: "nearest"
            });
          }, 100);
        }
      }

      function swapLanguagesFunc() {
        swapLanguages = !swapLanguages;
        if (currentSongBackup) renderSongDetails(currentSongBackup, currentSongBackup.lyrics);
      }

