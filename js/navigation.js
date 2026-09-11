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
      function showToast(msg, duration = 2400) {
          const c = document.getElementById('toastContainer');
          const t = document.createElement('div');
          t.className = 'toast-msg';
          t.innerHTML = msg;
          c.appendChild(t);
          setTimeout(() => t.remove(), duration + 50);
      }

