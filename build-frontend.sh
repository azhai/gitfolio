#!/usr/bin/env bash
set -e

WEB_DIR="web"
cd "$(dirname "$0")"

case "${1:-build}" in
  dev)
    echo "🚀 Starting frontend dev server..."
    cd "$WEB_DIR" && npm run dev
    ;;
  build)
    echo "🔨 Building frontend..."
    cd "$WEB_DIR" && npm install && npm run build
    echo "✅ Frontend build complete: $WEB_DIR/dist/"
    ;;
  clean)
    echo "🧹 Cleaning frontend dist..."
    rm -rf "$WEB_DIR/dist"
    echo "✅ Cleaned."
    ;;
  install)
    echo "📦 Installing frontend dependencies..."
    cd "$WEB_DIR" && npm install
    ;;
  serve)
    echo "🌐 Serving frontend preview..."
    cd "$WEB_DIR" && npx vite preview
    ;;
  *)
    echo "Usage: $0 {dev|build|clean|install|serve}"
    exit 1
    ;;
esac
