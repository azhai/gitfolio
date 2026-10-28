#!/usr/bin/env bash
# The frontend is embedded from its sources by go:embed (web/pages, web/assets,
# web/public), so there is nothing to build or copy — just recompile.
set -e

cd "$(dirname "$0")"

case "${1:-build}" in
  dev)
    exec make dev
    ;;
  build)
    make front
    echo "✅ Nothing to build: web/{pages,assets,public} are embedded at compile time."
    ;;
  install)
    echo "ℹ️  Nothing to install: web/assets/lib/ (alpine/marked/microlight/sortable) is vendored."
    ;;
  serve)
    # Pages reference /assets/*, so the preview has to serve web/ as the root
    # and fall back to web/pages — the same mapping main.go does in-process.
    echo "🌐 Serving frontend preview on http://127.0.0.1:5173 ..."
    python3 - <<'PY'
import http.server, os, socketserver

ROOT = os.path.join(os.getcwd(), 'web')

class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        rel = path.split('?', 1)[0].split('#', 1)[0].lstrip('/')
        for base in (ROOT, os.path.join(ROOT, 'pages'), os.path.join(ROOT, 'public')):
            full = os.path.join(base, rel)
            if os.path.exists(full):
                return full
        return os.path.join(ROOT, 'pages', '404.html')

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', 5173), Handler) as httpd:
    httpd.serve_forever()
PY
    ;;
  *)
    echo "Usage: $0 {dev|build|install|serve}"
    exit 1
    ;;
esac
