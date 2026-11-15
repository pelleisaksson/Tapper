# Tapper

Tidsrapportering med tangenter. Varje projekt är en färgad platta i en mosaik.
Ett tryck lägger till ett debiteringsintervall, till exempel 15 min, 30 min, 1 h
eller en dag, på vald dag.

## Funktioner

- **Kunder → projekt.** Varje kund har en färg. Projekten blir plattor i kundens
  färg, i olika nyanser, så att de bildar en mosaik som fyller skärmen.
  Textfärgen väljs automatiskt (mörk eller vit) så att den alltid går att läsa.
- **Färger:** välj ur paletten, i ett färghjul eller med hex-kod. Paletten kan
  ersättas med en .ase-fil (t.ex. exporterad från Adobe Color) under
  Inställningar.
- **Intervall och timpris i tre nivåer:** globalt, per kund och per projekt.
  Intervallet "Dag" motsvarar en arbetsdag, vars längd ställs in.
- **Plattorna** visar kund och intervall överst, projektnamn och registrerad
  tid i mitten och, om timpris finns, timpris och summa nederst.
- **Sortering** av plattorna: egen ordning, mest använda (antal tryck senaste
  90 dagarna), kund A–Ö eller projekt A–Ö.
- **Sidhuvud** med räknare. Tryck på datumet för kalendern, och därifrån för
  vyerna Vecka, Månad och År. Pennan slår på redigering, där ett tryck drar av
  tid. Kugghjulet öppnar inställningarna.
- **Ångra** efter varje tryck.
- **Export** till Excel (.xlsx med summering och detaljerad redovisning) eller
  CSV för valfritt datumintervall, med timmar, timpris och belopp.
- **Synk mellan enheter** via Supabase, med inloggning med e-post och lösenord.
  Appen fungerar offline och synkar när nätet är tillbaka.
- **Fungerar offline.** Kan installeras på hemskärmen som PWA.

## Utveckling

```bash
npm install
npm run dev      # utvecklingsserver
npm test         # enhetstester för kärnlogiken
npm run build    # produktionsbygge till dist/
```

## Komma igång med synk och publicering

Följ guiden **[docs/SETUP.md](docs/SETUP.md)**. Den visar steg för steg vad du
ska klicka på i Supabase och GitHub. Utan Supabase fungerar appen ändå, men
bara lokalt.

För lokal utveckling med synk: kopiera `.env.example` till `.env.local` och
fyll i samma värden.

### Bra att veta

- Supabase gratisnivå pausar projekt som inte används på en vecka. Det väcks
  igen från Supabase-panelen, och ingen data försvinner.
- Gratisnivån skickar bara några få inloggningsmejl per timme. För fler, koppla
  in en egen SMTP-tjänst under *Authentication → Emails*.
- GitHub Pages för privata repon kräver ett betalt GitHub-konto.

## Hur synken fungerar

- All data finns först lokalt. Synk sker i bakgrunden vid start, strax efter
  varje ändring, vid realtidsbesked från en annan enhet, när nätet kommer
  tillbaka och var 60:e sekund.
- Varje kund, projekt, tryck och inställning är en rad i tabellen `items`.
  Radnivåsäkerhet (RLS) gör att varje användare bara kommer åt sina egna rader.
- Om samma rad ändrats på två enheter vinner den senaste ändringen. Tryck är
  egna rader och kan därför aldrig krocka.
- Vid utloggning tas datan bort från enheten. Den finns kvar i kontot.
- Synklogiken (`src/core/sync.ts`) är oberoende av Supabase och testas med två
  simulerade enheter.

## Struktur

```
src/core/      Domänlogik utan beroenden (model, sync, xlsx, storage)
src/sync/      Supabase-koppling
src/ui/        React-komponenter
supabase/      Databasschema
public/        PWA-manifest, service worker, ikoner
```

`src/core` är avsiktligt fristående så att den kan återanvändas i en iOS-app,
antingen genom att paketera webbappen med Capacitor eller genom att porta
logiken till Swift. `storage.ts` är det enda stället som rör lagring och kan
bytas mot synk eller SwiftData.
