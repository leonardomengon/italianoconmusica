      // ==================== AUDIO PLAYER (HTML5) ====================
      function initAudioPlayer(audioElement, songId) {
        _userSeeked[songId] = false;

        // Brano concluso: conteggia ascolto (se non saltato con +5s) e riavvia (loop)
        audioElement.addEventListener('ended', () => {
          if (!_userSeeked[songId]) {
            recordListen(songId);
          }
          _userSeeked[songId] = false;
          audioElement.currentTime = 0;
          audioElement.play().catch(() => {});
        });
      }

      function playPauseSong(songId) {
        const el = audioPlayers[songId];
        if (!el) return;
        if (el.paused) el.play().catch(() => {}); else el.pause();
      }

      function stopSong(songId) {
        const el = audioPlayers[songId];
        if (!el) return;
        _suppressSeekEvent = true;
        el.pause();
        el.currentTime = 0;
        _userSeeked[songId] = false;
        setTimeout(() => { _suppressSeekEvent = false; }, 0);
      }

