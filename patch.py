"""
Patch the portfolio index.html:

  1. Add CSS for .shot placeholder tiles and .card-actions button rows.
  2. Promote the Space Invaders and Bible App Prototype cards to full-width
     feature cards laid out exactly like the Marauder card (title, description,
     three-up gallery, caption, tags) and give Space Invaders a demo button.
  3. Replace the one &mdash; with a plain dash.

Run:  python3 patch.py <path-to-index.html>
"""
import sys, io, pathlib

src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "index.html")
html = src.read_text(encoding="utf-8")
orig_len = len(html)
changes = []

# ---- 1. CSS -------------------------------------------------------------
new_css = pathlib.Path("newcss.txt").read_text(encoding="utf-8")
anchor = "  .card-links { display: flex; gap: 1rem; font-size: 0.88rem; }\n"
if anchor in html and ".shot {" not in html:
    html = html.replace(anchor, anchor + "\n" + new_css, 1)
    changes.append("added .shot and .card-actions CSS")

# ---- 2. the two project cards ------------------------------------------
old_block = pathlib.Path("orig_head.txt").read_text(encoding="utf-8")
new_block = pathlib.Path("cards.html").read_text(encoding="utf-8")

if old_block in html:
    html = html.replace(old_block, new_block, 1)
    changes.append("rebuilt Space Invaders + Bible App cards as feature cards")
else:
    # fall back to replacing each card independently, in case whitespace differs
    import re
    def swap(title, replacement):
        global html, changes
        pat = re.compile(
            r'    <div class="card">\s*\n\s*<h3>' + re.escape(title) +
            r'</h3>.*?\n    </div>\n', re.S)
        if pat.search(html):
            html = pat.sub(replacement, html, count=1)
            changes.append(f"replaced card: {title}")
        else:
            print(f"  !! could not find the {title} card - patch it by hand")

    parts = new_block.split('    <div class="card feature">')
    si   = '    <div class="card feature">' + parts[1]
    bib  = '    <div class="card feature">' + parts[2]
    swap("Bible App Prototype", bib)
    swap("Space Invaders Knockoff", si)

# ---- 3. em dash ---------------------------------------------------------
if "&mdash;" in html:
    n = html.count("&mdash;")
    html = html.replace("&mdash;", "-")
    changes.append(f"replaced {n} &mdash; with plain dashes")
for ch in ("—", "–"):
    if ch in html:
        n = html.count(ch)
        html = html.replace(" %s " % ch, " - ").replace(ch, "-")
        changes.append(f"replaced {n} literal long dashes")

src.write_text(html, encoding="utf-8")
print(f"patched {src}  ({orig_len} -> {len(html)} bytes)")
for c in changes:
    print("  -", c)
if not changes:
    print("  nothing changed - already patched?")
