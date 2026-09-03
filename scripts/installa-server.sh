#!/usr/bin/env bash
#
# INSTALLAZIONE SUL SERVER — la parte automatizzabile.
#
#   bash scripts/installa-server.sh
#   bash scripts/installa-server.sh --web ~/public_html
#
# Fa tutto cio che sta **fra** due passaggi che restano a mano, perche
# avvengono dentro il pannello e non da riga di comando:
#
#   PRIMA  — creare database e utenza (cPanel > MySQL Databases), e scrivere
#            DATABASE_URL in apps/api/.env
#   DOPO   — cPanel > Setup Node.js App: creare l'applicazione e riavviarla
#
# In mezzo ci sta questo script: dipendenze, compilazione, client Prisma,
# tabelle, e — se lo chiedi con --web — la copia dell'interfaccia con il suo
# .htaccess.
#
# **Si puo rilanciare**: non cancella dati e non ricrea tabelle gia presenti.
set -euo pipefail

RADICE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="$RADICE/apps/api"
WEB_DEST=""
SALTA_BUILD=0

while [ $# -gt 0 ]; do
  case "$1" in
    --web)   WEB_DEST="${2:-}"; shift 2 ;;
    --salta-build) SALTA_BUILD=1; shift ;;
    -h|--aiuto|--help)
      sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Opzione sconosciuta: $1"; exit 1 ;;
  esac
done

info()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok()    { printf '    \033[32mok\033[0m %s\n' "$*"; }
fermo() { printf '\n\033[31mFermato:\033[0m %s\n\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- controlli
# Si controlla prima e si costruisce dopo: accorgersi che manca il database
# dopo dieci minuti di `npm install` e tempo buttato.
info "Controlli preliminari"

command -v node >/dev/null || fermo "Node non e nel PATH. Su cPanel, entra nell'ambiente dell'applicazione (il comando lo trovi in Setup Node.js App) e rilancia."
MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$MAJOR" -ge 20 ] || fermo "Serve Node 20 o superiore, qui c'e $(node -v). Cambialo in Setup Node.js App."
ok "node $(node -v)"

[ -f "$API/.env" ] || fermo "Manca $API/.env. Copialo dall'esempio e mettici DATABASE_URL."

# shellcheck disable=SC1090
URL="$(grep -E '^DATABASE_URL=' "$API/.env" | head -1 | cut -d= -f2- | tr -d '"' || true)"
[ -n "$URL" ] || fermo "In .env manca DATABASE_URL."
case "$URL" in
  *CAMBIAMI*|*LA_PASSWORD*|*PASSWORD@*)
    fermo "DATABASE_URL contiene ancora un segnaposto. Mettici i dati veri — su cPanel ricorda che i nomi sono preceduti dal nome dell'account, tipo mario_volleyvision." ;;
esac
ok "DATABASE_URL presente"

SEGRETO="$(grep -E '^JWT_SECRET=' "$API/.env" | head -1 | cut -d= -f2- | tr -d '"' || true)"
case "$SEGRETO" in
  ""|*sviluppo-non-sicuro*|*cambiami*)
    # Non e un dettaglio: con il segreto predefinito, che sta nel sorgente,
    # chiunque puo firmarsi da solo un accesso da amministratore.
    fermo "JWT_SECRET manca o e ancora quello di sviluppo. Generane uno: openssl rand -base64 48" ;;
esac
ok "JWT_SECRET impostato"

# ------------------------------------------------------------ installazione
cd "$RADICE"

if [ "$SALTA_BUILD" -eq 0 ]; then
  info "Dipendenze"
  # `npm ci` vorrebbe un package-lock allineato e cancella node_modules ogni
  # volta: su hosting condiviso e lento e a volte finisce la memoria.
  npm install --no-audit --no-fund
  ok "installate"

  info "Compilazione"
  npm run build:packages
  npm run build --workspace @vv/api
  npm run build --workspace @vv/web
  ok "pacchetti, API e interfaccia"
fi

info "Client Prisma"
# Va rigenerato **sul server**: il motore di Prisma e compilato per un sistema
# operativo preciso, e quello del computer di sviluppo non gira qui.
( cd "$API" && npx prisma generate )
ok "generato per questa macchina"

info "Tabelle"
( cd "$API" && npx prisma migrate deploy )
ok "migrazioni applicate"

# --------------------------------------------------------------- interfaccia
if [ -n "$WEB_DEST" ]; then
  info "Interfaccia in $WEB_DEST"
  [ -d "$RADICE/apps/web/dist" ] || fermo "Manca apps/web/dist: rilancia senza --salta-build."
  mkdir -p "$WEB_DEST"

  # Si copia il contenuto, non la cartella: i file devono stare nella radice
  # del dominio, altrimenti finirebbero sotto /dist.
  cp -r "$RADICE/apps/web/dist/." "$WEB_DEST/"
  ok "file copiati"

  HT="$WEB_DEST/.htaccess"
  if [ -f "$HT" ]; then
    printf '    \033[33mattenzione\033[0m %s esiste gia: non lo tocco.\n' "$HT"
    printf '    Verifica a mano che mandi i percorsi sconosciuti a index.html.\n'
  else
    cat > "$HT" <<'HTACCESS'
# Le rotte le disegna React nel browser: senza questa riscrittura, ricaricare
# la pagina su /partite/123 darebbe 404, perche quel file non esiste.
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # L'API non si tocca.
  RewriteRule ^api/ - [L]

  # File e cartelle che esistono davvero: si servono.
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Tutto il resto e una rotta dell'applicazione.
  RewriteRule . /index.html [L]
</IfModule>

<IfModule mod_headers.c>
  # Il guscio non va mai conservato: se lo fosse, gli aggiornamenti
  # arriverebbero agli utenti con giorni di ritardo.
  <Files "sw.js">
    Header set Cache-Control "no-cache, must-revalidate"
  </Files>
  # I file con l'impronta nel nome non cambiano mai contenuto: si tengono.
  <FilesMatch "\.(js|css|woff2?)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
</IfModule>
HTACCESS
    ok ".htaccess scritto"
  fi
fi

# ------------------------------------------------------------------- chiusura
cat <<FINE

$(printf '\033[1m')Fatto.$(printf '\033[0m')

Restano due cose, che si fanno dal pannello:

  1. cPanel > Setup Node.js App
       Application root          volleyvision
       Application startup file  apps/api/dist/src/main.js
       Node.js version           20 o superiore
     e poi Restart.

  2. cPanel > SSL/TLS Status > Run AutoSSL
     Senza HTTPS il service worker non si registra: niente installazione
     dell'applicazione e niente uso senza rete.

Per verificare:

  curl https://IL-TUO-DOMINIO/api/health     -> {"ok":true}
  curl https://IL-TUO-DOMINIO/api/version    -> versione e funzioni attive

Dati dimostrativi (5 utenti, 30 squadre, 15 partite):

  cd apps/api && npx tsx prisma/seed-demo.ts

FINE
