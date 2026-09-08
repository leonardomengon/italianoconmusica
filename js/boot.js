      // ==================== EVENT LISTENERS ====================
      document.getElementById("searchInput").addEventListener("input", filterAndSortSongs);
      document.getElementById("sortSelect").addEventListener("change", filterAndSortSongs);
      document.getElementById("langFilter").addEventListener("change", filterAndSortSongs);
      // Collega il toggle "Inverti Lingue" solo se la funzione esiste (difesa
      // contro errori di ordine di caricamento o definizioni mancanti).
      const _swapLangBtnEl = document.getElementById("swapLangBtn");
      if (_swapLangBtnEl && typeof swapLanguagesFunc === "function") {
        _swapLangBtnEl.addEventListener("change", swapLanguagesFunc);
      }

      document.getElementById('appuntiSearchInput').addEventListener('input', function() {
          _appuntiFilter = this.value.trim().toLowerCase();
          renderAppuntiAuto();
      });
      document.getElementById('appuntiFilterLang').addEventListener('change', function() {
          _appuntiFilterLang = this.value;
          renderAppuntiAuto();
      });
      document.getElementById('appuntiFilterSong').addEventListener('change', function() {
          _appuntiFilterSong = this.value;
          renderAppuntiAuto();
      });
      document.getElementById('appuntiSort').addEventListener('change', function() {
          _appuntiSort = this.value;
          renderAppuntiAuto();
      });

      document.getElementById('showAppuntiBtn').addEventListener('click', openNotebookView);
      document.getElementById('showSongsBtn').addEventListener('click', showHomeView);

      window.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
              closeOverlay();
              if (document.getElementById('editModal').classList.contains('open')) {
                  document.getElementById('editModal').classList.remove('open');
                  _editId = null;
              }
          }
      });

      // ==================== SCELTA LINGUA (PRIMO AVVIO) ====================
      const LANG_CHOICE_KEY = 'appLangChoice';
      const LANG_CHOICES = {
        it_de: { mother: 'it', target: 'de' },  // Parlo italiano, imparo tedesco
        es_it: { mother: 'es', target: 'it' }   // Hablo español, aprendo italiano
      };
      function getLangChoice() {
        try { return localStorage.getItem(LANG_CHOICE_KEY); } catch (e) { return null; }
      }
      function saveLangChoice(k) {
        try { localStorage.setItem(LANG_CHOICE_KEY, k); } catch (e) {}
      }
      // Riconosce le lingue dal backend via alias (codici o nomi, minuscoli, senza accenti)
      function normalizzaLingua(s) {
        if (!s) return '';
        const v = String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
        if (v === 'de' || v === 'tedesco' || v === 'deutsch' || v === 'german' || v === 'tedesca') return 'de';
        if (v === 'es' || v === 'spagnolo' || v === 'espanol' || v === 'spanish' || v === 'spanisch' || v === 'spagnola') return 'es';
        if (v === 'it' || v === 'italiano' || v === 'italian' || v === 'italienisch' || v === 'italiana') return 'it';
        return v;
      }
      function canzoneCorrisponde(song, choiceKey) {
        const c = LANG_CHOICES[choiceKey];
        if (!c) return false;
        // lang1 = lingua da imparare (testo), lang2 = lingua di partenza (traduzione)
        return normalizzaLingua(song.lang1) === c.target && normalizzaLingua(song.lang2) === c.mother;
      }
      function caricaHome() {
        if (songs.length > 0) { initializeProgression(); showHomeView(); return; }
        document.getElementById('loadingMessage').style.display = 'none';
        showBottomNav();
        const home = document.getElementById('home');
        home.className = 'row';
        home.classList.remove('d-none');
        home.innerHTML = '<div class="col-12 text-center py-5"><p style="color:#8A7FA3;font-weight:800;">😕 No hay canciones compatibles con tu elección de idioma.</p></div>';
      }
      function avviaConScelta(choiceKey) {
        if (!LANG_CHOICES[choiceKey]) return;
        saveLangChoice(choiceKey);
        const modal = document.getElementById('langChoiceModal');
        if (modal) modal.classList.remove('open');
        songs = songs.filter(s => canzoneCorrisponde(s, choiceKey));
        caricaHome();
      }
      function applicaSceltaLingua() {
        const choiceKey = getLangChoice();
        if (choiceKey && LANG_CHOICES[choiceKey]) {
          songs = songs.filter(s => canzoneCorrisponde(s, choiceKey));
          caricaHome();
          return;
        }
        // Default: Spagnolo-Italiano (non mostrare la modale)
        saveLangChoice('es_it');
        songs = songs.filter(s => canzoneCorrisponde(s, 'es_it'));
        hideAppLoader();
        caricaHome();
      }

      // ==================== AVVIO ====================
      (async () => {
        if (typeof initAnalytics === 'function') { initAnalytics(); }
        migraAppunti();
        rebuildSavedIndex();
        updateAppuntiBadge();
        hideBottomNav();
        songs = await fetchSongs();
        if (songs.length > 0) applicaSceltaLingua();
        // Backup automatico + metrica di utilizzo: fire-and-forget, non blocca l'avvio.
        if (typeof sincronizzaBackup === 'function') { sincronizzaBackup(); }
      })();

