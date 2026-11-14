# Så sätter du upp synk och publicering

Det tar ungefär 20 minuter och görs bara en gång. Följ stegen i ordning.
Bocka av allt eftersom.

Du kommer att behöva skriva ner två värden längs vägen, **Project URL** och
**anon-nyckeln**. Ha ett anteckningsdokument öppet.

> **Klistra aldrig in** databaslösenordet eller nyckeln `service_role` (eller
> `secret`) någonstans i GitHub eller i appen. Den enda nyckel appen ska ha är
> den publika (*anon* eller *publishable*).

---

## Del 1: Supabase (databas och inloggning)

### Steg 1: Skapa konto och projekt

- [ ] Gå till **https://supabase.com** och klicka **Start your project**.
      Logga in, gärna med ditt GitHub-konto.
- [ ] Klicka **New project**.
  - **Organization:** din egen (skapas automatiskt).
  - **Project name:** `tapper`
  - **Database Password:** klicka **Generate a password** och spara lösenordet
    i din lösenordshanterare. Appen behöver det inte, men du kan behöva det
    senare.
  - **Region:** *North EU (Stockholm)*
  - **Plan:** Free
- [ ] Klicka **Create new project** och vänta 1–2 minuter tills projektet är klart.

### Steg 2: Skapa tabellen

- [ ] Klicka **SQL Editor** i vänstermenyn (ikonen ser ut som `>_`).
- [ ] Klicka **+ New query** (eller plustecknet).
- [ ] Öppna filen [`supabase/schema.sql`](../supabase/schema.sql) här i repot,
      markera allt och kopiera.
- [ ] Klistra in i SQL-rutan i Supabase och klicka **Run** (eller tryck
      Ctrl/Cmd + Enter).
- [ ] Det ska stå **Success. No rows returned**. Om en ruta frågar om du verkligen
      vill köra frågan, svara ja.

*Kontroll:* Klicka **Table Editor** i vänstermenyn. Där ska en tabell som heter
`items` finnas.

### Steg 3: Lägg till inloggningskoden i mejlet

Standardmejlet innehåller bara en länk. Appen behöver också en kod, eftersom
en app på iPhones hemskärm inte kan ta emot länkar från Mail.

- [ ] Klicka **Authentication** i vänstermenyn (ikonen med en person).
- [ ] Klicka **Emails** (i vissa versioner **Email Templates**) och välj fliken
      **Templates**.
- [ ] Välj mallen **Magic Link**.
- [ ] **Subject:** `Din inloggningskod till Tapper`
- [ ] **Body:** ta bort allt och klistra in:

```html
<h2>Logga in i Tapper</h2>
<p>Din kod:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>Skriv in koden i appen. Du kan också <a href="{{ .ConfirmationURL }}">logga in med den här länken</a> om du öppnar den på samma enhet.</p>
```

- [ ] Klicka **Save**.
- [ ] Gör samma sak för mallen **Confirm signup**, med samma text. Den används
      första gången en ny e-postadress loggar in.

### Steg 4: Hämta adressen och nyckeln

- [ ] Klicka **Connect** högst upp i Supabase. Du kan också gå till
      **Project Settings** (kugghjulet längst ner till vänster) och sedan
      **API** eller **Data API**.
- [ ] Kopiera **Project URL**. Den ser ut som `https://abcdefghijkl.supabase.co`.
      Skriv ner den.
- [ ] Gå till **Project Settings → API Keys**.
  - Om det finns en flik **Legacy API keys**: kopiera nyckeln **anon public**.
    Den är lång och börjar med `eyJ`.
  - Annars: kopiera **Publishable key**, som börjar med `sb_publishable_`.
- [ ] Skriv ner nyckeln.

Steg 5 (adresser för inloggningslänken) gör du i Del 3, när du vet appens
adress.

---

## Del 2: GitHub (publicering)

### Steg 6: Slå på GitHub Pages

- [ ] Öppna repot på **https://github.com/pelleisaksson/Tapper**.
- [ ] Klicka fliken **Settings** (högst upp, till höger).
- [ ] Klicka **Pages** i vänstermenyn, under rubriken *Code and automation*.
- [ ] Under **Build and deployment → Source**, välj **GitHub Actions**.
      Inget mer behöver sparas.

> Står det att Pages inte är tillgängligt? Då är repot privat och ditt konto
> saknar betalplan. Antingen gör du repot publikt (**Settings → General**,
> längst ner, **Change visibility**), eller så väljer vi en annan tjänst,
> till exempel Netlify.

### Steg 7: Lägg in Supabase-värdena

- [ ] Fortfarande i **Settings**: klicka **Secrets and variables → Actions**
      i vänstermenyn.
- [ ] Välj fliken **Variables**. Det ska vara Variables, inte Secrets.
- [ ] Klicka **New repository variable**:
  - **Name:** `VITE_SUPABASE_URL`
  - **Value:** din Project URL från steg 4
  - Klicka **Add variable**.
- [ ] Klicka **New repository variable** igen:
  - **Name:** `VITE_SUPABASE_ANON_KEY`
  - **Value:** nyckeln från steg 4
  - Klicka **Add variable**.

Namnen måste stavas exakt så, med stora bokstäver och understreck.

### Steg 8: Publicera appen

Koden ligger än så länge på grenen `claude/timetracking-webapp-6quoqq`. Appen
publiceras när den kommer in på `main`.

- [ ] Gå till fliken **Pull requests**. Klicka **New pull request**.
      Du kan också klicka på den gula rutan *Compare & pull request* om den visas.
- [ ] Välj **base: `main`** och **compare: `claude/timetracking-webapp-6quoqq`**.
- [ ] Klicka **Create pull request** två gånger, och sedan **Merge pull request**
      och **Confirm merge**.
- [ ] Gå till fliken **Actions**. Där körs nu *Publicera på GitHub Pages*.
      Vänta tills den får en grön bock, vilket tar 1–2 minuter.
- [ ] Gå tillbaka till **Settings → Pages**. Överst står nu
      *Your site is live at* med appens adress, troligen
      `https://pelleisaksson.github.io/Tapper/`. **Kopiera den exakta
      adressen.**

> Blev det ett rött kryss i Actions? Klicka på körningen och sedan på det
> steg som misslyckades, och skicka felmeddelandet till mig.

---

## Del 3: Koppla ihop och testa

### Steg 5: Tillåt appens adress i Supabase

- [ ] I Supabase: **Authentication → URL Configuration**.
- [ ] **Site URL:** klistra in appens adress från steg 8, med `/` på slutet.
      Klicka **Save**.
- [ ] Under **Redirect URLs**, klicka **Add URL**, klistra in samma adress och
      spara.
- [ ] Lägg också till `http://localhost:5173/` om du vill kunna köra appen
      lokalt.

### Steg 9: Testa

- [ ] Öppna appens adress på telefonen.
- [ ] Gå till **Kunder**. Överst finns *Synk mellan enheter*. Skriv in din
      e-post och tryck **Skicka kod**.
- [ ] Öppna mejlet, skriv in koden och tryck **Logga in**. Status ska bli
      **Synkad**.
- [ ] Gör samma sak på surfplattan. Dina kunder och projekt dyker upp där.
- [ ] Tryck på en platta på den ena enheten. Inom ett par sekunder syns tiden
      på den andra.

### Steg 10: Lägg appen på hemskärmen

- [ ] **iPhone/iPad:** öppna adressen i **Safari** och tryck på delningsknappen
      (rutan med en pil uppåt). Välj **Lägg till på hemskärmen**.
- [ ] Öppna appen från hemskärmen och logga in en gång till med kod.
      Hemskärmsappen har egen inloggning, skild från Safari.

---

## Om något krånglar

| Problem | Lösning |
|---|---|
| Inget mejl kommer | Titta i skräpposten. Gratisnivån skickar bara några mejl per timme, så vänta en stund och försök igen. |
| Mejlet har ingen kod | Steg 3 är inte sparat. Kontrollera båda mallarna, *Magic Link* och *Confirm signup*. |
| "Synk är inte aktiverad" i appen | Variablerna i steg 7 saknas eller är felstavade. Rätta dem och kör om under **Actions → Publicera på GitHub Pages → Run workflow**. |
| "Kunde inte synka" | Kontrollera att steg 2 gick igenom, alltså att tabellen `items` finns. Skicka felmeddelandet som visas till mig. |
| Supabase säger att projektet är pausat | Gratisprojekt pausas efter en vecka utan användning. Klicka **Restore project** i Supabase. Ingen data försvinner. |
| Appen visar en gammal version | Stäng appen helt och öppna den igen. Uppdateringar laddas vid nästa start. |
