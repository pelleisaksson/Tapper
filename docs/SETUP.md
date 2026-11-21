# Slira: privat kod, egen domän och inloggning med kod

Den här guiden tar Slira från `pelleisaksson.github.io/Tapper` till
**https://slira.app**, gör koden privat, slår på dagliga säkerhetskopior och
förbereder inloggning med sexsiffrig kod. Bocka av allt eftersom.

Gör delarna i ordning. Appen fungerar som vanligt på den gamla adressen ända
tills du flyttar dina enheter i del 6.

| Del | Vad | Tid |
|---|---|---|
| 1 | GitHub Pro och privat repo | 5 min |
| 2 | slira.app hos Loopia och GitHub | 15 min plus väntan |
| 3 | sliraapp.com skickas vidare | 5 min |
| 4 | Supabase Pro och säkerhetskopior | 5 min |
| 5 | Resend: inloggningsmejl från slira.app | 20 min plus väntan |
| 6 | Flytta dina enheter | 5 min per enhet |

> **Klistra aldrig in** databaslösenordet, nyckeln `service_role` (eller
> `secret`) eller Resends API-nyckel i appen, i chatten eller i repot. Resends
> nyckel ska bara in i Supabase, i del 5.

---

## Del 1: GitHub Pro och privat repo

Med GitHub Pro kan repot vara privat och ändå publiceras med GitHub Pages
precis som nu. Inget i arbetsgången ändras.

- [ ] Gå till **https://github.com/settings/billing**. Klicka **Upgrade** vid
      *GitHub Pro* och genomför betalningen.
- [ ] Öppna repot och klicka **Settings** (fliken högst upp).
- [ ] Scrolla längst ner till **Danger Zone** och klicka **Change visibility**.
- [ ] Välj **Make private** och bekräfta. GitHub ber dig skriva in repots namn.
- [ ] Gå till **Settings → Pages** och kontrollera att **Source** fortfarande
      är *GitHub Actions*.

*Kontroll:* den gamla adressen `https://pelleisaksson.github.io/Tapper/`
fungerar fortfarande.

> Jag kommer fortfarande åt repot och kan göra ändringar och pull requests som
> förut.

---

## Del 2: slira.app hos Loopia och GitHub

DNS ligger kvar hos Loopia. Du behöver alltså **inte** byta namnservrar.

### 2a. Verifiera domänen i GitHub

Verifieringen hindrar någon annan från att koppla din domän till sin sida.

- [ ] På GitHub: klicka på din **profilbild** uppe till höger och välj
      **Settings**. Det ska vara kontots inställningar, inte repots.
- [ ] Klicka **Pages** i vänstermenyn och sedan **Add a domain**.
- [ ] Skriv `slira.app` och klicka **Add domain**.
- [ ] GitHub visar en TXT-post med ett namn som börjar på
      `_github-pages-challenge-pelleisaksson` och ett långt värde. Låt sidan
      vara öppen.

### 2b. Lägg in posterna hos Loopia

- [ ] Logga in i **Loopia Kundzon** och klicka på domänen **slira.app**.
- [ ] Öppna **DNS-inställningarna** (DNS-editorn) för domänen.
- [ ] **Ta bort** de A-, AAAA- och CNAME-poster som Loopia har lagt in för
      `@`, `www` och `*`. De pekar på Loopias parkeringssida.
- [ ] Lägg till **TXT-posten från GitHub** (2a). Använd namnet som underdomän
      (`_github-pages-challenge-pelleisaksson`) och klistra in värdet.
- [ ] Under underdomänen **@**, lägg till fyra **A**-poster:
      `185.199.108.153`, `185.199.109.153`, `185.199.110.153` och
      `185.199.111.153`.
- [ ] Under **@**, lägg till fyra **AAAA**-poster:
      `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`
      och `2606:50c0:8003::153`.
- [ ] Skapa underdomänen **www** med en **CNAME**-post till
      `pelleisaksson.github.io`.

### 2c. Koppla domänen till appen

- [ ] Tillbaka på GitHub (2a): klicka **Verify**. Om det inte går direkt,
      vänta en stund och försök igen. Det kan ta upp till några timmar.
- [ ] Gå till repot och **Settings → Pages**. Under **Custom domain**, skriv
      `slira.app` och klicka **Save**.
- [ ] Vänta tills det står **DNS check successful**.
- [ ] Kryssa i **Enforce HTTPS** när rutan blir klickbar. Det kan ta upp till
      en timme.

> Adresser som slutar på **.app** fungerar bara med https. Sidan visar därför
> ett fel tills GitHub har utfärdat certifikatet, även om allt annat är rätt.
> Det är normalt.

*Kontroll:* **https://slira.app** visar Slira, och den gamla github.io-adressen
skickar vidare dit.

---

## Del 3: sliraapp.com skickas vidare till slira.app

- [ ] I Loopia Kundzon: klicka på **sliraapp.com** och leta upp
      **omdirigering**, *vidarebefordring* eller *webbomdirigering*.
- [ ] Ställ in att domänen ska skickas vidare till `https://slira.app`. Välj
      **permanent (301)** om du får välja, och gör samma sak för
      **www.sliraapp.com** om den räknas separat.

*Kontroll:* **http://sliraapp.com** hamnar på slira.app.

> Om **https**://sliraapp.com visar en varning om certifikat stödjer Loopias
> omdirigering bara http. Säg till i så fall, så flyttar vi just den domänen
> till Cloudflare, som klarar båda.

---

## Del 4: Supabase Pro och säkerhetskopior

- [ ] I Supabase: klicka på din **organisation** och gå till **Billing**.
- [ ] Klicka **Upgrade** till **Pro** och genomför betalningen.
- [ ] Gå till projektet och **Database → Backups**. Dagliga säkerhetskopior
      visas där från och med nästa dygn.

*Kontroll:* projektet står som **Pro**, och efter ett dygn finns en
säkerhetskopia under **Backups**.

---

## Del 5: Resend skickar inloggningsmejlen

Med en egen e-posttjänst kan mejlmallarna redigeras, inloggningskoden komma
med i mejlet och mejl skickas till vem som helst, från `inloggning@slira.app`.

### 5a. Verifiera slira.app i Resend

- [ ] Skapa ett konto på **https://resend.com**.
- [ ] Klicka **Domains → Add Domain**, skriv `slira.app` och välj regionen
      **Ireland (eu-west-1)**.
- [ ] Resend visar några DNS-poster: en **MX** och en **TXT** för
      underdomänen `send`, en **TXT** för `resend._domainkey` och eventuellt
      en **TXT** för `_dmarc`.
- [ ] Lägg in exakt de posterna hos Loopia, i DNS-inställningarna för
      **slira.app**, med namn och värden som Resend visar.
- [ ] Klicka **Verify DNS Records** i Resend. Vänta tills domänen står som
      **Verified**. Det tar från några minuter till några timmar.

### 5b. Skapa en API-nyckel

- [ ] I Resend: klicka **API Keys → Create API Key**.
- [ ] Namn: `Supabase`. Behörighet: **Sending access**. Domän: `slira.app`.
- [ ] Kopiera nyckeln. Den visas bara en gång. Klistra in den direkt i 5c och
      spara den inte någon annanstans.

### 5c. Koppla Resend till Supabase

- [ ] I Supabase: gå till **Authentication → Emails → SMTP Settings** och slå
      på **Enable Custom SMTP**.
- [ ] Fyll i:
  - **Sender email:** `inloggning@slira.app`
  - **Sender name:** `Slira`
  - **Host:** `smtp.resend.com`
  - **Port:** `465`
  - **Username:** `resend`
  - **Password:** API-nyckeln från 5b
- [ ] Klicka **Save**.

### 5d. Lägg in koden i mejlen

- [ ] Gå till **Authentication → Emails → Templates**.
- [ ] Välj mallen **Magic Link**. Ämne: `Din inloggningskod till Slira`.
      Ersätt innehållet med:

```html
<h2>Logga in i Slira</h2>
<p>Din kod:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>Skriv in koden i appen. Koden gäller i en timme.</p>
```

- [ ] Gör samma sak med mallen **Confirm signup**, som används första gången
      en ny e-postadress loggar in.
- [ ] Om du vill: översätt mallen **Reset Password** till svenska.

### 5e. Uppdatera adresserna i Supabase

- [ ] Gå till **Authentication → URL Configuration**.
- [ ] Ändra **Site URL** till `https://slira.app/` och klicka **Save**.
- [ ] Under **Redirect URLs**, klicka **Add URL** och lägg till
      `https://slira.app/`. Behåll den gamla github.io-adressen tills alla
      dina enheter har flyttat.

*Kontroll:* öppna https://slira.app, tryck **Logga in med e-postkod** under
inloggningen och skicka en kod till dig själv. Mejlet kommer från
`inloggning@slira.app` och innehåller en sexsiffrig kod som loggar in dig.

> **Säg till när del 5 är klar.** Då gör jag inloggning med kod till standard i
> appen. Lösenordet blir då bara ett alternativ.

---

## Del 6: Flytta dina enheter

Webbläsaren ser den nya adressen som en ny app. Datan följer därför inte med
automatiskt, men hämtas från ditt konto när du loggar in. Gör så här på
varje enhet:

- [ ] Öppna den **gamla** appen och kontrollera att det står **Synkad** överst
      under kugghjulet.
- [ ] Ta bort den gamla appen från hemskärmen.
- [ ] Öppna **https://slira.app** i Safari, tryck på delningsknappen och välj
      **Lägg till på hemskärmen**.
- [ ] Logga in. Kunder, projekt, tid och kommentarer hämtas från kontot.

När alla enheter har flyttat kan du ta bort den gamla github.io-adressen
under **Redirect URLs** i Supabase.

---

## Om något krånglar

| Problem | Lösning |
|---|---|
| Change visibility går inte att välja | Del 1: kontrollera att GitHub Pro är aktivt under Billing. |
| GitHub säger att domänen inte går att verifiera | Kontrollera TXT-posten hos Loopia: namn och värde exakt som GitHub visar. Vänta en stund och försök igen. |
| DNS check misslyckas | Kontrollera att A- och AAAA-posterna finns under @ och att Loopias parkeringsposter är borttagna, även `*`. |
| slira.app visar ett fel om säker anslutning | Certifikatet är inte klart än. Vänta upp till en timme och kryssa sedan i **Enforce HTTPS**. |
| Resend verifierar inte domänen | Jämför posterna hos Loopia med Resends lista tecken för tecken. Vissa DNS-editorer lägger till domännamnet själva, så skriv bara `send`, inte `send.slira.app`. |
| Inget inloggningsmejl kommer | Titta i skräpposten. Kontrollera SMTP-uppgifterna i Supabase och att domänen är verifierad i Resend. Under **Logs** i Resend syns varje mejl. |
| Mejlet saknar kod | Mallen i 5d är inte sparad. Kontrollera både *Magic Link* och *Confirm signup*. |
| "Synk är inte aktiverad" | Variablerna under GitHub **Settings → Secrets and variables → Actions → Variables** saknas. De ska finnas kvar efter att repot gjorts privat. |

---

# Bilaga: ursprunglig installation (redan gjord)

> Det här är den första installationen av Supabase och GitHub Pages från
> november 2026. Den är redan gjord och ligger kvar som referens.

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
