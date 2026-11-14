# Tapper

Tidsrapportering med tangenter. Varje projekt är en färgad platta i en mosaik.
Ett tryck lägger till ett debiteringsintervall, till exempel 15 min, 30 min, 1 h
eller en dag, på vald dag.

## Funktioner

- **Kunder → projekt.** Varje kund har en färg. Projekten blir plattor i kundens
  färg, i olika nyanser, så att de bildar en mosaik.
- **Intervall i tre nivåer.** Globalt standardvärde, som kan ändras per kund och
  per projekt (projekt → kund → globalt). Intervallet "Dag" motsvarar en
  arbetsdag, vars längd ställs in.
- **Räkneverk i sidhuvudet.** Visar dagens total och veckans total. Varje platta
  visar sin registrerade tid.
- **Datumnavigering.** Byt dag med pilarna, i veckoremsan eller i
  månadskalendern. Kalendern visar vilka dagar som har tid.
- **Minusläge och Ångra** för att rätta fel.
- **Veckovy** med summor per kund och projekt.
- **Export** till Excel (.xlsx) eller CSV för valfritt datumintervall.
- **Fungerar offline.** Kan installeras på hemskärmen som PWA. Data sparas
  lokalt i enheten.

## Utveckling

```bash
npm install
npm run dev      # utvecklingsserver
npm test         # enhetstester för kärnlogiken
npm run build    # produktionsbygge till dist/
```

## Struktur

```
src/core/   Domänlogik utan beroenden till UI eller ramverk (model.ts, xlsx.ts, storage.ts)
src/ui/     React-komponenter
public/     PWA-manifest, service worker, ikoner
```

`src/core` är avsiktligt fristående så att den kan återanvändas i en iOS-app,
antingen genom att paketera webbappen med Capacitor eller genom att porta
logiken till Swift. `storage.ts` är det enda stället som rör lagring och kan
bytas mot synk eller SwiftData.
