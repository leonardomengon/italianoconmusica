# Resources

Posiziona qui il logo ufficiale di Mercado Pago con nome **`mp-logo.png`** (PNG, sfondo trasparente, orientamento chiaro per sfondo blu).

Il bottone "Ir a Mercado Pago" nel tile della libreria lo carica da: `resources/mp-logo.png`.

## Audio tutorial dell'onboarding

Le fasi di ascolto dell'onboarding caricano due file audio statici da questa cartella
(nessun link Cloudinary e nessun intervallo temporale):

- **`tut v1.mp3`** – primo ascolto (Fase 3): solo il verso 1.
- **`tut v1_2.mp3`** – secondo ascolto (Fase 7): verso 1 + verso 2.

Riferimenti nel codice: costanti `ONB_AUDIO_FIRST` / `ONB_AUDIO_SECOND` in `js/onboarding.js`
(percorsi relativi alla root del sito, quindi funzionano sia in locale sia su GitHub Pages).

ATTENZIONE: i due file hanno uno SPAZIO nel nome, quindi nell'URL lo spazio è codificato
come `%20` (es. `resources/tut%20v1.mp3`). Se venissero rinominati con l'underscore
(`tut_v1.mp3` / `tut_v1_2.mp3`), basta aggiornare quelle due costanti sostituendo `%20` con `_`.