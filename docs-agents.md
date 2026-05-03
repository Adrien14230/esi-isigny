# Agents IA · Étoile Sportive d'Isigny

Dix agents qui mettent le site à jour tout seuls. Tous tournent sur **Vercel Cron** (gratuit jusqu'à ~100 invocations/jour) et utilisent **Supabase** (gratuit) comme base de données + **Anthropic Claude API** pour la génération de texte.

## Vue d'ensemble

| # | Agent | Quand | Rôle |
|---|---|---|---|
| 01 | `fff-results-sync` | Lundi 02:00 | Scrape les résultats du week-end depuis FFF.fr |
| 02 | `fff-fixtures-sync` | Lundi 02:30 | Scrape le calendrier des 30 prochains jours |
| 03 | `classements-sync` | Lundi 03:00 | Scrape les classements des 7 poules ESI |
| 04 | `match-report-writer` | Lundi 04:00 | Rédige un compte-rendu pour chaque match joué (Claude) |
| 05 | `convoc-reminder` | Tous les jours 18:00 | Email aux joueurs convoqués pour le lendemain |
| 06 | `social-poster` | Lundi 09:00 | Poste les résultats sur Instagram + Facebook |
| 07 | `seo-optimizer` | Dimanche 23:00 | Refresh sitemap, meta description, Schema.org Events |
| 08 | `image-optimizer` | À l'upload | WebP + thumbnail des photos uploadées |
| 09 | `stats-aggregator` | Lundi 05:00 | Calcule les stats club (par équipe + global) |
| 10 | `chatbot-trainer` | Dimanche 22:00 | Met à jour la base de connaissances du chatbot |

## Déploiement

### 1. Comptes nécessaires (tous gratuits ≤ 500 utilisateurs)
- [Vercel](https://vercel.com) — hébergement + cron
- [Supabase](https://supabase.com) — base de données Postgres
- [Anthropic](https://console.anthropic.com) — clé API Claude (~3-5€/mois pour ce volume)
- [Resend](https://resend.com) — emails de convocation (3000/mois gratuits)
- [Meta for Developers](https://developers.facebook.com) — Page + Instagram Business
- [Cloudflare R2 ou Supabase Storage](https://supabase.com/storage) — stockage photos

### 2. Variables d'environnement Vercel
```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
RESEND_API_KEY=re_...
META_PAGE_ID=...
META_PAGE_ACCESS_TOKEN=EAAB...
IG_BUSINESS_ACCOUNT_ID=...
```

### 3. Schéma Supabase (à exécuter dans le SQL editor)
```sql
-- Matches joués
create table matches (
  id text primary key, date timestamptz, status text,
  competition text, category text, team_label text,
  recevant_nom text, recevant_buts int,
  visiteur_nom text, visiteur_buts int,
  esi_home boolean, has_report boolean default false,
  posted_to_social boolean default false,
  synced_at timestamptz
);

-- Calendrier à venir
create table fixtures (
  id text primary key, date timestamptz, competition text,
  category text, pool text, team_label text,
  opponent text, opponent_logo text,
  venue text check (venue in ('home','away')),
  synced_at timestamptz
);

-- Classements
create table classements (
  pool_key text, position int, team text,
  pts int, j int, g int, n int, p int,
  bp int, bc int, diff int,
  synced_at timestamptz,
  primary key (pool_key, position)
);

-- News & comptes rendus
create table news (
  id bigserial primary key, kind text, match_id text,
  body text, published_at timestamptz
);

-- Convocations
create table convocations (
  id bigserial primary key,
  team_label text, opponent text, match_date timestamptz,
  venue text, call_time text, kit_color text, cars_needed int,
  notes text, published_by text, published_at timestamptz
);

create table convocation_players (
  convocation_id bigint references convocations(id),
  user_id uuid references auth.users(id),
  primary key (convocation_id, user_id)
);

-- Photos galerie
create table gallery_photos (
  id bigserial primary key, album_key text,
  source_path text, thumb_path text, webp_path text,
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
  id bigserial primary key, agent_id text,
  status text, meta jsonb, ran_at timestamptz
);

-- RLS : seul le validator peut tout lire
alter table convocations enable row level security;
create policy "validator_full" on convocations
  for all using (auth.jwt() ->> 'email' = 'adrien.goubert1@icloud.com');
```

### 4. Déploiement Vercel
```bash
npm i -g vercel
cd "Site Web Esi"
vercel link
vercel env pull .env.local        # récupère les vars depuis le dashboard
vercel --prod                      # déploie
```

Vercel détecte `vercel.json` et configure automatiquement les 9 cron jobs.

### 5. Test manuel d'un agent
```bash
curl https://esi-isigny.fr/api/agents/01-fff-results-sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Coût estimé / mois

| Service | Free tier | Coût ESI prévu |
|---|---|---|
| Vercel Hobby | 100 GB bandwidth, cron illimité | **0 €** |
| Supabase Free | 500 MB DB, 1 GB storage | **0 €** |
| Anthropic API | — | **~3-5 €** (52 reports + ~50 social captions) |
| Resend Free | 3000 emails/mois | **0 €** |
| Meta Graph | gratuit | **0 €** |

**Total : ~5 €/mois.**

## Structure du dossier

```
agents/
├── README.md                       (ce fichier)
├── _shared/
│   ├── fff.ts                      (scraper FFF)
│   ├── claude.ts                   (client Anthropic)
│   └── db.ts                       (client Supabase)
├── 01-fff-results-sync.ts
├── 02-fff-fixtures-sync.ts
├── 03-classements-sync.ts
├── 04-match-report-writer.ts
├── 05-convoc-reminder.ts
├── 06-social-poster.ts
├── 07-seo-optimizer.ts
├── 08-image-optimizer.ts
├── 09-stats-aggregator.ts
└── 10-chatbot-trainer.ts
```

## Sécurité

- Toutes les clés API sont en variables d'environnement Vercel — jamais dans le code public
- Les agents Cron exigent un header `Authorization: Bearer $CRON_SECRET` (auto-injecté par Vercel)
- Row-Level Security Supabase : seules les convocations publiées sont publiques ; les emails licenciés sont protégés
- L'agent `convoc-reminder` n'envoie qu'aux licenciés validés (validés manuellement par adrien.goubert1@icloud.com)

## Status en direct

L'admin UI dans **Espace dirigeant** affiche le statut de chaque agent, le dernier run, les erreurs éventuelles. Données lues depuis la table `agent_runs`.
