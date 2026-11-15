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

### Steg 3: Kontrollera inloggning med e-post

Appen loggar in med e-post och lösenord. Det fungerar med Supabase
standardinställningar på gratisnivån, och mejltexterna behöver inte ändras.

- [ ] Klicka **Authentication** i vänstermenyn (ikonen med en person).
- [ ] Klicka **Sign In / Providers** (i vissa versioner **Providers**) och
      sedan **Email**.
- [ ] Kontrollera att **Enable Email provider** är påslaget. Det är det normalt.
- [ ] Låt **Confirm email** vara påslaget. Då får du ett mejl med en länk
      första gången du skapar kontot.
- [ ] Klicka **Save** om du ändrade något.

Bekräftelsemejlet och mejlet för "Glömt lösenord" kommer från Supabase
(*Supabase Auth*) och är på engelska. Det går att ändra när du har Pro-konto,
se [Senare](#senare-egna-mejltexter-och-inloggning-med-kod) längst ner.

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

Adresserna för länkarna i mejlen ställer du in i steg 8, när du vet appens
adress.

---

## Del 2: GitHub (publicering)

### Steg 5: Slå på GitHub Pages

- [ ] Öppna repot på **https://github.com/pelleisaksson/Tapper**.
- [ ] Klicka fliken **Settings** (högst upp, till höger).
- [ ] Klicka **Pages** i vänstermenyn, under rubriken *Code and automation*.
- [ ] Under **Build and deployment → Source**, välj **GitHub Actions**.
      Inget mer behöver sparas.

> Står det att Pages inte är tillgängligt? Då är repot privat och ditt konto
> saknar betalplan. Antingen gör du repot publikt (**Settings → General**,
> längst ner, **Change visibility**), eller så väljer vi en annan tjänst,
> till exempel Netlify.

### Steg 6: Lägg in Supabase-värdena

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

### Steg 7: Publicera appen

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

### Steg 8: Tillåt appens adress i Supabase

- [ ] I Supabase: **Authentication → URL Configuration**.
- [ ] **Site URL:** klistra in appens adress från steg 7, med `/` på slutet.
      Klicka **Save**.
- [ ] Under **Redirect URLs**, klicka **Add URL**, klistra in samma adress och
      spara.
- [ ] Lägg också till `http://localhost:5173/` om du vill kunna köra appen
      lokalt.

### Steg 9: Skapa konto och testa

- [ ] Öppna appens adress på telefonen och gå till **Kunder**. Överst finns
      *Synk mellan enheter*.
- [ ] Tryck **Skapa konto**. Fyll i e-post och ett lösenord på minst 6 tecken
      och tryck **Skapa konto**.
- [ ] Öppna mejlet från Supabase (ämne *Confirm Your Signup*) och klicka på
      länken. Den får öppnas i vilken webbläsare som helst.
- [ ] Gå tillbaka till appen, skriv in lösenordet och tryck **Logga in**. Status
      ska bli **Synkad**. Tid du redan registrerat följer med upp.
- [ ] Logga in på surfplattan med samma e-post och lösenord. Dina kunder och
      projekt dyker upp där.
- [ ] Tryck på en platta på den ena enheten. Inom ett par sekunder syns tiden
      på den andra.

### Steg 10: Lägg appen på hemskärmen

- [ ] **iPhone/iPad:** öppna adressen i **Safari** och tryck på delningsknappen
      (rutan med en pil uppåt). Välj **Lägg till på hemskärmen**.
- [ ] Öppna appen från hemskärmen och logga in med e-post och lösenord.
      Hemskärmsappen har egen inloggning, skild från Safari.

## Uppdatering: Kommentarer (november 2026)

Om databasen skapades före november 2026 behöver den tillåta kommentarer.
Gör det här en gång:

- [ ] Gå till Supabase och klicka **SQL Editor** i vänstermenyn, sedan **+ New query**.
- [ ] Klistra in innehållet i [`supabase/2026-11-kommentarer.sql`](../supabase/2026-11-kommentarer.sql):

```sql
alter table public.items drop constraint if exists items_kind_check;
alter table public.items add constraint items_kind_check
  check (kind in ('customer', 'project', 'tap', 'note', 'settings'));
```

- [ ] Klicka **Run**. Det ska stå *Success. No rows returned*.
- [ ] Öppna appen och tryck **Synka nu** under kugghjulet. Kommentarer som
      skrivits innan dess skickas upp nu.

Tills det är gjort sparas kommentarerna på enheten. Allt annat synkas som
vanligt, och under kugghjulet står att kommentarerna väntar på databasen.

---

## Om något krånglar

| Problem | Lösning |
|---|---|
| Inget mejl kommer | Titta i skräpposten. Gratisnivån skickar bara några mejl per timme, så vänta en stund och försök igen. |
| "E-postadressen är inte bekräftad" | Klicka på länken i mejlet *Confirm Your Signup* och logga sedan in igen. |
| Länken i mejlet leder till fel sida | Steg 8 är inte gjort, eller adressen stämmer inte exakt. Kontrollera **Site URL** och **Redirect URLs**. |
| Glömt lösenord | Tryck **Glömt lösenord?** i appen. Du får en länk som öppnar appen, där du väljer ett nytt lösenord. |
| "Synk är inte aktiverad" i appen | Variablerna i steg 6 saknas eller är felstavade. Rätta dem och kör om under **Actions → Publicera på GitHub Pages → Run workflow**. |
| "Kunde inte synka" | Kontrollera att steg 2 gick igenom, alltså att tabellen `items` finns. Skicka felmeddelandet som visas till mig. |
| Supabase säger att projektet är pausat | Gratisprojekt pausas efter en vecka utan användning. Klicka **Restore project** i Supabase. Ingen data försvinner. |
| Appen visar en gammal version | Stäng appen helt och öppna den igen. Uppdateringar laddas vid nästa start. |

---

## Senare: egna mejltexter och inloggning med kod

På gratisnivån går det inte att ändra Supabase mejltexter utan egen
e-posttjänst (SMTP). När du har Pro-konto, eller kopplat in egen SMTP under
**Authentication → Emails → SMTP Settings**, kan du:

1. Gå till **Authentication → Emails → Templates** och översätta mallarna
   *Confirm signup* och *Reset Password* till svenska.
2. Lägga till en sexsiffrig kod i mallen **Magic Link**. Då fungerar knappen
   **Logga in med e-postkod** i appen, och man slipper lösenord:

```html
<h2>Logga in i Tapper</h2>
<p>Din kod:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>Skriv in koden i appen. Du kan också <a href="{{ .ConfirmationURL }}">logga in med den här länken</a> om du öppnar den på samma enhet.</p>
```

Med egen SMTP slipper du också gränsen på några få mejl per timme.
