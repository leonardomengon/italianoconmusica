      // ==================== NAVIGAZIONE ====================
      async function openSong(songId) {
        const song = songs.find(s => String(s.id) === String(songId));
        if (!song) return;

        const token = ++_loadToken;
        hidePrimaryViews();
        updateNavigation('song');
        // Rimuovi il padding superiore del body per la visualizzazione della canzone
        document.body.classList.add('view-song');
        // Disattiva il toggle inverti lingue quando si apre una canzone
        swapLanguages = false;
        const swapLangBtn = document.getElementById('swapLangBtn');
        if (swapLangBtn) swapLangBtn.checked = false;
        // Mostra solo lo spinner durante il caricamento
        document.getElementById('loadingMessage').innerHTML = '<span class="loading-spinner"></span> <span>Cargando...</span>';
        document.getElementById('loadingMessage').style.display = "block";
        hideBottomNav();
        // Difesa: in apertura canzone il loader di app non deve mai restare
        // visibile (no-op se assente); evita blocchi con spinner infinito.
        if (typeof hideAppLoader === 'function') hideAppLoader();

        try {
          const lyrics = await fetchLyrics(songId);
          // Se l'utente ha cambiato schermata, annulla il caricamento
          if (token !== _loadToken) return;
          song.lyrics = lyrics;
          currentSongId = songId;
          currentSongBackup = song;
          _userSeeked[songId] = false;
          // Analytics: inizio funnel principale (canzone) o esercizi.
          // In modalità esercizi l'apertura è loggata come esercizio,
          // non come canzone.
          try {
            const _spCompleted = getProgress().songs[String(songId)] && getProgress().songs[String(songId)].completed;
            if (_exerciseMode) {
              logEvent('esercizio_started', { songId: String(songId) });
            } else {
              logEvent('song_started', { songId: String(songId) });
              if (_spCompleted) logEvent('song_reopened', { songId: String(songId) });
            }
          } catch (e) {}
          document.getElementById('loadingMessage').style.display = "none";
          document.getElementById('song').classList.remove('d-none');
          document.getElementById('fixedPlayer').classList.remove('d-none');
          showBottomNav();
          renderSongDetails(song, lyrics);
          window.scrollTo(0, 0);
        } catch (error) {
          if (token !== _loadToken) return;
          document.getElementById('loadingMessage').style.display = "none";
          console.error('Errore caricamento canzone:', error);
          await showHomeView();
          alert('Error al cargar la canción.');
        }
      }

      function filterAndSortSongs() {
        const q = document.getElementById("searchInput").value.toLowerCase();
        const s = document.getElementById("sortSelect").value;
        const l = document.getElementById("langFilter").value;
        let f = songs.filter(song => {
          return (!q || song.title.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q)) &&
                (!l || song.lang1 === l || song.lang2 === l);
        });
        if (s) {
          const [field, order] = s.split("-");
          f.sort((a, b) => order === "asc" ? (a[field]||"").localeCompare(b[field]||"") : (b[field]||"").localeCompare(a[field]||""));
        }
        renderSongs(f);
      }

      // ==================== TOAST ====================
      // Animazioni CSS attive su un toast (vuoto se l'API non è disponibile).
      function toastAnimations(el) {
          return (el && typeof el.getAnimations === 'function') ? el.getAnimations() : [];
      }
      // options.action = { label, onClick } → toast interattivo con azione
      // (es. "Deshacer" dopo l'eliminazione di un preferito/nota). La durata
      // visiva (animazione toastOut) è sincronizzata alla durata JS, e il
      // timer si sospende mentre il puntatore o il focus sono sul toast,
      // così l'azione resta raggiungibile anche da tastiera.
      function showToast(msg, duration = 2400, options = {}) {
          const c = document.getElementById('toastContainer');
          if (!c) return;
          if (options.unique && Array.from(c.children).some(t => t.dataset.toastMessage === msg)) return;
          const action = (options.action && options.action.label) ? options.action : null;
          const t = document.createElement('div');
          t.className = options.subtle ? 'toast-msg toast-msg-subtle' : 'toast-msg';
          if (action) t.classList.add('toast-msg-action');
          t.dataset.toastMessage = msg;
          // L'uscita parte a (duration - 350ms): senza questo, qualsiasi
          // durata > 2350ms verrebbe comunque nascosta dall'animazione a 2s.
          t.style.setProperty('--toast-out-delay', Math.max(0, (duration - 350) / 1000) + 's');
          if (action) {
              const span = document.createElement('span');
              span.className = 'toast-msg-text';
              span.textContent = msg;
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'toast-action-btn';
              btn.textContent = action.label;
              t.appendChild(span);
              t.appendChild(btn);
          } else {
              t.innerHTML = msg;
          }
          c.appendChild(t);

          let removed = false;
          let timer = null;
          let remaining = duration;
          let startedAt = Date.now();
          const remove = () => {
              if (removed) return;
              removed = true;
              if (timer) { clearTimeout(timer); timer = null; }
              t.remove();
          };
          const start = () => { startedAt = Date.now(); timer = setTimeout(remove, remaining); };
          // La pausa congela anche le animazioni: riprendendo insieme timer e
          // animazioni le due tempistiche restano allineate.
          const pause = () => {
              if (removed || !timer) return;
              clearTimeout(timer); timer = null;
              remaining = Math.max(0, remaining - (Date.now() - startedAt));
              toastAnimations(t).forEach(a => { try { a.pause(); } catch (e) {} });
          };
          const resume = () => {
              if (removed || timer) return;
              toastAnimations(t).forEach(a => { try { a.play(); } catch (e) {} });
              start();
          };
          if (action) {
              const btn = t.querySelector('.toast-action-btn');
              if (btn) btn.addEventListener('click', (ev) => {
                  ev.stopPropagation();
                  remove();
                  try { action.onClick(); } catch (e) { console.warn('[toast] azione:', e); }
              });
              t.addEventListener('mouseenter', pause);
              t.addEventListener('mouseleave', resume);
              t.addEventListener('focusin', pause);
              t.addEventListener('focusout', (ev) => {
                  if (!t.contains(ev.relatedTarget)) resume();
              });
          }
          start();
      }

