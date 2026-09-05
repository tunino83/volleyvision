# Genera le icone dell'applicazione Android dall'icona del sito.
#
#   powershell -File scripts/icone-android.ps1
#
# ## La sorgente e il PNG, non il glifo di `Icone.tsx`
#
# Sembrano la stessa cosa e non lo sono: `componenti/Icone.tsx` ha un pallone
# disegnato per stare a 20 pixel dentro un pulsante, l'icona del sito e
# un'illustrazione piu ricca. Ridisegnare il glifo produce **un'altra icona**,
# ed e stato provato prima di accorgersene.
#
# Dell'icona esistono solo i PNG: nessun SVG sorgente. Quindi si scala, e si
# parte da 512 px per avere margine.
#
# ## I tre strati che Android si aspetta
#
# 1. `ic_launcher.png` — l'icona classica, per Android 7 e precedenti. Fondo
#    cotto dentro l'immagine: non ci sono strati da comporre.
# 2. `ic_launcher_round.png` — la stessa, ritagliata tonda.
# 3. `ic_launcher_foreground.png` — il disegno davanti dell'icona adattiva
#    (Android 8+), che il sistema ritaglia nella forma decisa dal telefono:
#    cerchio, quadrato smussato, goccia.
#
# ## Perche il disegno davanti puo avere il fondo opaco
#
# Di norma no: lo strato davanti dev'essere trasparente, o coprirebbe quello
# sotto. Qui funziona perche il fondo dell'icona e **esattamente** `#080C12`,
# lo stesso colore dello strato di sfondo
# (`values/ic_launcher_background.xml`) — verificato campionando i pixel.
# Il bordo fra i due strati cade fra due colori identici e non si vede.
#
# E cio che evita di dover scontornare il pallone da un PNG, operazione che
# lascia sempre una frangia sui bordi sfumati.
#
# ## Quando rieseguirlo
#
# Solo se cambia l'icona del sito. Le icone generate sono versionate: la
# costruzione dell'APK non dipende da questo script.
#
# Windows soltanto (System.Drawing). E un compito da macchina di sviluppo, e
# qui l'APK si costruisce gia su Windows.

Add-Type -AssemblyName System.Drawing

$radice = Join-Path $PSScriptRoot ".."
$res = Join-Path $radice "apps\web\android\app\src\main\res"
$piena = Join-Path $radice "apps\web\public\icona-512.png"
# La variante "maskable" ha gia il margine perche il pallone sopravviva al
# ritaglio: e quella giusta ovunque ci sia una maschera di mezzo.
$conMargine = Join-Path $radice "apps\web\public\icona-512-maskable.png"

foreach ($f in @($piena, $conMargine)) {
  if (-not (Test-Path $f)) { throw "Manca $f" }
}

function Scala {
  param([string]$Sorgente, [int]$Lato, [double]$Occupazione = 1.0, [bool]$Tondo = $false)

  $src = New-Object Drawing.Bitmap($Sorgente)
  $bmp = New-Object Drawing.Bitmap($Lato, $Lato, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  # `HighQualityBicubic`: a 48 px un ridimensionamento approssimativo si vede,
  # ed e proprio la dimensione a cui l'icona vive nella barra di stato.
  $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([Drawing.Color]::Transparent)

  if ($Tondo) {
    $percorso = New-Object Drawing.Drawing2D.GraphicsPath
    $percorso.AddEllipse(0, 0, $Lato, $Lato)
    $g.SetClip($percorso)
    $percorso.Dispose()
  }

  $dentro = [int]($Lato * $Occupazione)
  $bordo = [int](($Lato - $dentro) / 2)
  $g.DrawImage($src, $bordo, $bordo, $dentro, $dentro)

  $g.Dispose(); $src.Dispose()
  return $bmp
}

# Il lato dell'icona classica per densita, e quello del disegno adattivo, che
# e 108dp invece di 48dp: 2,25 volte.
$densita = @(
  @{ n = "mdpi";    icona = 48;  davanti = 108 },
  @{ n = "hdpi";    icona = 72;  davanti = 162 },
  @{ n = "xhdpi";   icona = 96;  davanti = 216 },
  @{ n = "xxhdpi";  icona = 144; davanti = 324 },
  @{ n = "xxxhdpi"; icona = 192; davanti = 432 }
)

foreach ($d in $densita) {
  $cartella = Join-Path $res ("mipmap-" + $d.n)
  if (-not (Test-Path $cartella)) { New-Item -ItemType Directory -Path $cartella | Out-Null }

  $a = Scala -Sorgente $piena -Lato $d.icona
  $a.Save((Join-Path $cartella "ic_launcher.png"), [Drawing.Imaging.ImageFormat]::Png)
  $a.Dispose()

  $b = Scala -Sorgente $conMargine -Lato $d.icona -Tondo $true
  $b.Save((Join-Path $cartella "ic_launcher_round.png"), [Drawing.Imaging.ImageFormat]::Png)
  $b.Dispose()

  # 0.667: il drawable e 108dp ma se ne vedono i 72 centrali. Riducendo
  # l'icona a quei due terzi, il pallone resta intero sotto qualunque
  # maschera; il fondo che avanza e dello stesso colore dello strato sotto,
  # quindi il quadrato non si vede.
  $c = Scala -Sorgente $conMargine -Lato $d.davanti -Occupazione 0.667
  $c.Save((Join-Path $cartella "ic_launcher_foreground.png"), [Drawing.Imaging.ImageFormat]::Png)
  $c.Dispose()

  "{0,-8} classica {1}px · adattiva {2}px" -f $d.n, $d.icona, $d.davanti
}

"Fatto. Lo sfondo dell'icona adattiva sta in values/ic_launcher_background.xml e deve restare #080C12."
