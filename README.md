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
- **Synk mellan enheter** via Supabase, med inloggning med e-postkod. Appen
  fungerar offline och synkar när nätet är tillbaka. Ändringar syns på andra
  enheter i realtid.
- **Fungerar offline.** Kan installeras på hemskärmen som PWA.

## Utveckling

```bash
npm install
npm run dev      # utvecklingsserver
npm test         # enhetstester för kärnlogiken
npm run build    # produktionsbygge till dist/
```

## Komma igång med synk och publicering

Allt detta görs en gång. Utan Supabase fungerar appen ändå, men bara lokalt.

### 1. Supabase

1. Skapa ett konto och ett nytt projekt på [supabase.com](https://supabase.com).
   Välj regionen *North EU (Stockholm)*.
2. **SQL Editor** → klistra in innehållet i [`supabase/schema.sql`](supabase/schema.sql)
   → *Run*.
3. **Authentication → Emails → Templates → Magic Link:** lägg till koden i
   mejlet, till exempel:
   ```html
   <h2>Logga in i Tapper</h2>
   <p>Din kod: <strong>{{ .Token }}</strong></p>
   <p>Eller <a href="{{ .ConfirmationURL }}">logga in med länken</a>.</p>
   ```
   Koden behövs eftersom en app på iPhones hemskärm inte kan ta emot en
   inloggningslänk från Mail.
4. **Authentication → URL Configuration:**
   - *Site URL*: `https://pelleisaksson.github.io/Tapper/`
   - *Redirect URLs*: lägg till samma adress och `http://localhost:5173/`
5. **Project Settings → API:** kopiera *Project URL* och *anon public key*.

### 2. GitHub Pages

1. **Settings → Pages → Source:** välj *GitHub Actions*.
2. **Settings → Secrets and variables → Actions → Variables:** skapa
   `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY` med värdena från steg 1.5.
3. Varje push till `main` bygger, testar och publicerar appen på
   `https://pelleisaksson.github.io/Tapper/`. Det går också att köra manuellt
   under *Actions*.

### 3. Lokalt

Kopiera `.env.example` till `.env.local` och fyll i samma värden.

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
