"""Build the pages from src/ (a plain concatenation).

moons-of-ganthia.html is the fragment published as a Claude artifact; index.html is the
same page as a full HTML document for any static web host (GitHub Pages and the like).
"""
from pathlib import Path
root = Path(__file__).parent
src = root / "src"
head, body = (src/"head.html").read_text(), (src/"body.html").read_text()
script = "<script>\n" + (src/"core.js").read_text() + "\n" + (src/"app.js").read_text() + "\n</script>\n"

html = head + body + script
(root / "moons-of-ganthia.html").write_text(html)
print("wrote moons-of-ganthia.html,", len(html), "bytes")

doc_head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            '<meta name="description" content="Moons of Ganthia: the sky, orrery and ley lines of Ganthia\'s moons.">\n')
page = (doc_head + head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
        + '<style>html,body{margin:0}</style>\n</head>\n<body>\n' + body + script + '</body>\n</html>\n')
(root / "index.html").write_text(page)
print("wrote index.html,", len(page), "bytes")
