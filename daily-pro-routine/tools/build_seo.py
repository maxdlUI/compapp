"""Builds the public pages search engines can read: one page per routine, a routine hub, a map code list,
robots.txt and sitemap.xml. The app itself lives behind #hash routes, which Google treats as one page,
so these real URLs are what gets found in search.

Data: the live routine catalog (table routine_catalog, newest row), read with the public key.
If that fails, the last saved copy in tools/seo_catalog.json is used.

Usage:  python3 tools/build_seo.py      (build_app.py calls it; writes into app/)
"""
import datetime, html, json, os, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "app")
SNAP = os.path.join(ROOT, "tools", "seo_catalog.json")
SITE = "https://repline.pages.dev"
SB_URL = "https://wjwjvwjwlipjxsgufffj.supabase.co"
SB_KEY = "sb_publishable_xA1CO4em6oz2mocDqBC5jg_4WhlX13q"  # public key, also in index.html
YEAR = datetime.date.today().year
TODAY = datetime.date.today().isoformat()


def load_catalog():
    try:
        req = urllib.request.Request(SB_URL + "/rest/v1/routine_catalog?select=data&order=id.desc&limit=1",
                                     headers={"apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY})
        data = json.load(urllib.request.urlopen(req, timeout=20))[0]["data"]
        json.dump(data, open(SNAP, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        return data
    except Exception as e:  # offline build: use the saved copy
        print("seo: catalog fetch failed (%s), using saved copy" % e)
        return json.load(open(SNAP, encoding="utf-8"))


# Hand-written page copy for the known routines. Routines added later in the studio get a generic page.
COPY = {
    "better": {
        "slug": "fortnite-daily-pro-routine",
        "title": "Fortnite Daily Pro Routine with Map Codes",
        "h1": "The Fortnite daily pro routine",
        "lead": "A full daily practice routine the way competitive players train: aim first, then edits and freebuild, then piece control, real fights, ranked with one focus and a short VOD review. Every set has a timer and the map code to paste.",
        "why": "Order matters. Aim and mechanics warm your hands up, fights use what you just trained, and the review at the end tells you what to drill tomorrow.",
    },
    "cup": {
        "slug": "fortnite-cup-warm-up-routine",
        "title": "Fortnite Cup Warm-Up Routine (Before Cash Cups and FNCS)",
        "h1": "Fortnite cup warm-up routine",
        "lead": "Warm hands, calm head, nothing new. A short warm-up for cash cups, FNCS and scrims: aim, edits, freebuild, piece control, a few fights and a final cup check, so you load into the first game ready.",
        "why": "Before a cup you don't train, you wake up. Keep it short, keep settings unchanged and stop before you get tired.",
    },
    "aim": {
        "slug": "fortnite-aim-training-routine",
        "title": "Fortnite Aim Training Routine (KovaaK's Playlists + Map Codes)",
        "h1": "Fortnite aim training routine",
        "lead": "Tjino's KovaaK's playlists for tracking and clicking, V5 aim scenarios for reaction flicks and bounce tracking, then real box fights so the aim carries over into Fortnite.",
        "why": "Aim trainers build the motion, real fights make it stick. That's why every length ends with fights, not with another scenario.",
    },
    "mechanics": {
        "slug": "fortnite-mechanics-training-routine",
        "title": "Fortnite Mechanics Routine: Edits, Freebuild, Piece Control",
        "h1": "Fortnite mechanics training routine",
        "lead": "Edit wall first, then freebuild at 90% speed for clean edits and at 110–120% to push your mechanics, then piece control and realistics. All on free creative maps with the codes below.",
        "why": "Slow first, then fast. Clean edits at 90% become fast edits at 120%, and piece control turns mechanics into fights you win.",
    },
}
# Maps used by many drills get one name instead of the list of drills.
MAP_NAMES = {"2424-4344-7824": ("Raider464's Mechanics V5", "One map for everything: aim scenarios, edit wall, freebuild at any speed and piece control.")}
TYPE = {"aim": "Aim", "mech": "Mechanics", "fight": "Fights", "live": "Live games", "review": "Review", "rest": "Break", "prep": "Prep"}

CSS = """
:root{color-scheme:dark;--bg:#000;--card:#111113;--line:#28282b;--text:#f5f5f7;--dim:#a1a1a6;--blue:#a0a0a0;--link:#c0c0c0}
*{box-sizing:border-box}html{background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--text);font:17px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Inter,Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:880px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-left))}
header{border-bottom:1px solid var(--line)}header .wrap{display:flex;align-items:center;justify-content:space-between;height:56px;gap:12px}
.brand{display:flex;align-items:center;gap:8px;color:var(--text);font-weight:600}.brand img{width:26px;height:26px;border-radius:7px}
nav{white-space:nowrap}nav a{color:var(--dim);margin-left:18px;font-size:15px}
@media(max-width:520px){nav a{margin-left:14px;font-size:14px}nav a:last-child{display:none}}
h1{font-size:clamp(32px,6vw,52px);line-height:1.08;letter-spacing:-.02em;margin:48px 0 14px}
h2{font-size:clamp(24px,4vw,32px);letter-spacing:-.01em;margin:44px 0 12px}
h3{font-size:19px;margin:0}
.lead{font-size:clamp(18px,2.4vw,21px);color:var(--dim);max-width:720px}
.cta{display:inline-block;background:var(--blue);color:#fff;border-radius:980px;padding:12px 22px;font-weight:600;margin:18px 0 6px}
.cta:hover{text-decoration:none;background:#a7a7a7}
.muted{color:var(--dim);font-size:15px}
.len{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px;margin:16px 0}
.len-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:8px}
ol{margin:0;padding:0;list-style:none;counter-reset:s}
ol li{counter-increment:s;display:grid;grid-template-columns:28px 1fr auto;gap:4px 10px;padding:12px 0;border-top:1px solid var(--line)}
ol li:before{content:counter(s);color:var(--dim);font-variant-numeric:tabular-nums}
.set-name{font-weight:600}.set-min{color:var(--dim);font-variant-numeric:tabular-nums;white-space:nowrap}
.set-hint{grid-column:2/4;color:var(--dim);font-size:15px}
.code{grid-column:2/4;display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:15px}
code{font:15px ui-monospace,"SF Mono",Menlo,Consolas,monospace;background:#1d1d1f;border:1px solid var(--line);border-radius:8px;padding:3px 8px;user-select:all}
button.copy{background:none;border:1px solid var(--line);color:var(--link);border-radius:8px;padding:3px 10px;font:inherit;font-size:14px;cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin:16px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden;display:flex;flex-direction:column}
.card img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#1d1d1f}
.card .in{padding:14px 16px 16px;display:flex;flex-direction:column;gap:6px}
.card a.stretch{color:inherit}.card a.stretch:hover{text-decoration:none}
.faq dt{font-weight:600;margin-top:18px}.faq dd{margin:6px 0 0;color:var(--dim)}
footer{border-top:1px solid var(--line);margin-top:64px;padding:24px 0 40px;color:var(--dim);font-size:14px}
footer .wrap{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
"""

COPY_JS = """<script>document.addEventListener("click",function(e){var b=e.target.closest("button.copy");if(!b)return;var t=b.getAttribute("data-code");(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){b.textContent="Copied";setTimeout(function(){b.textContent="Copy"},1500)}).catch(function(){})});</script>"""

e = lambda s: html.escape(str(s or ""), quote=True)


def page(path, title, desc, body, ld=None, img="/icons/icon-1024.png"):
    url = SITE + path
    lds = "".join('<script type="application/ld+json">%s</script>' % json.dumps(x, ensure_ascii=False) for x in (ld or []))
    return """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>%(t)s</title>
<meta name="description" content="%(d)s">
<link rel="canonical" href="%(u)s">
<meta name="theme-color" content="#000000"><meta name="color-scheme" content="dark">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta property="og:type" content="website"><meta property="og:site_name" content="Repline">
<meta property="og:title" content="%(t)s"><meta property="og:description" content="%(d)s">
<meta property="og:url" content="%(u)s"><meta property="og:image" content="%(i)s">
<meta name="twitter:card" content="summary_large_image">
<style>%(css)s</style>%(ld)s
</head><body>
<header><div class="wrap"><a class="brand" href="/"><img src="/icons/icon-192.png" alt="" width="26" height="26">Repline</a>
<nav><a href="/routines/">Routines</a><a href="/map-codes/">Map codes</a><a href="/">Open app</a></nav></div></header>
<main class="wrap">%(b)s</main>
<footer><div class="wrap"><span>Repline · Independent service, not affiliated with Epic Games.</span>
<span><a href="/routines/">Routines</a> · <a href="/map-codes/">Map codes</a> · <a href="/">Repline</a></span></div></footer>
%(js)s</body></html>
""" % {"t": e(title), "d": e(desc), "u": e(url), "i": e(SITE + img), "css": CSS, "ld": lds, "b": body, "js": COPY_JS}


def crumbs(*items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + p} for i, (n, p) in enumerate(items)]}


def faq(pairs):
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in pairs]}


def code_html(codes):
    out = []
    for c in codes or []:
        by = (" by " + e(c["by"])) if c.get("by") else ""
        out.append('<div class="code"><span class="muted">%s%s</span><code>%s</code><button class="copy" type="button" data-code="%s">Copy</button></div>'
                   % (e(c.get("name") or "Code"), by, e(c["value"]), e(c["value"])))
    return "".join(out)


def mins(n):
    h, m = divmod(int(n), 60)
    return ("%d h %d min" % (h, m) if m else "%d h" % h) if h else "%d min" % m


def build():
    cat = load_catalog()
    sets, goals = cat["sets"], cat["goals"]
    os.makedirs(APP, exist_ok=True)
    written, routes = [], []

    def write(path, text):
        d = os.path.join(APP, path.strip("/"))
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(text)
        written.append(path)

    cards = []
    for g in goals:
        c = COPY.get(g["id"]) or {"slug": "fortnite-%s-routine" % g["id"], "title": "Fortnite %s Routine" % g["name"],
                                    "h1": "Fortnite " + g["name"].lower() + " routine", "lead": g.get("text", ""), "why": ""}
        path = "/routines/%s/" % c["slug"]
        totals = [sum(int(s[1]) for s in L["sets"]) for L in g["lengths"]]
        span = "%s to %s" % (mins(min(totals)), mins(max(totals))) if len(totals) > 1 else mins(totals[0])
        first_img = next((sets[s[0]].get("img") for L in g["lengths"] for s in L["sets"] if s[0] in sets and sets[s[0]].get("img")), None)
        cards.append((g, c, path, span, first_img))

        blocks = []
        for L in g["lengths"]:
            total = sum(int(s[1]) for s in L["sets"])
            items = []
            for s in L["sets"]:
                base = dict(sets.get(s[0]) or {"name": s[0]})
                if len(s) > 2 and isinstance(s[2], dict):
                    base.update(s[2])
                where = ('<div class="set-hint">Where: %s</div>' % e(base["where"])) if base.get("where") else ""
                items.append('<li><span class="set-name">%s <span class="muted">· %s</span></span><span class="set-min">%s</span>'
                             '<div class="set-hint">%s</div>%s%s</li>'
                             % (e(base.get("name", "").strip()), e(TYPE.get(base.get("type"), "Set")), mins(s[1]), e(base.get("hint")), where, code_html(base.get("codes"))))
            start = "/#start=%s.%s" % (g["id"], L["id"])
            blocks.append('<section class="len" id="%s"><div class="len-head"><h3>%s · %s</h3><a href="%s">Start with timers →</a></div><ol>%s</ol></section>'
                          % (e(L["id"]), e(L["name"]), mins(total), e(start), "".join(items)))

        qa = [("How long is this routine?",
               "It comes in %d lengths, from %s. Pick the one that fits your day; every set has its own timer." % (len(totals), span)),
              ("Do I need to pay for the map codes?", "No. Every map is a free Fortnite creative map. Paste the code in Fortnite under Island Code. KovaaK's playlists need KovaaK's on Steam."),
              ("Can I run this routine with timers?", "Yes. Open it in Repline: it walks you through set by set with a timer, the map code ready to copy and your streak tracked. Free, sign in with Discord.")]
        body = ('<p class="muted"><a href="/routines/">Routines</a> › %s</p><h1>%s</h1><p class="lead">%s</p>'
                '<a class="cta" href="/#start=%s.%s">Start this routine free</a><p class="muted">Runs in the browser and in the Windows app with an in-game overlay.</p>'
                '%s<h2>Every set, every map code</h2>%s'
                '<h2>Questions</h2><dl class="faq">%s</dl>'
                % (e(g["name"]), e(c["h1"][0].upper() + c["h1"][1:]), e(c["lead"]), e(g["id"]), e(g["lengths"][min(1, len(g["lengths"]) - 1)]["id"]),
                   ('<p>%s</p>' % e(c["why"])) if c.get("why") else "", "".join(blocks),
                   "".join("<dt>%s</dt><dd>%s</dd>" % (e(q), e(a)) for q, a in qa)))
        desc = (c["lead"][:150].rsplit(" ", 1)[0] + "…") if len(c["lead"]) > 155 else c["lead"]
        write(path, page(path, c["title"] + " · Repline", desc, body,
                         [crumbs(("Repline", "/"), ("Routines", "/routines/"), (g["name"], path)), faq(qa)],
                         img="/" + first_img if first_img else "/icons/icon-1024.png"))
        routes.append(path)

    # Hub: all routines
    grid = "".join('<a class="card stretch" href="%s">%s<div class="in"><h3>%s</h3><span class="muted">%s</span><span class="muted">%s · %d lengths</span></div></a>'
                   % (p, ('<img src="/%s" alt="" loading="lazy">' % e(i.replace(".webp", "-s.webp"))) if i else "", e(c["h1"][0].upper() + c["h1"][1:]), e(g.get("text")), span, len(g["lengths"]))
                   for g, c, p, span, i in cards)
    hub_qa = [("What is the best Fortnite practice routine?", "One you can repeat every day. Start with aim, then edits and freebuild, then fights, then ranked with one focus, and end with a short replay review."),
              ("How long should I practice Fortnite a day?", "Even 15 to 30 focused minutes a day beats one long session a week. Repline's Quick Start is 15 minutes on one map."),
              ("Are these routines free?", "Yes. The routines and map codes are free. Repline adds timers, streaks, leaderboards and an in-game overlay.")]
    hub = ('<h1>Fortnite practice routines</h1><p class="lead">Daily routines for competitive Fortnite: aim, edits, freebuild, piece control, fights, ranked and review. '
           'Every set comes with a timer and the free creative map code.</p><a class="cta" href="/#quick">Try the 15-minute Quick Start</a>'
           '<div class="grid">%s</div><p>Looking for the maps only? See all <a href="/map-codes/">Fortnite training map codes</a>.</p>'
           '<h2>Questions</h2><dl class="faq">%s</dl>' % (grid, "".join("<dt>%s</dt><dd>%s</dd>" % (e(q), e(a)) for q, a in hub_qa)))
    write("/routines/", page("/routines/", "Fortnite Practice Routines with Map Codes (%d) · Repline" % YEAR,
                              "Free daily Fortnite practice routines: aim, edits, freebuild, piece control, fights and cup warm-ups, set by set with timers and map codes.",
                              hub, [crumbs(("Repline", "/"), ("Routines", "/routines/")), faq(hub_qa)]))
    routes.insert(0, "/routines/")

    # Map codes: every code once, with the drills that use it
    used = {}
    for g, c, p, _, _ in cards:
        for L in g["lengths"]:
            for s in L["sets"]:
                used.setdefault(s[0], set()).add((c["h1"][0].upper() + c["h1"][1:], p))
    maps, playlists, seen = [], [], {}
    for key, s in sets.items():
        for cd in s.get("codes") or []:
            entry = seen.get(cd["value"])
            if entry:
                entry["drills"].append(s)
                continue
            entry = {"code": cd, "drills": [s], "img": s.get("img"), "key": key}
            seen[cd["value"]] = entry
            (playlists if "KovaaK" in (cd.get("name", "") + s.get("name", "")) else maps).append(entry)

    def map_card(en):
        cd, first = en["code"], en["drills"][0]
        names = ", ".join(sorted({d["name"].strip() for d in en["drills"]}))
        ins = sorted({x for d in en["drills"] for k, v in sets.items() if v is d for x in used.get(k, ())})
        links = " · ".join('<a href="%s">%s</a>' % (p, e(n)) for n, p in ins)
        img = ('<img src="/%s" alt="%s" loading="lazy">' % (e(en["img"].replace(".webp", "-s.webp")), e(names))) if en.get("img") else ""
        title, hint = MAP_NAMES.get(cd["value"], (names, first.get("hint")))
        drills = ('<span class="muted">Drills: %s</span>' % e(names)) if title != names else ""
        return ('<div class="card">%s<div class="in"><h3>%s</h3>%s<span class="muted">%s</span>%s%s</div></div>'
                % (img, e(title), code_html([cd]), e(hint), drills, ('<span class="muted">Used in: %s</span>' % links) if links else ""))

    mq = [("How do I enter a Fortnite map code?", "In Fortnite open Discover, press the search or Island Code button, paste the code and launch the island."),
          ("Which map is best to warm up in Fortnite?", "A mechanics map like Raider464's V5 covers aim, edits and freebuild in one place. Follow it with a few real box fights."),
          ("How do I import a KovaaK's playlist?", "In KovaaK's go to Playlists, choose Import and paste the share code.")]
    mbody = ('<h1>Fortnite training map codes (%d)</h1><p class="lead">The free creative maps and KovaaK\'s playlists used in Repline\'s routines, with what to train on each one. '
             'Copy a code, paste it in Fortnite under Island Code.</p><a class="cta" href="/routines/">See the routines that use them</a>'
             '<h2>Creative maps</h2><div class="grid">%s</div><h2>KovaaK\'s playlists</h2><div class="grid">%s</div>'
             '<h2>Questions</h2><dl class="faq">%s</dl>' % (YEAR, "".join(map(map_card, maps)), "".join(map(map_card, playlists)),
                                                            "".join("<dt>%s</dt><dd>%s</dd>" % (e(q), e(a)) for q, a in mq)))
    write("/map-codes/", page("/map-codes/", "Best Fortnite Training Map Codes (%d) · Repline" % YEAR,
                               "Free Fortnite training map codes for aim, edits, freebuild, piece control, box fights and realistics, plus KovaaK's playlist codes.",
                               mbody, [crumbs(("Repline", "/"), ("Map codes", "/map-codes/")), faq(mq)], img="/img/map-v5.webp"))
    routes.insert(1, "/map-codes/")

    # robots.txt + sitemap.xml
    open(os.path.join(APP, "robots.txt"), "w").write("User-agent: *\nAllow: /\nDisallow: /download/\n\nSitemap: %s/sitemap.xml\n" % SITE)
    urls = ["/"] + routes
    open(os.path.join(APP, "sitemap.xml"), "w").write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join("  <url><loc>%s%s</loc><lastmod>%s</lastmod></url>\n" % (SITE, u, TODAY) for u in urls) + "</urlset>\n")
    print("seo:", len(written), "pages +", "robots.txt, sitemap.xml")


if __name__ == "__main__":
    build()
