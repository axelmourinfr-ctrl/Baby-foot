#!/usr/bin/env python3
"""
BabyFoot Coach RPG — Script de build
Usage: python3 build.py
Fusionne tous les fichiers en un seul index.html pour GitHub Pages
"""
import os, re

ROOT = os.path.dirname(os.path.abspath(__file__))

JS_FILES = [
    'js/db-data.js',
    'js/xp-badges.js',
    'js/training.js',
    'js/league.js',
    'js/objectives.js',
    'js/video.js',
    'js/coach-ia.js',
    'js/app.js',
]

def build():
    print("🔨 Build BabyFoot Coach RPG...")

    # Read CSS
    with open(os.path.join(ROOT, 'css/style.css')) as f:
        css = f.read()
    print(f"  ✅ style.css ({len(css.splitlines())} lignes)")

    # Read JS modules
    js_parts = []
    for js_file in JS_FILES:
        path = os.path.join(ROOT, js_file)
        with open(path) as f:
            code = f.read()
        js_parts.append(f'// ── {js_file} ──\n{code}')
        print(f"  ✅ {js_file} ({len(code.splitlines())} lignes)")
    js_all = '\n'.join(js_parts)

    # Read HTML template
    with open(os.path.join(ROOT, 'index.html')) as f:
        html = f.read()

    # Fix deprecated meta
    html = html.replace(
        '<meta name="apple-mobile-web-app-capable" content="yes">',
        '<meta name="mobile-web-app-capable" content="yes">'
    )

    # Inline CSS
    html = html.replace(
        '<link rel="stylesheet" href="css/style.css">',
        f'<style>\n{css}\n</style>'
    )

    # Remove external JS script tags
    for js_file in JS_FILES:
        html = html.replace(f'<script src="{js_file}"></script>', '')

    # Inject all JS before </body>
    html = html.replace('</body>', f'<script>\n{js_all}\n</script>\n</body>')

    # Write output
    out = os.path.join(ROOT, 'dist', 'index.html')
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    with open(out, 'w') as f:
        f.write(html)

    size = len(html) // 1024
    lines = len(html.splitlines())
    print(f"\n✅ Build terminé : dist/index.html ({lines} lignes, {size}KB)")
    print("📤 Upload dist/index.html sur GitHub Pages")

if __name__ == '__main__':
    build()
