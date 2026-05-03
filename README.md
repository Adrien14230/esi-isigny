# Étoile Sportive d'Isigny — Site Officiel

> Site web statique + 10 agents IA d'auto-update — Vercel + Supabase + Anthropic

[![100 ans](https://img.shields.io/badge/Fondé-1925-yellow?style=flat-square)]()
[![FFF](https://img.shields.io/badge/FFF-501416-blue?style=flat-square)](https://epreuves.fff.fr/competition/club/501416-e-s-isigny-s-mer/club)
[![District](https://img.shields.io/badge/District-Manche-368e40?style=flat-square)]()

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  index.html (statique, déployé sur Vercel CDN)     │
│  ↑                                                  │
│  ├─ Lit chatbot-knowledge.json                      │
│  ├─ Affiche convocations, classements, résultats   │
│  └─ Login licencié + dirigeant via Supabase Auth   │
│                                                     │
│  /api/agents/ (10 fonctions serverless)            │
│  ↑                                                  │
│  ├─ Vercel Cron déclenche selon vercel.json        │
│  ├─ Scrape FFF.fr toutes les semaines              │
│  ├─ Écrit dans Supabase Postgres                   │
│  └─ Génère reports/posts via Claude API            │
└─────────────────────────────────────────────────────┘
```

Voir **[docs-agents.md](docs-agents.md)** pour le détail des 10 agents.

## 🚀 Déploiement en 6 étapes (~30 min)

### 1. Créer les 4 comptes (15 min)

| Service | Lien | À récupérer |
|---|---|---|
| **Vercel** | https://vercel.com/signup | Login + Project URL |
| **Supabase** | https://supabase.com/dashboard | `URL` + `service_key` + `anon_key` |
| **Anthropic** | https://console.anthropic.com | `ANTHROPIC_API_KEY` |
| **Resend** | https://resend.com/signup | `RESEND_API_KEY` |

> 💡 Tous gratuits sauf Anthropic (~3-5€/mois pour ce volume).

### 2. Initialiser Supabase (5 min)

Va sur https://supabase.com/dashboard/project/_/sql/new puis colle :

<details>
<summary>📋 Schéma SQL complet (cliquer pour développer)</summary>

```sql
-- Matchs joués
create table matches (
  id text primary key,
  date timestamptz,
  status text,
  competition text,
  category text,
  team_label text,
  recevant_nom text, recevant_buts int,
  visiteur_nom text, visiteur_buts int,
  esi_home boolean,
  has_report boolean default false,
  posted_to_social boolean default false,
  synced_at timestamptz
);

-- Calendrier à venir
create table fixtures (
  id text primary key,
  date timestamptz, competition text, category text, pool text,
  team_label text, opponent text, opponent_logo text,
  venue text check (venue in ('home','away')),
  synced_at timestamptz
);

-- Classements FFF
create table classements (
  pool_key text, position int, team text,
  pts int, j int, g int, n int, p int,
  bp int, bc int, diff int,
  synced_at timestamptz,
  primary key (pool_key, position)
);

-- News & comptes-rendus auto
create table news (
  id bigserial primary key,
  kind text, match_id text, body text,
  published_at timestamptz
);

-- Convocations
create table convocations (
  id bigserial primary key,
  team_label text, opponent text, match_date timestamptz,
  venue text, call_time text, kit_color text, cars_needed int,
  notes text, published_by text, published_at timestamptz
);

create table convocation_players (
  convocation_id bigint references convocations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  primary key (convocation_id, user_id)
);

-- Photos
create table gallery_photos (
  id bigserial primary key,
  album_key text, source_path text, thumb_path text, webp_path text,
  caption text, created_at timestamptz
);

-- Stats agrégées
create table club_stats (
  id int primary key default 1,
  season text, per_team jsonb, club_totals jsonb,
  updated_at timestamptz
);

-- État SEO
create table seo_state (
  id int primary key default 1,
  meta_description text, events_jsonld jsonb,
  sitemap_lastmod date, updated_at timestamptz
);

-- Historique d'exécution des agents
create table agent_runs (
  id bigserial primary key,
  agent_id text, status text, meta jsonb,
  ran_at timestamptz default now()
);

-- Profils licenciés étendus
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  category text,
  validated boolean default false,
  validated_by text,
  validated_at timestamptz,
  created_at timestamptz default now()
);

-- =========== ROW-LEVEL SECURITY ===========
-- Public read: matches, fixtures, classements, news, gallery_photos
alter table matches enable row level security;
create policy "matches_public_read" on matches for select using (true);

alter table fixtures enable row level security;
create policy "fixtures_public_read" on fixtures for select using (true);

alter table classements enable row level security;
create policy "classements_public_read" on classements for select using (true);

alter table news enable row level security;
create policy "news_public_read" on news for select using (true);

alter table gallery_photos enable row level security;
create policy "gallery_public_read" on gallery_photos for select using (true);

-- Convocations: licenciés validés only
alter table convocations enable row level security;
create policy "convoc_validated_read" on convocations for select using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.validated = true)
);
create policy "convoc_validator_write" on convocations for all using (
  auth.jwt() ->> 'email' = 'adrien.goubert1@icloud.com'
);

-- Profiles: own profile read, validator can update
alter table profiles enable row level security;
create policy "profile_own_read" on profiles for select using (auth.uid() = id);
create policy "profile_own_update" on profiles for update using (auth.uid() = id);
create policy "profile_validator_all" on profiles for all using (
  auth.jwt() ->> 'email' = 'adrien.goubert1@icloud.com'
);
```

</details>

Clique **Run** → toutes les tables et politiques sont créées.

### 3. Cloner et configurer en local (5 min)

```bash
cd "/Users/adriengoubert/Site Web Esi"

# Initialiser git si pas déjà fait
git init -b main
git add .
git commit -m "Initial commit · ESI site + 10 IA agents"

# Installer les deps
npm install

# Copier l'exemple d'env vars
cp .env.example .env.local
```

Puis **édite `.env.local`** avec tes vraies clés (tu en obtiendras 4 à l'étape 1).

### 4. Test local (2 min)

```bash
npm run type-check    # vérifie qu'il n'y a pas d'erreur TS
npm run dev           # lance Vercel dev sur localhost:8765
```

Visite http://localhost:8765 — le site devrait fonctionner. Tu peux tester un agent manuellement :

```bash
curl http://localhost:8765/api/agents/01-fff-results-sync
```

### 5. Déploiement Vercel (3 min)

```bash
npx vercel link              # première fois : crée le projet
npx vercel env pull .env.local
npx vercel --prod            # déploie en production
```

Ou plus simple : connecte ton repo GitHub à Vercel via le dashboard, chaque `git push` redéploie.

À la fin du déploiement, Vercel te donne une URL `esi-isigny.vercel.app`. Tu peux brancher ton domaine `.fr` dans **Settings → Domains** plus tard (15 € à l'année chez OVH/Gandi).

### 6. Configuration des Cron Jobs (auto)

Les 9 cron jobs sont **déjà configurés dans `vercel.json`**. Vercel les active automatiquement au premier déploiement.

Tu peux vérifier dans **Settings → Cron Jobs** du dashboard Vercel.

## ✅ Checklist finale

- [ ] Comptes Vercel + Supabase + Anthropic + Resend créés
- [ ] Schéma SQL exécuté dans Supabase
- [ ] `.env.local` rempli avec les 4 clés
- [ ] `npm install` exécuté
- [ ] `npm run dev` fonctionne en local
- [ ] `npx vercel --prod` exécuté → site online
- [ ] Variables d'environnement copiées dans Vercel dashboard (Settings → Env Vars)
- [ ] Cron jobs visibles dans Vercel dashboard
- [ ] (Optionnel) Domaine `.fr` configuré

## 🛠️ Stack technique

| Couche | Tech |
|---|---|
| Front statique | HTML/CSS vanilla + JS · pas de framework |
| Hébergement | Vercel (CDN global) |
| Serverless functions | Vercel Functions (Node.js 20) |
| Cron | Vercel Cron Jobs |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (email + magic link) |
| Storage | Supabase Storage |
| LLM | Anthropic Claude Haiku 4.5 |
| Emails | Resend |
| Social | Meta Graph API (FB + IG) |

## 📂 Structure du projet

```
.
├── index.html                  # Site complet (~210 KB)
├── manifest.json               # PWA
├── sitemap.xml + robots.txt    # SEO
├── assets/
│   ├── logo-esi.png            # Logo officiel
│   ├── player-hero.png         # Photo joueur (transparent)
│   ├── team-bg.jpg             # Photo équipe
│   ├── logos/                  # 23 logos clubs adverses
│   └── gallery/
│       ├── match-26-04/        # 190 photos
│       └── u15/                # 99 photos
│
├── api/                        # Vercel serverless functions
│   └── agents/                 # 10 agents IA
│       ├── 01-fff-results-sync.ts
│       ├── ...
│       └── 10-chatbot-trainer.ts
│
├── lib/                        # Code partagé
│   ├── fff.ts                  # Scraper FFF.fr
│   ├── claude.ts               # Client Anthropic
│   └── db.ts                   # Client Supabase
│
├── package.json + tsconfig.json
├── vercel.json                 # Cron jobs config
├── .env.example                # Template env vars
├── docs-agents.md              # Doc détaillée des 10 agents
└── README.md                   # Ce fichier
```

## 💰 Coûts mensuels

| Service | Free tier | Estimé ESI |
|---|---|---|
| Vercel Hobby | Illimité (non-commercial) | **0 €** |
| Supabase Free | 500 MB DB / 1 GB storage | **0 €** |
| Anthropic API | — | **3 à 5 €** |
| Resend Free | 3 000 emails/mois | **0 €** |
| Meta Graph | Gratuit | **0 €** |
| Domaine `.fr` | — | **15 €/an** |

**Total : ~5 €/mois + 15 €/an pour le domaine.**

## 🆘 Aide

- Doc agents : [docs-agents.md](docs-agents.md)
- Issue avec un agent : `Vercel dashboard → Functions → Logs`
- Issue Supabase : `dashboard → Logs → Postgres logs`
- Contact mainteneur : Adrien Goubert · `adrien.goubert1@icloud.com`

---

**Allez ESI !** 🟦⚪
