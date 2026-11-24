# FamilyCart

FamilyCart is een mobile-first gedeelde boodschappenlijst voor gezinnen. Het project is opgezet als portfolio-app met een veilige Supabase-backend, realtime lijstupdates en een PWA-shell.

## Probleem en oplossing

In een huishouden staan boodschappen vaak verspreid over berichten en losse lijstjes. FamilyCart brengt toevoegen, verdelen en afvinken samen in één gezinslijst. Leden zien wijzigingen live, inclusief wie een product heeft toegevoegd of gekocht.

## Functionaliteiten

- E-mailregistratie en inloggen via Supabase Auth.
- Een gezin aanmaken of deelnemen met een tijdelijke, gehashte uitnodigingscode.
- Gedeelde lijst met hoeveelheid, eenheid, notitie, categorie, dringend-markering, favorieten en aankoopherkenning.
- Database-constraint voorkomt dubbele actieve producten, ook bij gelijktijdige invoer.
- Gekochte producten en activiteitenoverzicht met naam en tijdstip.
- Winkelmodus met categorieën, voortgang en gedeelde winkelstatus.
- Lokale categorisering en suggesties uit eerdere aankopen.
- Nederlandse, Engelse en Arabische interface; Arabisch schakelt de documentrichting naar RTL.
- Licht/donker/systeemthema, responsive mobiele navigatie en toegankelijk geëtiketteerde bediening.
- PWA-manifest, service worker en een beperkte offline wachtrij voor lijstwijzigingen.
- Offline status en wachtende wijzigingen worden in de interface getoond.

## Technologie en architectuur

- React, TypeScript, Vite en Tailwind CSS v4.
- Supabase Auth, PostgreSQL, RLS en Realtime.
- Lucide React-iconen en `vite-plugin-pwa`.
- `src/app.tsx` bevat de schermen en UI-state; `src/lib/data.ts` is de Supabase-datalaag; `src/lib/offline.ts` beheert de lokale cache en wachtrij; `src/lib/categories.ts` en `src/lib/i18n.ts` bevatten respectievelijk categorisering en vertalingen.
- `supabase/migrations/` bevat de database, relaties, indexes, triggers, RPC's en RLS-policies.

## Databaseontwerp en beveiliging

De migratie maakt `profiles`, `families`, `family_members`, `family_invites`, `categories`, `shopping_items`, `purchase_history`, `activity_logs`, `shopping_sessions` en `user_preferences`.

Alle data met gezinscontext is voorzien van een `family_id`; RLS controleert gezinslidmaatschap. Uitnodigingscodes worden willekeurig gegenereerd, alleen als SHA-256-digest opgeslagen, alleen via RPC gecontroleerd en verlopen na 30 dagen. De frontend gebruikt uitsluitend de Supabase publishable/anon key. Plaats nooit een service-role key in browsercode of `.env`.

## Lokaal starten

Vereist Node.js 20.19+ (of 22.12+) en npm.

```powershell
npm install
Copy-Item .env.example .env.local
# Vul VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY in .env.local in.
npm run dev
```

Zonder Supabase-variabelen toont de app een configuratiescherm in plaats van voorbeeld- of nepgegevens.

## Supabase configureren

1. Maak een Supabase-project aan en kopieer de Project URL en publishable key (of legacy anon key) naar `.env.local`.
2. Voer `supabase/migrations/202611240001_initial.sql` uit via de Supabase SQL Editor of Supabase CLI.
3. Als de eerste migratie al eerder is uitgevoerd, voer dan ook `supabase/migrations/202611240002_family_setup_permissions.sql` uit om de tabelrechten en gezinsselectiepolicy bij te werken.
4. Schakel Email-aanmelding in bij **Authentication → Providers**. Configureer e-mailbevestiging en een SMTP-provider volgens je productiebeleid.
5. Voeg de lokale URL en productie-URL toe aan **Authentication → URL Configuration** (Site URL en Redirect URLs).
6. Controleer dat de `supabase_realtime`-publicatie beschikbaar is; de migratie voegt de gedeelde tabellen eraan toe.
7. Stel voor productie e-mail rate limits, CAPTCHA/anti-abuse, back-ups en monitoring in. De service-role sleutel blijft uitsluitend op de server.

De eerste eigenaar maakt een gezin aan en deelt daarna een uitnodigingscode. Er is geen statisch wachtwoord of ingebouwd testaccount.

## Tests en build

```powershell
npm test
npm run build
```

De lokale tests controleren categorisering. De build controleert TypeScript en bundeling. Een echte Auth/RLS/Realtime-controle vereist een geconfigureerd Supabase-project.

## Deployment (Netlify / Vercel)

Gebruik de projectroot als base directory, `npm run build` als build command en `dist` als output directory. Configureer `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` als deployment environment variables en voeg de deployment-URL toe aan Supabase Auth redirect URLs. Vite levert SPA fallback via `index.html`; de PWA-serviceworker cachet de applicatieshell, niet de gezinsdata.

## Demo-omgeving

De demo is optioneel en gebruikt echte Supabase Auth/Realtime in een **apart Supabase-project**. De repository bevat een fictieve gegevens-seed in `supabase/demo_seed.sql` en een apart `.env.demo.example`. Maak in het demo-project de database aan met de migratie, maak en bevestig `demo@familycart.example` via Supabase Auth, voer daarna de seed uit en configureer de demo-login in de profielmetadata. Bouw een aparte Netlify/Vercel-deployment met de demo-variabelen. De app toont dan een knop **Bekijk de demo**.

De demo-e-mail en het wachtwoord zijn per definitie zichtbaar in de publieke frontendbundle. Gebruik daarom uitsluitend een geïsoleerd demo-project, fictieve inhoud en een demo-account zonder productiegegevens; stel een periodieke reset in. Deze repository provisiont geen Supabase-project of publieke demo-login automatisch.

## Status en externe configuratie

| Onderdeel | Status |
|---|---|
| Auth-, familie-, lijst-, activiteit- en aankoopgeschiedenisschermen | Geïmplementeerd; vereist Supabase-configuratie |
| RLS, uitnodigingshashing, duplicaatconstraint en realtime-publicatie | In SQL-migratie; vereist uitvoering en verificatie in Supabase |
| PWA install-shell en offline wijzigingswachtrij | Geïmplementeerd; serviceworker/offlinegedrag moet op HTTPS op apparaten worden getest |
| Pushmeldingen | Niet geïmplementeerd; vereist aparte push-service en VAPID-configuratie |
| Profielfoto-upload | Alleen URL-profielveld; Supabase Storage bucket/uploadregels zijn niet ingericht |
| Geïsoleerde portfolio-demo | Seed en optionele login aanwezig; apart Supabase-project, account en deployment vereisen configuratie |

## Bekende beperkingen

- Offline cache is browser-/apparaatgebonden; er is geen achtergrondsync wanneer de browser volledig gesloten is. De wachtrij synchroniseert wanneer de app opnieuw online opent.
- Op een gelijktijdige toevoeging van hetzelfde product wint de database-constraint. De tweede offline wijziging wordt bij synchronisatie afgewezen als duplicaat, niet samengevoegd in hoeveelheid.
- Supabase Realtime werkt zolang de sessie en netwerkverbinding actief zijn.
- Meldingen voor nieuwe shoppers zijn in-app; pushmeldingen zijn nog niet geconfigureerd.
- `npm audit --omit=dev` meldt geen kwetsbaarheden in runtime-dependencies. De volledige ontwikkelboom meldt momenteel drie matige advisories in de Workbox-buildketen (`glob`/`minimatch`); die raken build tooling, niet de runtime-dependencies. Herbeoordeel dit bij dependency-updates.
