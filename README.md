# PyStudio

Eine minimalistische, installierbare Python-IDE für den Browser. CodeMirror stellt
den Editor bereit, xterm.js das größenverstellbare Terminal. Python läuft über
Pyodide in einem Web Worker. Programme mit `input()` lesen ihre Eingaben direkt
aus dem Terminal – ohne Browserdialog.

Auf Tablets folgt die Oberfläche dem sichtbaren Bereich der virtuellen Tastatur.
Dadurch bleiben Terminaleingaben und die aktuelle Ausgabe beim Tippen sichtbar.

## Lokal starten

```bash
python3 -m http.server 8000
```

Danach `http://localhost:8000` im Browser öffnen.
