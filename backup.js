// ==================== BACKUP UTENTE ====================
      // Identificatore utente: generato al primo avvio e salvato in localStorage.
      const USER_CODE_KEY = 'appUserCode';

      function generaCodiceFallback() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID().slice(0,16) : 'u'+Date.now().toString(36)+Math.random().toString(36).slice(2,12); }
      function getUserCode() {
        try {
          let code = localStorage.getItem(USER_CODE_KEY);
          if (!code) {
            code = (window.crypto && crypto.randomUUID)
              ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
              : 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
            localStorage.setItem(USER_CODE_KEY, code);
          }
          return code;
        } catch (e) { return window._memUserCode || (window._memUserCode = generaCodiceFallback()); }
      }

      // Raccoglie lo stato utente da localStorage in un unico oggetto.
      function raccogliStatoUtente() {
        let lyr = null, appunti = [], mp = [];
        try { lyr = JSON.parse(localStorage.getItem('lyricalProgress') || 'null'); } catch (e) {}
        try { appunti = JSON.parse(localStorage.getItem('mieiAppunti') || '[]'); } catch (e) {}
        try { mp = JSON.parse(localStorage.getItem('mpCursosOfertados') || '[]'); } catch (e) {}
        return {
          lyricalProgress: lyr,
          mieiAppunti: appunti,
          appLangChoice: localStorage.getItem('appLangChoice') || '',
          mpCursosOfertados: mp
        };
      }

      // Salva su Google Sheets (doPost) l'ultimo stato + una riga di sessione (metrica).
      async function sincronizzaBackup() {
        try {
          const data = raccogliStatoUtente();
          const progressCount = (data.lyricalProgress && data.lyricalProgress.completedSongIds) ? data.lyricalProgress.completedSongIds.length : 0;
          const payload = {
            code: getUserCode(),
            appLang: data.appLangChoice,
            progressCount: progressCount,
            appuntiCount: (data.mieiAppunti || []).length,
            data: data
          };
          const resp = await fetch(API_URL + '?action=saveBackup', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          });
          const res = await resp.json().catch(() => null);
          console.log('[backup] sincronizzazione:', res);
        } catch (err) {
          console.warn('[backup] errore sincronizzazione (non bloccante):', err);
        }
      }

      // Recupera lo stato dal codice e ripristina localStorage.
      async function recuperaBackup(code) {
        code = String(code || '').trim();
        if (!code) { showToast('⚠️ Inserisci un código de backup.'); return false; }
        try {
          const resp = await fetch(API_URL + '?action=getBackup&code=' + encodeURIComponent(code));
          const res = await resp.json();
          if (!res || !res.found || !res.data) {
            showToast('❌ Código no encontrado.');
            return false;
          }
          const d = res.data;
          if (d.lyricalProgress) localStorage.setItem('lyricalProgress', JSON.stringify(d.lyricalProgress));
          if (d.mieiAppunti) localStorage.setItem('mieiAppunti', JSON.stringify(d.mieiAppunti));
          if (d.appLangChoice) localStorage.setItem('appLangChoice', d.appLangChoice);
          if (d.mpCursosOfertados) localStorage.setItem('mpCursosOfertados', JSON.stringify(d.mpCursosOfertados));
          rebuildSavedIndex();
          updateAppuntiBadge();
          try { localStorage.setItem(USER_CODE_KEY, code); } catch (e) {}
          showToast('✅ Progreso restaurado correctamente.');
          return true;
        } catch (err) {
          console.warn('[backup] errore recupero:', err);
          showToast('❌ Error de red al recuperar.');
          return false;
        }
      }

      // Mostra il codice utente nell'area impostazioni.
      function renderCodiceUtente() {
        const el = document.getElementById('userCodeDisplay');
        if (!el) return;
        const code = getUserCode();
        el.value = code;
      }

      function copiaCodiceUtente() {
        const el = document.getElementById('userCodeDisplay');
        if (!el) return;
        el.select();
        try {
          navigator.clipboard && navigator.clipboard.writeText(el.value);
          showToast('📋 Código copiado.');
        } catch (e) {
          document.execCommand('copy');
          showToast('📋 Código copiado.');
        }
      }

      async function handleRecuperaBackup() {
        const inp = document.getElementById('backupCodeInput');
        if (!inp) return;
        const ok = await recuperaBackup(inp.value.trim());
        if (ok) {
          setTimeout(() => { location.reload(); }, 900);
        }
      }