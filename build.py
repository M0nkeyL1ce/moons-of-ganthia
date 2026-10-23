"""Build the pages from src/ (a plain concatenation), in two editions.

Source between @dm markers is for the DM only (the Amber Moon and its 9179 pass):
  /*@dm*/ ... /*@end*/  in JS and CSS,  <!--@dm--> ... <!--@end-->  in HTML,
  /*@dm*/ dm text /*@else*/ player text /*@end*/  to swap a value.

  site/index.html            player edition, full HTML document; Cloudflare deploys only site/ (wrangler.jsonc)
  dm/index.html              DM edition, full HTML document; open it locally
  dm/moons-of-ganthia.html   DM edition as a fragment; the form published as the Claude artifact

dm/ is gitignored, so GitHub Pages never serves it.
"""
import re
import sys
from pathlib import Path

root = Path(__file__).parent
src = root / "src"
MARK = re.compile(r"(?:/\*|<!--)@dm(?:\*/|-->)(.*?)"
                  r"(?:(?:/\*|<!--)@else(?:\*/|-->)(.*?))?"
                  r"(?:/\*|<!--)@end(?:\*/|-->)", re.S)
# words that must never reach the player edition
LEAKS = ("amber", "lure", "sinclair", "impact", "@dm", "@else", "@end")

def edition(text, dm):
    return MARK.sub(lambda m: m.group(1) if dm else (m.group(2) or ""), text)

def fragment(dm):
    head, body = (edition((src/f).read_text(), dm) for f in ("head.html", "body.html"))
    script = ("<script>\n" + edition((src/"core.js").read_text(), dm) + "\n"
              + edition((src/"app.js").read_text(), dm) + "\n</script>\n")
    return head, body, script

def document(head, body, script):
    doc_head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
                '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
                '<meta name="description" content="Moons of Ganthia: the sky, orrery and ley lines of Ganthia\'s moons.">\n')
    return (doc_head + head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
            + '<style>html,body{margin:0}</style>\n</head>\n<body>\n' + body + script + '</body>\n</html>\n')

def write(path, text):
    path.parent.mkdir(exist_ok=True)
    path.write_text(text)
    print(f"wrote {path.relative_to(root)}, {len(text.encode())} bytes")

player = document(*fragment(dm=False))
found = [w for w in LEAKS if w in player.lower()]
if found:
    sys.exit(f"!! player edition NOT written: it still contains {', '.join(found)}")
write(root / "site" / "index.html", player)

dm = fragment(dm=True)
write(root / "dm" / "index.html", document(*dm))
write(root / "dm" / "moons-of-ganthia.html", "".join(dm))
