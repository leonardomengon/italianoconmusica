      // ==================== AUDIO PLAYER (HTML5) ====================
      function initAudioPlayer(audioElement, songId) {
        // Brano concluso: conteggia ascolto e riavvia (loop)
        audioElement.addEventListener('ended', () => {
          recordListen(songId);
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

