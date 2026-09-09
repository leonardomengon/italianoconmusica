      // ==================== PREFERITI ====================
      // Risolve l'indice posizionale di un verso nella canzone corrente
      // cercando il testo (normalizzato) tra i versi principali (text1) e
      // le traduzioni (text2). Ritorna l'indice o null se non trovato.
      function _resolveVerseIndex(testo) {
        if (!testo || !currentSongBackup || !currentSongBackup.lyrics) return null;
        const target = normalizza(testo);
        const idx = currentSongBackup.lyrics.findIndex(l =>
            normalizza(l.text1) === target || normalizza(l.text2) === target
        );
        return idx > -1 ? idx : null;
      }

      // Core condiviso: aggiunge/rimuove l'appunto e aggiorna la stella.
      // Ritorna true se l'elemento è stato aggiunto, false se rimosso.
      function _togglePreferitoCore(btn, opts) {
          if (!btn) return;
          const { testo, traduzione = '', songId, songTitle, artist, lingua, linguaTrad, lyricIndex } = opts;
          if (!testo) return;

          let appunti = getAppunti();
          const target = normalizza(testo);
          const index = appunti.findIndex(a =>
              normalizza(a.testo) === target || normalizza(a.traduzione) === target
          );

          if (index > -1) {
              appunti.splice(index, 1);
              saveAppunti(appunti);
              btn.innerHTML = '<span class="material-symbols-outlined fav-ico">bookmark_border</span>';
              btn.classList.remove('btn-outline-warning');
              btn.classList.add('btn-outline-secondary');
              showToast('🗑️ Eliminado de favoritos');
              return false;
          } else {
              appunti.push({
                  id: genId(),
                  testo: testo,
                  traduzione: traduzione,
                  songId: songId,
                  songTitle: songTitle,
                  artist: artist,
                  lingua: lingua,
                  linguaTrad: linguaTrad,
                  nota: '',
                  createdAt: Date.now()
              });
              saveAppunti(appunti);
              recordSavedNoteForProgress(testo);
              // Analytics: engagement emotivo sui contenuti (preferiti).
              // verseId usa l'ID canonico posizionale v_<songId>_<index>, identico
              // a quello di verse_expanded, così i due eventi sono join-abili.
              // Se l'indice non è noto (alternative/esercizi), si risolve cercando
              // il testo tra i versi della canzone corrente; fallback: prefisso "alt".
              try {
                let verseIndex = (typeof lyricIndex === 'number') ? lyricIndex : _resolveVerseIndex(testo);
                let verseId;
                if (verseIndex !== null && verseIndex !== undefined) {
                  verseId = positionalVerseId(songId, verseIndex);
                } else {
                  verseId = 'v_' + String(songId ?? '') + '_alt_' + normalizza(testo).slice(0, 32);
                }
                logEvent('verse_favorited', {
                  verseId: verseId,
                  songId: String(songId ?? (currentSongBackup ? currentSongBackup.id : '')),
                  index: (verseIndex !== null && verseIndex !== undefined) ? verseIndex : null
                });
              } catch (e) {}
              btn.innerHTML = '<span class="material-symbols-outlined fav-ico">bookmark</span>';
              btn.classList.remove('btn-outline-secondary');
              btn.classList.add('btn-outline-warning');
              return true;
          }
      }

      function togglePreferito(btn, lyricIndex) {
          if (!currentSongBackup || !currentSongBackup.lyrics) return;
          const lyric = currentSongBackup.lyrics[lyricIndex];
          if (!lyric) return;
          const testo = lyric.text1 || '';
          if (!testo) return;

          const added = _togglePreferitoCore(btn, {
              testo: testo,
              traduzione: lyric.text2 || '',
              songId: currentSongBackup.id,
              lyricIndex: lyricIndex,
              songTitle: currentSongBackup.title || '',
              artist: currentSongBackup.artist || '',
              lingua: currentSongBackup.lang1 || '',
              linguaTrad: currentSongBackup.lang2 || ''
          });

          if (added) {
              let noteEl = document.getElementById(`verse-note-${lyricIndex}`);
              if (!noteEl) {
                  const verseEl = document.querySelector(`.verse[data-index="${lyricIndex}"]`);
                  if (verseEl) {
                      noteEl = document.createElement('div');
                      noteEl.className = 'verse-note';
                      noteEl.id = `verse-note-${lyricIndex}`;
                      noteEl.innerHTML = `<textarea placeholder="Añade nota" onblur="saveNotaFromVerse(this, ${lyricIndex})" onclick="event.stopPropagation()"></textarea>`;
                      const textDiv = verseEl.querySelector('.d-flex.justify-content-between');
                      if (textDiv && textDiv.nextSibling) {
                          verseEl.insertBefore(noteEl, textDiv.nextSibling);
                      } else {
                          verseEl.appendChild(noteEl);
                      }
                  }
              }
          } else {
              const noteEl = document.getElementById(`verse-note-${lyricIndex}`);
              if (noteEl) noteEl.remove();
          }
      }

      function togglePreferitoAltByIndex(btn, altIndex) {
          const item = _currentAlternatives[altIndex];
          if (!item) return;
          togglePreferitoAlt(btn, item.original, item.translated);
      }

      function togglePreferitoAlt(btn, originalText, translatedText) {
          if (!currentSongBackup) return;
          if (!originalText) return;
          _togglePreferitoCore(btn, {
              testo: originalText,
              traduzione: translatedText || '',
              songId: currentSongBackup.id,
              songTitle: currentSongBackup.title || '',
              artist: currentSongBackup.artist || '',
              lingua: currentSongBackup.lang1 || '',
              linguaTrad: currentSongBackup.lang2 || ''
          });
      }

      // ==================== RENDER APPUNTI ====================
      function popolaFiltriAppunti() {
          const appunti = getAppunti();
          const lingue = [...new Set(appunti.map(a => a.lingua).filter(Boolean))].sort();
          const selLang = document.getElementById('appuntiFilterLang');
          const currentLang = selLang.value;
          selLang.innerHTML = '<option value="">🌐 Todos los idiomas</option>' +
              lingue.map(l => `<option value="${escapeHtml(l)}" ${l === currentLang ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('');
          const canzoni = [...new Set(appunti.map(a => a.songTitle).filter(Boolean))].sort();
          const selSong = document.getElementById('appuntiFilterSong');
          const currentSong = selSong.value;
          selSong.innerHTML = '<option value="">🎵 Todas las canciones</option>' +
              canzoni.map(s => `<option value="${escapeHtml(s)}" ${s === currentSong ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');
      }

      function toggleAppuntoExpand(id, ev) {
          if (ev && ev.target.closest('button')) return;
          const card = document.querySelector(`.appunto-item[data-id="${id}"]`);
          if (!card) return;
          card.classList.toggle('expanded');
      }

      function renderAppuntiAuto() {
          if (_appuntiStudyMode) {
              renderAppuntiStudio();
          } else {
              renderAppunti();
          }
      }

      function renderAppunti() {
          const lista  = document.getElementById('listaAppunti');
          const empty  = document.getElementById('emptyAppuntiMsg');
          const info   = document.getElementById('appuntiCountInfo');
          const appunti = getAppunti();
          if (appunti.length === 0) {
              lista.innerHTML = '';
              empty.style.display = 'block';
              info.textContent = '';
              return;
          }
          empty.style.display = 'none';
          let filtrati = appunti.filter(a => {
              if (_appuntiFilterLang && a.lingua !== _appuntiFilterLang) return false;
              if (_appuntiFilterSong && a.songTitle !== _appuntiFilterSong) return false;
              if (_appuntiFilter) {
                  const f = _appuntiFilter;
                  const inTesto = (a.testo || '').toLowerCase().includes(f);
                  const inTrad  = (a.traduzione || '').toLowerCase().includes(f);
                  const inNota  = (a.nota || '').toLowerCase().includes(f);
                  const inSong  = (a.songTitle || '').toLowerCase().includes(f);
                  if (!inTesto && !inTrad && !inNota && !inSong) return false;
              }
              return true;
          });
          const [field, order] = _appuntiSort.split('-');
          filtrati.sort((a, b) => {
              let va = a[field], vb = b[field];
              if (field === 'createdAt') {
                  va = va || 0; vb = vb || 0;
                  return order === 'asc' ? va - vb : vb - va;
              }
              va = (va || '').toString().toLowerCase();
              vb = (vb || '').toString().toLowerCase();
              return order === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
          });
          info.textContent = `${filtrati.length} de ${appunti.length} notas`;
          if (filtrati.length === 0) {
              lista.innerHTML = '<p style="text-align:center;color:#958AAD;padding:20px 0;">No hay resultados para los filtros seleccionados.</p>';
              return;
          }
          lista.innerHTML = filtrati.map(a => {
              const testoView      = _appuntiSwap ? (a.traduzione || '') : (a.testo || '');
              const traduzioneView = _appuntiSwap ? (a.testo || '')      : (a.traduzione || '');

              const songBadge = a.songTitle
                  ? `<span class="badge badge-song">🎵 ${escapeHtml(a.songTitle)}</span>`
                  : '';
              const tradHtml  = traduzioneView
                  ? `<div class="appunto-traduzione"> ${escapeHtml(traduzioneView)}</div>`
                  : `<div class="appunto-traduzione"><em style="color:#958AAD;">No hay traducción disponible</em></div>`;
              const notaHtml = `
                  <div class="appunto-nota">
                      <textarea placeholder="Añade nota" onblur="saveNotaFromAppunto(this, '${a.id}')" onclick="event.stopPropagation()">${escapeHtml(a.nota || '')}</textarea>
                  </div>`;
              return `
              <div class="appunto-item" data-id="${a.id}" onclick="toggleAppuntoExpand('${a.id}', event)">
                  <div class="appunto-header">
                      <div class="appunto-meta">${songBadge}</div>
                  </div>
                  <div class="appunto-testo">
                      <div class="d-flex justify-content-between align-items-center gap-2">
                          <div class="d-flex align-items-center gap-2 flex-grow-1">
                              <strong>${escapeHtml(testoView)}</strong>
                              <span class="toggle-hint" title="Haz clic para mostrar/ocultar la traducción">▼</span>
                          </div>
                          <button class="btn btn-sm btn-outline-warning" style="padding: 2px 8px; font-size: 14px; border-radius: 6px;" onclick="event.stopPropagation(); rimuoviAppuntoSilenzioso('${a.id}')" title="Eliminar de favoritos"><span class="material-symbols-outlined fav-ico">bookmark</span></button>
                      </div>
                  </div>
                  ${notaHtml}
                  ${tradHtml}
              </div>`;
          }).join('');
      }

      // ==================== MODALITÀ STUDIO APPUNTI ====================
      function renderAppuntiStudio() {
          const lista = document.getElementById('listaAppunti');
          const empty = document.getElementById('emptyAppuntiMsg');
          const info  = document.getElementById('appuntiCountInfo');

          const appunti = getAppunti();
          if (appunti.length === 0) {
              lista.innerHTML = '';
              empty.style.display = 'block';
              info.textContent = '';
              return;
          }
          empty.style.display = 'none';

          // Stessi filtri della vista lista
          let filtrati = appunti.filter(a => {
              if (_appuntiFilterLang && a.lingua !== _appuntiFilterLang) return false;
              if (_appuntiFilterSong && a.songTitle !== _appuntiFilterSong) return false;
              if (_appuntiFilter) {
                  const f = _appuntiFilter;
                  const inTesto = (a.testo || '').toLowerCase().includes(f);
                  const inTrad  = (a.traduzione || '').toLowerCase().includes(f);
                  const inNota  = (a.nota || '').toLowerCase().includes(f);
                  const inSong  = (a.songTitle || '').toLowerCase().includes(f);
                  if (!inTesto && !inTrad && !inNota && !inSong) return false;
              }
              return true;
          });

          if (filtrati.length === 0) {
              lista.innerHTML = '<p style="text-align:center;color:#958AAD;padding:20px 0;">No hay notas disponibles para el estudio con los filtros seleccionados.</p>';
              info.textContent = '';
              return;
          }

          // Costruisce le frasi rispettando _appuntiSwap
          let frasi = filtrati
              .map(a => {
                  const testo      = _appuntiSwap ? (a.traduzione || '') : (a.testo || '');
                  const traduzione = _appuntiSwap ? (a.testo || '')      : (a.traduzione || '');
                  if (!testo.trim()) return null;
                  return {
                      text: testo,
                      hint: traduzione,
                      songTitle: a.songTitle || ''
                  };
              })
              .filter(Boolean);

          // Deduplica
          frasi = frasi.filter((v, i, self) => {
              const t = v.text.trim().toLowerCase();
              return i === self.findIndex(x => x.text.trim().toLowerCase() === t);
          });

          // Mescola
          for (let i = frasi.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [frasi[i], frasi[j]] = [frasi[j], frasi[i]];
          }

          // Max 10
          const selected = frasi.slice(0, 10);
          info.textContent = `🧠 ${selected.length} frases de estudio (de ${frasi.length} favoritos disponibles)`;

          let html = '<div class="lyrics-container">';
          selected.forEach((frase) => {
              const textWithBlanks = generaVersoStudio(escapeHtml(frase.text));
              const hintHTML = frase.hint && frase.hint.trim()
                  ? `
                    <div class="translation" style="display:block; opacity:0.85; border-left-color:#5B9BF6;">
                      <span style="color:#7B6F8C;">💡 ${escapeHtml(frase.hint)}</span>
                    </div>
                  `
                  : `
                    <div class="translation" style="display:block; opacity:0.6; border-left-color:#7B6F8C;">
                      <span style="color:#7B6F8C; font-size:0.85em;"><em>Traducción no disponible</em></span>
                    </div>
                  `;

              const metaHTML = frase.songTitle
                  ? `<div style="font-size:11px; color:#958AAD; margin-bottom:6px;">🎵 ${escapeHtml(frase.songTitle)}</div>`
                  : '';

              html += `
                <div class="verse active" style="cursor: default;">
                  ${metaHTML}
                  <strong>${textWithBlanks || '<em>Texto no disponible</em>'}</strong>
                  ${hintHTML}
                </div>
              `;
          });

          html += `
              <div style="text-align:center; margin-top: 20px; padding-bottom: 10px;">
                <button onclick="renderAppuntiStudio()"
                  style="background:#5B9BF6; color:white; border:none; border-radius:8px; padding:12px 28px; font-size:15px; font-weight:500; cursor:pointer; transition:all 0.2s;"
                  onmouseover="this.style.background='#3F7FD6'; this.style.transform='scale(1.03)'"
                  onmouseout="this.style.background='#5B9BF6'; this.style.transform='scale(1)'">
                  🔀 Otras 10 frases
                </button>
              </div>
            </div>
          `;
          lista.innerHTML = html;
      }

      function rimuoviAppunto(id) {
          if (!window.confirm('¿Eliminar esta nota?')) return;
          let appunti = getAppunti();
          const idx = appunti.findIndex(a => a.id === id);
          if (idx < 0) return;
          appunti.splice(idx, 1);
          saveAppunti(appunti);
          showToast('🗑️ Nota eliminada');
          popolaFiltriAppunti();
          renderAppuntiAuto();
          if (currentSongBackup && _exerciseMode) {
              renderCurrentExercise();
          } else if (currentSongBackup) {
              document.querySelectorAll('[data-lyric-index]').forEach(btn => {
                  const li = parseInt(btn.getAttribute('data-lyric-index'));
                  const lyric = currentSongBackup.lyrics[li];
                  if (!lyric) return;
                  const rawMain = swapLanguages ? (lyric.text2 || '') : (lyric.text1 || '');
                  if (!isSaved(rawMain)) {
                      btn.innerHTML = '<span class="material-symbols-outlined fav-ico">bookmark_border</span>';
                      btn.classList.remove('btn-outline-warning');
                      btn.classList.add('btn-outline-secondary');
                  }
              });
          }
      }

      // ==================== MODIFICA APPUNTO ====================
      function apriModifica(id) {
          const appunti = getAppunti();
          const a = appunti.find(x => x.id === id);
          if (!a) return;
          _editId = id;
          const notaEl = document.getElementById('editModalNota');
          notaEl.value = a.nota || '';
          const modal = document.getElementById('editModal');
          modal.classList.add('open');
          notaEl.focus();
      }

      document.getElementById('editModalCancel').addEventListener('click', () => {
          document.getElementById('editModal').classList.remove('open');
          _editId = null;
      });
      document.getElementById('editModalSave').addEventListener('click', () => {
          if (!_editId) return;
          const nuovaNota = document.getElementById('editModalNota').value.trim();
          let appunti = getAppunti();
          const idx = appunti.findIndex(a => a.id === _editId);
          if (idx < 0) return;
          appunti[idx].nota = nuovaNota;
          saveAppunti(appunti);
          document.getElementById('editModal').classList.remove('open');
          _editId = null;
          showToast('✏️ ¡Nota actualizada!');
          popolaFiltriAppunti();
          renderAppuntiAuto();
      });
      document.getElementById('editModal').addEventListener('pointerdown', (e) => {
          if (e.target === document.getElementById('editModal')) {
              document.getElementById('editModal').classList.remove('open');
              _editId = null;
          }
      });

