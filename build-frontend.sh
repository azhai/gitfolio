#!/bin/bash

echo "Building GitFolio frontend..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/web"

echo "// GitFolio Frontend Build - $(date)" > app-spa.js

echo "Adding shared constants and utilities..."
sed '/^import /d; /^export /d' src/shared.js >> app-spa.js

echo "Adding API and Auth..."
sed '/^import /d; /^export /d' src/api.js | sed 's/return request(/return m.request(/g' >> app-spa.js

echo "Adding components..."
sed '/^import /d; /^export /d' src/components.js >> app-spa.js

echo "Adding modals..."
sed '/^import /d; /^export /d' src/modals.js >> app-spa.js

echo "Adding project modals..."
sed '/^import /d; /^export /d' src/project-modals.js >> app-spa.js

echo "Adding pages..."
for file in dashboard projects project-detail issues merge-requests releases-stats settings create-project migrate-project login groups activities milestones snippets; do
    echo "Processing $file.js..."
    sed '/^import /d; /^export /d' "src/pages/$file.js" >> app-spa.js
done

echo "Adding app initialization..."
sed '/^import /d; /^export /d' src/app.js >> app-spa.js

echo "Frontend build complete!"
echo "Output: web/app-spa.js"
