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

      // Riproduce un frammento (intervallo) di una traccia audio. Usato durante
      // l'onboarding per far ascoltare il solo verso tutorial (NON conteggia
      // l'ascolto: la riproduzione mirata non equivale a "ascolto completo").
      function playVerseInterval(audioEl, startSec, endSec, onEnd) {
        if (!audioEl) return;
        const tick = () => {
          if (isFinite(audioEl.duration) && audioEl.currentTime >= endSec) {
            audioEl.pause();
            audioEl.removeEventListener('timeupdate', tick);
            if (typeof onEnd === 'function') onEnd();
          }
        };
        audioEl.addEventListener('timeupdate', tick);
        const start = () => {
          try { audioEl.currentTime = startSec; } catch (e) {}
          audioEl.play().catch(() => {});
        };
        if (audioEl.readyState >= 1) start();
        else audioEl.addEventListener('loadedmetadata', start, { once: true });
      }

