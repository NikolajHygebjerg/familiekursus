# Familiekursus – Workshop oversigter

Webapp der viser oversigter over workshop-tilmeldinger fra Airtable. Perfekt til at deploye på Vercel.

## Funktioner

Ved første besøg vælger brugeren sit familienavn (eller "Kursusleder" for fuld adgang). Valget huskes i browseren.

- **Antal på workshops**: Oversigt over alle workshops og antal tilmeldte (med udfoldelse af deltagerliste)
- **Tilmeldte på workshops**: Viser din families workshop-tilmeldinger. Kursusleder kan søge og vælge andre familier
- **Mangler**: (Kun for kursusleder) Dem der har betalt men ikke har valgt workshops
- **Program**: Ugeprogram (liste over dagene) og Dagens program (med familiens workshops og hvem der er på hvad)

## Opsætning

### 1. Airtable API-nøgle

1. Gå til [Airtable Developer Hub](https://airtable.com/create/tokens)
2. Opret et nyt Personal Access Token
3. Giv tokenet følgende scope: `data.records:read`
4. Vælg din base (familiekursus-basen) under "Scopes"

### 2. Lokal udvikling

```bash
# Installer afhængigheder
npm install

# Opret .env.local med din API-nøgle
echo "AIRTABLE_API_KEY=patxxxxxxxxxxxxxxxxxxxx" > .env.local

# Kør udviklingsserver
npm run dev
```

Åbn [http://localhost:3000](http://localhost:3000)

### 3. Deploy til Vercel

1. Push projektet til GitHub
2. Gå til [vercel.com](https://vercel.com) og importer projektet
3. Tilføj miljøvariabel under **Settings → Environment Variables**:
   - **Name**: `AIRTABLE_API_KEY`
   - **Value**: Din Airtable API-nøgle (pat...)

4. Deploy – Vercel bygger automatisk

## Teknisk

- **Next.js 14** med App Router
- **Airtable Web API** til data
- **Tailwind CSS** til styling
- Data caches i 60 sekunder for bedre performance

## Airtable-struktur

**2026-tabellen** (workshop-tilmeldinger) skal have:
- `Familie`, `Navn`
- `A Workshop 1`, `A Workshop 2`, `A Workshop 3`, `A Workshop 4`, `A Workshop Forældre`

**Betalt-tabellen** (dem der har betalt) skal have:
- `Navn` (sammenlignes med kolonnen Navn i 2026)

Hvis dine kolonnenavne afviger, kan du redigere `src/lib/airtable.ts` og tilføje alternative feltnavne.

## Program (Airtable)

Programmet hentes fra **Program**-tabellen i Airtable.

### Forventet struktur

Én række per programpunkt med kolonnerne:

- **A Dag**: Mandag, Tirsdag, Onsdag, Torsdag, Fredag, Lørdag, Søndag
- **A Dato**: Dato (fx 13/7/2026)
- **A Tid**: Klokkeslæt eller interval (fx 8.30, 9.30-11.45, 14-16.00)
- **A Titel**: Aktivitetens navn (fx Morgenmad, Workshop 1, Aftengrupper)
- **A Workshop**: Workshop-detaljer (kun for Workshop 1-4, Forældreworkshop, Aftengrupper) – komma- eller linjeskift-separeret liste
