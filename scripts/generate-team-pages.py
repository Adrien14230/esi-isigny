#!/usr/bin/env python3
"""
Génère une page HTML dédiée par équipe pour le SEO.
Chaque page est une URL crawlable indexée séparément par Google,
au lieu d'avoir une seule page avec des modales JS.
"""

import os
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUT = ROOT  # On écrit à la racine pour avoir /seniors-a.html

TEAMS = [
    {
        "slug": "seniors-a",
        "name": "Seniors A",
        "name_full": "Seniors A — Équipe première",
        "name_full_en": "Seniors A — First team",
        "category": "Seniors",
        "category_en": "Seniors",
        "subcategory": "Équipe première",
        "subcategory_en": "First team",
        "competition": "D4 · Poule C · JBS Prorété",
        "competition_short": "D4 Poule C",
        "rank": "2ᵉ", "rank_num": 2, "total": 12, "points": 31,
        "rank_color": "win",
        "stats": {"j": 14, "g": 10, "n": 1, "p": 3, "diff": "+32", "bp": 46, "bc": 14},
        "form": [("V", "Creances 0-0 (forfait)"), ("V", "Vesly 1-4"), ("V", "St Jores 7-0")],
        "coaches": "Thomas Pottier",
        "next_match": "Dim. 10 mai 15h00 vs AS Montmartin Graignes (Domicile)",
        "next_match_en": "Sun May 10 3:00 PM vs AS Montmartin Graignes (Home)",
        "description": "L'équipe première seniors de l'ESI évolue en D4 Poule C du District Manche. Actuellement 2ᵉ du classement avec 31 points sur 14 matchs, l'équipe enchaîne 3 victoires consécutives.",
        "description_en": "The ESI first team plays in D4 Group C of the Manche District. Currently 2nd in the standings with 31 points from 14 matches, with 3 consecutive wins.",
        "fff_url": "https://epreuves.fff.fr/competition/engagement/439819-championnat-seniors-d4-jbs-prorete/phase/1/3/accueil",
    },
    {
        "slug": "seniors-b",
        "name": "Seniors B",
        "name_full": "Seniors B — Équipe réserve",
        "name_full_en": "Seniors B — Reserve team",
        "category": "Seniors",
        "category_en": "Seniors",
        "subcategory": "Réserve",
        "subcategory_en": "Reserve",
        "competition": "D4 · Poule D · JBS Prorété",
        "competition_short": "D4 Poule D",
        "rank": "10ᵉ", "rank_num": 10, "total": 12, "points": 2,
        "rank_color": "loss",
        "stats": {"j": 16, "g": 1, "n": 1, "p": 13, "diff": "-37", "bp": 22, "bc": 59},
        "form": [("D", "Marigny 3-1"), ("D", "Aireloise 2-1"), ("V", "Théreval 1-2 (1ʳᵉ victoire !)")],
        "coaches": "Adrien Goubert · Alain Piazza · Jessy Thomine",
        "next_match": "Dim. 17 mai 15h00 vs Théreval (Domicile, revanche)",
        "next_match_en": "Sun May 17 3:00 PM vs Théreval (Home, rematch)",
        "description": "L'équipe réserve seniors de l'ESI évolue en D4 Poule D du District Manche. Saison difficile mais l'équipe a décroché sa première victoire le 2 mai contre Théreval (1-2 à l'extérieur).",
        "description_en": "The ESI reserve team plays in D4 Group D of the Manche District. Tough season but secured their first win on May 2nd against Théreval (1-2 away).",
        "fff_url": "https://epreuves.fff.fr/competition/engagement/439819-championnat-seniors-d4-jbs-prorete/phase/1/4/accueil",
    },
    {
        "slug": "seniors-f",
        "name": "Seniors F",
        "name_full": "Seniors Féminines — Football à 8",
        "name_full_en": "Senior Women — 8-a-side football",
        "category": "Féminines",
        "category_en": "Women",
        "subcategory": "Football à 8",
        "subcategory_en": "8-a-side",
        "competition": "A8 · D2 Nord",
        "competition_short": "A8 D2 Nord",
        "rank": "4ᵉ", "rank_num": 4, "total": 12, "points": 24,
        "rank_color": None,
        "stats": {"j": 14, "g": 8, "n": 0, "p": 6, "diff": "+1", "bp": 35, "bc": 34},
        "form": [("V", "Rauville 0-3"), ("V", "Plain Haytillon 3-1"), ("V", "Pointe Cotentin (3 mai)")],
        "coaches": "Staff féminines ESI",
        "next_match": "Ven. 8 mai 20h30 vs AS Pointe Cotentin (Extérieur)",
        "next_match_en": "Fri May 8 8:30 PM vs AS Pointe Cotentin (Away)",
        "description": "L'équipe féminine seniors de l'ESI joue en championnat A8 D2 Nord (football à 8). Actuellement 4ᵉ avec 24 points et 8 victoires sur 14 matchs. Une équipe en pleine progression.",
        "description_en": "The ESI senior women's team plays in the 8-a-side D2 North championship. Currently 4th with 24 points and 8 wins from 14 matches.",
        "fff_url": "https://epreuves.fff.fr/competition/club/501416-e-s-isigny-s-mer/club",
    },
    {
        "slug": "veterans",
        "name": "Vétérans",
        "name_full": "Vétérans",
        "name_full_en": "Veterans",
        "category": "Seniors",
        "category_en": "Seniors",
        "subcategory": "Vétérans",
        "subcategory_en": "Veterans",
        "competition": "Championnat Vétérans · Poule B",
        "competition_short": "Vétérans Poule B",
        "rank": "6ᵉ", "rank_num": 6, "total": 9, "points": 5,
        "rank_color": None,
        "stats": {"j": 8, "g": 1, "n": 3, "p": 3, "diff": "-5", "bp": 12, "bc": 17},
        "form": [("N", "Auversoise 0-0")],
        "coaches": "Staff Vétérans ESI",
        "next_match": "Ven. 15 mai 21h00 vs FC St-Lô Manche (Domicile)",
        "next_match_en": "Fri May 15 9:00 PM vs FC St-Lô Manche (Home)",
        "description": "L'équipe vétérans de l'ESI dispute le championnat Poule B du District Manche. Une équipe d'anciens passionnés qui continuent à porter les couleurs bleu et blanc.",
        "description_en": "The ESI veterans team competes in the Manche District Group B veterans championship. A passionate group of former players still wearing the blue and white.",
        "fff_url": "https://epreuves.fff.fr/competition/club/501416-e-s-isigny-s-mer/club",
    },
    {
        "slug": "u15-1",
        "name": "U15 (1)",
        "name_full": "U15 (1) — 1ᵉʳ du classement",
        "name_full_en": "U15 (1) — League leaders",
        "category": "Jeunes",
        "category_en": "Youth",
        "subcategory": "U14/U15 · Tête de poule",
        "subcategory_en": "U14/U15 · Top of group",
        "competition": "U15 D3 · Poule B Printemps",
        "competition_short": "U15 D3 Poule B",
        "rank": "1ᵉʳ", "rank_num": 1, "total": 9, "points": 12,
        "rank_color": "leader",
        "stats": {"j": 5, "g": 4, "n": 0, "p": 1, "diff": "+25", "bp": 39, "bc": 14},
        "form": [("V", "Montebourg 4-1"), ("V", "Valognes 3-4")],
        "coaches": "Théo Castel · Adrien Goubert",
        "next_match": "Sam. 9 mai 15h00 vs SM Haytillon (Domicile)",
        "next_match_en": "Sat May 9 3:00 PM vs SM Haytillon (Home)",
        "description": "Les U15 (1) de l'ESI sont 1ᵉʳˢ de leur poule en D3 Printemps avec 12 points sur 5 matchs et un différentiel de +25 buts. La fierté de la formation du club.",
        "description_en": "The ESI U15 (1) team leads D3 Spring Group B with 12 points from 5 matches and a +25 goal difference. The pride of the club's youth academy.",
        "fff_url": "https://epreuves.fff.fr/competition/engagement/445255-championnat-u15-d3/phase/2/2/accueil",
    },
    {
        "slug": "u15-2",
        "name": "U15 (2)",
        "name_full": "U15 (2) — Entente Isigny–Carentan",
        "name_full_en": "U15 (2) — Isigny–Carentan partnership",
        "category": "Jeunes",
        "category_en": "Youth",
        "subcategory": "Entente",
        "subcategory_en": "Partnership",
        "competition": "U15 D3 · Poule C Printemps",
        "competition_short": "U15 D3 Poule C",
        "rank": "9ᵉ", "rank_num": 9, "total": 9, "points": -1,
        "rank_color": "loss",
        "stats": {"j": 5, "g": 0, "n": 0, "p": 4, "diff": "-67", "bp": 14, "bc": 81},
        "form": [("D", "Agneaux 0-3 (forfait)"), ("V", "ES de l'Ay 10-1 !")],
        "coaches": "Staff Entente ESI/Carentan",
        "next_match": "Sam. 9 mai 15h00 vs Ent. FC3R/Condé (Extérieur)",
        "next_match_en": "Sat May 9 3:00 PM vs FC3R/Condé partnership (Away)",
        "description": "Les U15 (2) jouent en entente Isigny–Carentan en D3 Poule C. Saison compliquée mais grosse victoire 10-1 contre ES de l'Ay le 2 mai.",
        "description_en": "The U15 (2) play in the Isigny–Carentan partnership in D3 Group C. Tough season but a 10-1 win against ES de l'Ay on May 2nd.",
        "fff_url": "https://epreuves.fff.fr/competition/club/501416-e-s-isigny-s-mer/club",
    },
    {
        "slug": "u13",
        "name": "U13",
        "name_full": "U13 — Foot à 8",
        "name_full_en": "U13",
        "category": "Jeunes",
        "category_en": "Youth",
        "subcategory": "U12/U13",
        "subcategory_en": "U12/U13",
        "competition": "U13 Niveau 4 · Poule B Printemps",
        "competition_short": "U13 N4 Poule B",
        "rank": "6ᵉ", "rank_num": 6, "total": 6, "points": 3,
        "rank_color": "loss",
        "stats": {"j": 4, "g": 1, "n": 0, "p": 3, "diff": "-20", "bp": 8, "bc": 28},
        "form": [("D", "Coutancaise 2-12"), ("D", "Bérigny Cerisy 0-6")],
        "coaches": "Evann Lecourt",
        "next_match": "Sam. 9 mai 13h15 vs US Roncey Cerisy 2 (Domicile)",
        "next_match_en": "Sat May 9 1:15 PM vs US Roncey Cerisy 2 (Home)",
        "description": "Les U13 de l'ESI jouent en Niveau 4 Poule B. Saison de construction pour cette jeune équipe en plein apprentissage.",
        "description_en": "The ESI U13 play in Level 4 Group B. A development season for this young team.",
        "fff_url": "https://epreuves.fff.fr/competition/club/501416-e-s-isigny-s-mer/club",
    },
    {
        "slug": "u11",
        "name": "U11",
        "name_full": "U11 — Foot animation",
        "name_full_en": "U11 — Animation",
        "category": "Animation",
        "category_en": "Animation",
        "subcategory": "U10/U11",
        "subcategory_en": "U10/U11",
        "competition": "Plateaux de printemps · Football à 8",
        "competition_short": "Plateaux U11",
        "rank": None, "rank_num": None, "total": None, "points": None,
        "rank_color": None,
        "stats": None,
        "form": [],
        "coaches": "Pierre Goubert",
        "next_match": "Plateaux du samedi · voir calendrier",
        "next_match_en": "Saturday tournaments · see calendar",
        "description": "Le foot animation U11 de l'ESI accueille les enfants de 10-11 ans en football à 8. Découverte, plaisir, apprentissage : pas de classement, juste du jeu.",
        "description_en": "The ESI U11 program welcomes 10-11 year olds in 8-a-side football. Fun, learning, no rankings.",
        "fff_url": "https://epreuves.fff.fr/competition/club/501416-e-s-isigny-s-mer/club",
    },
    {
        "slug": "u9",
        "name": "U9",
        "name_full": "U9 — Foot animation",
        "name_full_en": "U9 — Animation",
        "category": "Animation",
        "category_en": "Animation",
        "subcategory": "U8/U9",
        "subcategory_en": "U8/U9",
        "competition": "Plateaux de printemps · Football à 5",
        "competition_short": "Plateaux U9",
        "rank": None, "rank_num": None, "total": None, "points": None,
        "rank_color": None,
        "stats": None,
        "form": [],
        "coaches": "Jessy Thomine · Lionnel Lepainteur",
        "next_match": "Plateaux du samedi · voir calendrier",
        "next_match_en": "Saturday tournaments · see calendar",
        "description": "Le foot animation U9 de l'ESI accueille les enfants de 8-9 ans en football à 5. Première vraie expérience compétitive en plateaux.",
        "description_en": "The ESI U9 program welcomes 8-9 year olds in 5-a-side football. First real competitive experience.",
        "fff_url": "https://epreuves.fff.fr/competition/club/501416-e-s-isigny-s-mer/club",
    },
]

DOT_COLORS = {
    "V": ("#22C55E", "#fff"),  # win
    "D": ("#EF4444", "#fff"),  # loss
    "N": ("#94A3B8", "#fff"),  # draw
}


def render_form_dots(form):
    if not form:
        return '<span style="color:var(--draw);font-size:13px;">Pas de matchs cette saison.</span>'
    out = []
    for letter, title in form:
        bg, fg = DOT_COLORS.get(letter, ("#94A3B8", "#fff"))
        out.append(
            f'<span class="dot-mini" style="background:{bg};color:{fg};" title="{title}">{letter}</span>'
        )
    return "".join(out)


def render_stats_table(stats):
    if not stats:
        return ""
    return f"""
        <div class="team-page-stats">
          <div class="stat-cell"><strong>{stats['j']}</strong><span>J</span></div>
          <div class="stat-cell"><strong>{stats['g']}</strong><span>G</span></div>
          <div class="stat-cell"><strong>{stats['n']}</strong><span>N</span></div>
          <div class="stat-cell"><strong>{stats['p']}</strong><span>P</span></div>
          <div class="stat-cell"><strong>{stats['bp']}</strong><span>BP</span></div>
          <div class="stat-cell"><strong>{stats['bc']}</strong><span>BC</span></div>
          <div class="stat-cell"><strong>{stats['diff']}</strong><span>Diff.</span></div>
        </div>
"""


def render_rank_block(team):
    if team["rank"] is None:
        return f"""
        <div class="team-page-rank empty">
          <span class="team-page-rank-label">Pas de classement</span>
          <span class="team-page-rank-meta">Foot animation · plateaux du samedi</span>
        </div>
"""
    color_map = {
        "win": "var(--win)",
        "loss": "var(--loss)",
        "leader": "#d4a017",
        None: "var(--navy)",
    }
    bg_map = {
        "win": "rgba(34,197,94,0.10)",
        "loss": "rgba(239,68,68,0.08)",
        "leader": "rgba(212,160,23,0.15)",
        None: "var(--offwhite)",
    }
    color = color_map[team["rank_color"]]
    bg = bg_map[team["rank_color"]]
    return f"""
        <div class="team-page-rank" style="background:{bg};">
          <span class="team-page-rank-pos" style="color:{color};">{team['rank']}</span>
          <span class="team-page-rank-meta">/ {team['total']} · {team['points']} pts</span>
        </div>
"""


def render_schema(team, base_url="https://esi-isigny.fr"):
    schema = {
        "@context": "https://schema.org",
        "@type": "SportsTeam",
        "name": f"ESI {team['name']}",
        "description": team["description"],
        "url": f"{base_url}/{team['slug']}.html",
        "image": f"{base_url}/assets/team-bg.jpg",
        "logo": f"{base_url}/assets/logo-esi.png",
        "sport": "Football",
        "memberOf": {
            "@type": "SportsClub",
            "name": "Étoile Sportive d'Isigny",
            "url": f"{base_url}/",
        },
    }
    if team.get("coaches"):
        schema["coach"] = {"@type": "Person", "name": team["coaches"]}
    return json.dumps(schema, ensure_ascii=False, indent=2)


PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#1A3A6B">

<title>{title} · ESI Isigny — {competition_short}</title>
<meta name="description" content="{description_short}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://esi-isigny.fr/{slug}.html">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="https://esi-isigny.fr/{slug}.html">
<meta property="og:site_name" content="Étoile Sportive d'Isigny">
<meta property="og:title" content="{title} · ESI Isigny">
<meta property="og:description" content="{description_short}">
<meta property="og:image" content="https://esi-isigny.fr/assets/team-bg.jpg">
<meta property="og:image:width" content="1920">
<meta property="og:image:height" content="1280">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title} · ESI Isigny">
<meta name="twitter:description" content="{description_short}">
<meta name="twitter:image" content="https://esi-isigny.fr/assets/team-bg.jpg">

<link rel="icon" type="image/png" href="/assets/logo-esi.png">
<link rel="apple-touch-icon" href="/assets/logo-esi.png">

<script type="application/ld+json">
{schema_json}
</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@300;400;500;600&display=swap" rel="stylesheet">

<style>
:root {{
  --navy: #1A3A6B;
  --electric: #1E5FBE;
  --bright: #3A7FE8;
  --white: #FFFFFF;
  --offwhite: #F4F6FA;
  --lightgrey: #E8ECF2;
  --dark: #0D1F3C;
  --win: #22C55E;
  --draw: #94A3B8;
  --loss: #EF4444;
  --font-display: 'Barlow Condensed', sans-serif;
  --font-body: 'Barlow', sans-serif;
}}
*, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
html {{ scroll-behavior: smooth; font-size: 16px; }}
body {{ font-family: var(--font-body); background: var(--offwhite); color: var(--dark); line-height: 1.5; }}
a {{ color: inherit; text-decoration: none; }}
img {{ display: block; max-width: 100%; }}

.skip-link {{
  position: absolute; top: -100px; left: 0;
  background: var(--navy); color: var(--white);
  padding: 12px 24px; z-index: 99999;
  font-family: var(--font-display); font-weight: 700;
  font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase;
  transition: top 0.2s ease;
}}
.skip-link:focus {{ top: 0; }}

/* Mini nav */
.team-nav {{
  position: sticky; top: 0; z-index: 100;
  background: var(--white);
  border-bottom: 1px solid var(--lightgrey);
  padding: 14px 32px;
  display: flex; align-items: center; justify-content: space-between;
}}
.team-nav-logo {{ display: flex; align-items: center; gap: 12px; }}
.team-nav-logo img {{
  width: 36px; height: 36px; object-fit: contain;
  background: var(--white); border-radius: 50%;
  padding: 5px; border: 1px solid var(--lightgrey);
  box-shadow: 0 2px 8px rgba(13,31,60,0.08);
}}
.team-nav-logo-name {{
  font-family: var(--font-display); font-weight: 800;
  font-size: 14px; text-transform: uppercase;
  color: var(--navy); letter-spacing: 0.04em; line-height: 1.1;
}}
.team-nav-logo-name span {{
  display: block; font-size: 9px; letter-spacing: 0.16em;
  font-weight: 400; opacity: 0.55;
}}
.team-nav-back {{
  font-family: var(--font-display); font-weight: 600;
  font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--navy); padding: 10px 20px;
  border: 1px solid var(--lightgrey); border-radius: 2px;
  transition: all 0.25s;
  display: inline-flex; align-items: center; gap: 10px;
}}
.team-nav-back:hover {{ background: var(--navy); color: var(--white); border-color: var(--navy); }}
.team-nav-back-arrow {{
  width: 18px; height: 1px; background: currentColor;
  position: relative;
}}
.team-nav-back-arrow::before {{
  content: ''; position: absolute;
  left: 0; top: 50%;
  width: 6px; height: 6px;
  border-bottom: 1px solid currentColor;
  border-left: 1px solid currentColor;
  transform: translateY(-50%) rotate(45deg);
}}

/* Hero équipe */
.team-hero {{
  background: linear-gradient(135deg, var(--dark) 0%, var(--navy) 100%);
  color: var(--white);
  padding: 80px 32px 64px;
  position: relative; overflow: hidden;
}}
.team-hero::before {{
  content: '';
  position: absolute; inset: 0;
  background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0);
  background-size: 32px 32px;
  pointer-events: none;
}}
.team-hero-inner {{
  max-width: 1200px; margin: 0 auto;
  position: relative; z-index: 1;
}}
.team-hero-eyebrow {{
  font-family: var(--font-display); font-weight: 600;
  font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase;
  color: var(--bright);
  display: inline-flex; align-items: center; gap: 12px;
  margin-bottom: 18px;
}}
.team-hero-eyebrow::before {{
  content: ''; width: 24px; height: 1px; background: currentColor;
}}
.team-hero-title {{
  font-family: var(--font-display); font-weight: 800;
  font-size: clamp(48px, 7vw, 96px); line-height: 0.92;
  letter-spacing: -0.022em; text-transform: uppercase;
  color: var(--white); margin-bottom: 14px;
}}
.team-hero-subtitle {{
  font-family: var(--font-display); font-weight: 600;
  font-size: clamp(16px, 1.6vw, 22px); letter-spacing: 0.04em;
  color: rgba(255,255,255,0.7); text-transform: uppercase;
  margin-bottom: 24px;
}}
.team-hero-desc {{
  font-family: var(--font-body); font-size: 16px;
  line-height: 1.65; color: rgba(255,255,255,0.78);
  max-width: 680px;
}}

/* Sections */
section.team-section {{
  max-width: 1200px;
  margin: 64px auto;
  padding: 0 32px;
}}
.team-section-title {{
  font-family: var(--font-display); font-weight: 700;
  font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase;
  color: var(--electric); margin-bottom: 22px;
  display: inline-flex; align-items: center; gap: 12px;
}}
.team-section-title::before {{
  content: ''; width: 24px; height: 1px; background: currentColor;
}}
.team-section-h2 {{
  font-family: var(--font-display); font-weight: 800;
  font-size: clamp(28px, 3.5vw, 42px); line-height: 1;
  letter-spacing: -0.018em; text-transform: uppercase;
  color: var(--navy); margin-bottom: 28px;
}}

/* Rank block */
.team-page-rank {{
  display: inline-flex; align-items: baseline; gap: 12px;
  padding: 14px 24px; border-radius: 8px;
  font-family: var(--font-display);
}}
.team-page-rank-pos {{ font-weight: 800; font-size: 36px; line-height: 1; }}
.team-page-rank-meta {{ font-size: 14px; color: var(--dark); opacity: 0.7; letter-spacing: 0.04em; }}
.team-page-rank.empty {{ background: var(--offwhite); padding: 20px 24px; }}
.team-page-rank.empty .team-page-rank-label {{ font-weight: 700; font-size: 14px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--navy); margin-right: 12px; }}
.team-page-rank.empty .team-page-rank-meta {{ font-size: 13px; }}

/* Stats grid */
.team-page-stats {{
  display: grid; grid-template-columns: repeat(7, 1fr);
  gap: 0;
  background: var(--white); border: 1px solid var(--lightgrey);
  border-radius: 8px; overflow: hidden;
  margin-top: 18px;
}}
.stat-cell {{
  display: flex; flex-direction: column; align-items: center;
  padding: 18px 8px; border-right: 1px solid var(--lightgrey);
}}
.stat-cell:last-child {{ border-right: none; }}
.stat-cell strong {{
  font-family: var(--font-display); font-weight: 800;
  font-size: 28px; color: var(--navy); line-height: 1;
}}
.stat-cell span {{
  font-family: var(--font-display); font-size: 10px;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--draw); margin-top: 6px;
}}
@media (max-width: 768px) {{
  .team-page-stats {{ grid-template-columns: repeat(4, 1fr); }}
  .stat-cell {{ border-bottom: 1px solid var(--lightgrey); }}
  .stat-cell:nth-last-child(-n+3) {{ border-bottom: none; }}
  .stat-cell:nth-child(4n) {{ border-right: none; }}
}}

/* Form dots */
.dot-mini {{
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%;
  font-family: var(--font-display); font-weight: 800;
  font-size: 13px; margin-right: 6px;
}}

/* Info cards */
.team-info-grid {{
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 24px; margin-top: 24px;
}}
@media (max-width: 720px) {{
  .team-info-grid {{ grid-template-columns: 1fr; }}
}}
.team-info-card {{
  background: var(--white); border: 1px solid var(--lightgrey);
  border-radius: 12px; padding: 24px;
}}
.team-info-card h3 {{
  font-family: var(--font-display); font-weight: 600;
  font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--draw); margin-bottom: 12px;
}}
.team-info-card p {{
  font-family: var(--font-body); font-size: 16px;
  line-height: 1.55; color: var(--dark);
}}

/* CTA */
.team-cta {{
  background: var(--navy); color: var(--white);
  padding: 56px 32px; text-align: center;
}}
.team-cta-inner {{ max-width: 720px; margin: 0 auto; }}
.team-cta h2 {{
  font-family: var(--font-display); font-weight: 800;
  font-size: clamp(28px, 3.6vw, 42px); line-height: 1;
  letter-spacing: -0.02em; text-transform: uppercase;
  margin-bottom: 14px;
}}
.team-cta p {{
  font-family: var(--font-body); font-size: 15px;
  line-height: 1.6; color: rgba(255,255,255,0.75);
  max-width: 520px; margin: 0 auto 28px;
}}
.team-cta-btn {{
  display: inline-flex; align-items: center; gap: 12px;
  font-family: var(--font-display); font-weight: 600;
  font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase;
  background: var(--white); color: var(--navy);
  padding: 16px 30px; border-radius: 2px;
  transition: background 0.25s, color 0.25s;
}}
.team-cta-btn:hover {{ background: var(--bright); color: var(--white); }}

/* Footer */
.team-footer {{
  background: var(--dark); color: var(--white);
  padding: 40px 32px;
  text-align: center;
}}
.team-footer p {{
  font-family: var(--font-body); font-size: 13px;
  color: rgba(255,255,255,0.55); line-height: 1.5;
}}
.team-footer a {{ color: var(--bright); }}
.team-footer-links {{
  display: flex; gap: 24px; justify-content: center;
  margin-top: 16px; flex-wrap: wrap;
}}
.team-footer-links a {{
  font-family: var(--font-display); font-weight: 600;
  font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
  color: rgba(255,255,255,0.7);
  transition: color 0.2s;
}}
.team-footer-links a:hover {{ color: var(--bright); }}

@media (max-width: 600px) {{
  .team-nav {{ padding: 12px 18px; }}
  .team-nav-back {{ font-size: 10px; padding: 8px 14px; }}
  .team-hero {{ padding: 56px 20px 48px; }}
  section.team-section {{ margin: 48px auto; padding: 0 20px; }}
  .team-cta {{ padding: 40px 20px; }}
}}
</style>
</head>

<body>

<a class="skip-link" href="#main">Aller au contenu principal</a>

<nav class="team-nav" aria-label="Navigation principale">
  <a href="/" class="team-nav-logo" aria-label="Retour à l'accueil ESI">
    <img src="/assets/logo-esi.png" alt="Logo Étoile Sportive d'Isigny">
    <div class="team-nav-logo-name">ÉTOILE SPORTIVE<span>D'ISIGNY · 1925</span></div>
  </a>
  <a href="/" class="team-nav-back">
    <span class="team-nav-back-arrow"></span>
    Retour au site
  </a>
</nav>

<main id="main">

  <header class="team-hero">
    <div class="team-hero-inner">
      <div class="team-hero-eyebrow">ESI · {category} · {subcategory}</div>
      <h1 class="team-hero-title">{name}</h1>
      <div class="team-hero-subtitle">{competition}</div>
      <p class="team-hero-desc">{description}</p>
    </div>
  </header>

  <section class="team-section" aria-labelledby="rank-title">
    <div class="team-section-title">Saison 2025-26</div>
    <h2 class="team-section-h2" id="rank-title">Classement & statistiques</h2>
    {rank_block}
    {stats_table}
  </section>

  {form_section}

  <section class="team-section" aria-labelledby="match-title">
    <div class="team-section-title">À venir</div>
    <h2 class="team-section-h2" id="match-title">Prochain match</h2>
    <div class="team-info-card">
      <h3>Match prévu</h3>
      <p><strong>{next_match}</strong></p>
    </div>
  </section>

  <section class="team-section" aria-labelledby="staff-title">
    <div class="team-section-title">Encadrement</div>
    <h2 class="team-section-h2" id="staff-title">Staff</h2>
    <div class="team-info-grid">
      <div class="team-info-card">
        <h3>Dirigeants &amp; coachs</h3>
        <p><strong>{coaches}</strong></p>
      </div>
      <div class="team-info-card">
        <h3>Compétition officielle</h3>
        <p><a href="{fff_url}" target="_blank" rel="noopener" style="color:var(--electric);">Voir sur FFF.fr →</a></p>
      </div>
    </div>
  </section>

  <section class="team-cta" aria-label="Rejoindre l'ESI">
    <div class="team-cta-inner">
      <h2>Envie de rejoindre {name} ?</h2>
      <p>Inscriptions ouvertes pour la saison 2025-26. Hommes, femmes, enfants : toutes les catégories sont accueillies à l'Étoile Sportive d'Isigny.</p>
      <a href="mailto:etoilesportiveisigny@gmail.com?subject=Inscription%20{name_url}%20-%20Saison%202025-26" class="team-cta-btn">
        Nous contacter →
      </a>
    </div>
  </section>

</main>

<footer class="team-footer">
  <p>© 2025 Étoile Sportive d'Isigny · Club fondé en 1925 · Affiliation FFF 501416</p>
  <div class="team-footer-links">
    <a href="/">Accueil</a>
    <a href="/#calendrier">Calendrier</a>
    <a href="/#resultats">Résultats</a>
    <a href="/#staff">Tous les dirigeants</a>
    <a href="/#partenaires">Partenaires</a>
    <a href="/#contact">Contact</a>
  </div>
</footer>

</body>
</html>
"""


def generate_page(team):
    rank_block = render_rank_block(team)
    stats_table = render_stats_table(team["stats"])

    if team["form"]:
        form_dots = render_form_dots(team["form"])
        form_section = f"""
  <section class="team-section" aria-labelledby="form-title">
    <div class="team-section-title">Forme récente</div>
    <h2 class="team-section-h2" id="form-title">Derniers matchs</h2>
    <div class="team-info-card" style="display:inline-flex;align-items:center;gap:12px;flex-wrap:wrap;">
      {form_dots}
      <span style="color:var(--draw);font-size:13px;margin-left:12px;">Du plus ancien au plus récent</span>
    </div>
  </section>
"""
    else:
        form_section = ""

    description_short = team["description"][:155] + "..." if len(team["description"]) > 158 else team["description"]

    html = PAGE_TEMPLATE.format(
        slug=team["slug"],
        title=team["name_full"],
        name=team["name"],
        name_url=team["name"].replace(" ", "%20"),
        category=team["category"],
        subcategory=team["subcategory"],
        competition=team["competition"],
        competition_short=team["competition_short"],
        description=team["description"],
        description_short=description_short,
        rank_block=rank_block,
        stats_table=stats_table,
        form_section=form_section,
        next_match=team["next_match"],
        coaches=team["coaches"],
        fff_url=team["fff_url"],
        schema_json=render_schema(team),
    )

    out_path = OUT / f"{team['slug']}.html"
    out_path.write_text(html, encoding="utf-8")
    print(f"  ✓ {out_path.name} ({len(html)} bytes)")


def main():
    print(f"Génération de {len(TEAMS)} pages d'équipes...")
    for team in TEAMS:
        generate_page(team)
    print("OK.")


if __name__ == "__main__":
    main()
