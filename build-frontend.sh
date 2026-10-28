#!/usr/bin/env bash
set -e

WEB_DIR="web"
cd "$(dirname "$0")"

case "${1:-build}" in
  dev)
    echo "🚀 Watching frontend sources, copying to $WEB_DIR/dist ..."
    cd "$WEB_DIR" && pnpm run dev
    ;;
  build)
    echo "🔨 Building frontend..."
    cd "$WEB_DIR" && pnpm install && pnpm run build
    echo "✅ Frontend build complete: $WEB_DIR/dist/"
    ;;
  clean)
    echo "🧹 Cleaning frontend dist..."
    rm -rf "$WEB_DIR/dist"
    echo "✅ Cleaned."
    ;;
  install)
    echo "📦 Installing frontend dependencies and vendoring libraries..."
    cd "$WEB_DIR" && pnpm install
    ;;
  serve)
    echo "🌐 Serving frontend preview..."
    cd "$WEB_DIR/dist" && python3 -m http.server 5173
    ;;
  *)
    echo "Usage: $0 {dev|build|clean|install|serve}"
    exit 1
    ;;
esac
