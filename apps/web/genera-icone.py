# -*- coding: utf-8 -*-
"""Le icone dell'applicazione installata.

Disegnate qui e non prese da un servizio: sono lo stesso pallone del marchio,
e devono restare tali. Rigenerarle e un comando, non una ricerca di file.

    python genera-icone.py

Servono due misure e due tipi:
  - 192 e 512: le dimensioni che i sistemi si aspettano
  - `any` con lo sfondo scuro dell'applicazione
  - `maskable` con margine, perche Android ritaglia l'icona in una forma sua
    e senza margine il pallone verrebbe tosato
"""
import math
import os
from PIL import Image, ImageDraw

FONDO = (8, 12, 18)        # --sfondo del tema scuro
PALLA = (255, 204, 0)      # --palla
DEST = os.path.join(os.path.dirname(__file__), "public")


def pallone(dim, margine):
    """Il pallone: cerchio e tre fasce curve, come nell'icona del marchio."""
    s = 4                                  # sovracampionamento, per i bordi puliti
    d = dim * s
    img = Image.new("RGB", (d, d), FONDO)
    g = ImageDraw.Draw(img)

    r = (d / 2) * (1 - margine)
    cx = cy = d / 2
    tratto = max(2, int(d * 0.055))

    g.ellipse([cx - r, cy - r, cx + r, cy + r], outline=PALLA, width=tratto)

    # Le tre fasce: archi che partono dal bordo e attraversano il pallone.
    # Gli stessi angoli dell'icona in `Icone.tsx`, cosi il segno e uno solo.
    for rotazione in (0, 120, 240):
        punti = []
        for t in range(0, 101):
            a = math.radians(-70 + t * 1.4 + rotazione)
            # raggio che si stringe a meta: e cio che da la curva alla fascia
            k = 1 - 0.55 * math.sin(math.radians(t * 1.8))
            punti.append((cx + r * k * math.cos(a), cy + r * k * math.sin(a)))
        g.line(punti, fill=PALLA, width=tratto, joint="curve")

    return img.resize((dim, dim), Image.LANCZOS)


os.makedirs(DEST, exist_ok=True)
for dim in (192, 512):
    # `any`: l'icona come e, per chi la mostra intera
    pallone(dim, 0.12).save(os.path.join(DEST, f"icona-{dim}.png"))
    # `maskable`: piu margine, perche Android ritaglia in cerchio o goccia
    pallone(dim, 0.28).save(os.path.join(DEST, f"icona-{dim}-maskable.png"))
    print(f"  icona-{dim}.png e icona-{dim}-maskable.png")

# Il segnaposto della scheda del browser
pallone(64, 0.10).save(os.path.join(DEST, "favicon.png"))
print("  favicon.png")
