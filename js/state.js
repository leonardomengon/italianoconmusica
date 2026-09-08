  const API_URL = "https://script.google.com/macros/s/AKfycbykSfICz5AKMWY8S4KR2lgafDd7V82NKDGPV8mpZtGB3r_UwTfqGNvnp7ealTt6uwwJ/exec"
      // Catalogo completo (lista + lyrics) servito da Cloudinary come asset raw.
      const CATALOGO_URL = "https://res.cloudinary.com/gh5kjl2a/raw/upload/v1788871048/catalogo.json"
      let songs = [];
      let currentPage = 0;
      const songsPerPage = 10;
      let audioPlayers = {};
      let _playerSongId = null;
      let _userSeeked = {};
      let _suppressSeekEvent = false;
      let swapLanguages = false;
      let currentSongId = null;
      let currentSongBackup = null;
      let _exerciseMode = false;
      let _exerciseQueue = [];
      let _exerciseIndex = 0;
      let _sfidaCountedSession = false;
      let _eserciziFatti = 0;
      let _ripassoMode = false;
      // Fase e timer condivisi tra esercizi "studio" e "ripasso"
      // (in precedenza erano due coppie duplicate: _ripassoPhase/_ripassoTimer
      // e _reviewPhase/_reviewTimer). _reviewMode resta un concetto separato:
      // indica la sola visualizzazione di una canzone già completata.
      let _exercisePhase = 'translation';
      let _exerciseTimer = null;
      let _savedTextsIndex = new Set();
      let _appuntiFilter = '';
      let _appuntiFilterLang = '';
      let _appuntiFilterSong = '';
      let _appuntiSort = 'createdAt-desc';
      let _editId = null;
      let _appuntiSwap = false;
      let _appuntiStudyMode = false;
      let _currentAlternatives = [];
      let _loadToken = 0;
      let _openCourses = new Set();
      // Mappa chiave-corso (normalizzata) -> descrizione letta dal foglio "Corsi".
      let courseDescriptions = {};
      const MP_ALIAS = 'italianoconmusica'; // TODO: sustituir por el alias real de Mercado Pago

