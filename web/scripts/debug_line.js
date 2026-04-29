const fs = require('fs');
const content = fs.readFileSync('web/src/pages/groups.js', 'utf8');
const lines = content.split('\n');
const line = lines[139];
console.log('Line 140 (0-indexed 139):');
console.log(JSON.stringify(line));
console.log('Length:', line.length);
for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i);
    if (c < 32 || c > 126) {
        console.log(`Non-ASCII at ${i}: 0x${c.toString(16)} (${c})`);
    }
}