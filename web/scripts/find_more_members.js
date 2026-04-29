const fs = require('fs');
const content = fs.readFileSync('web/app-spa.js', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('more-members')) {
        console.log(`Line ${i+1} (0-indexed ${i}):`);
        console.log(JSON.stringify(lines[i]));
        console.log('Length:', lines[i].length);
        for (let j = 0; j < lines[i].length; j++) {
            const c = lines[i].charCodeAt(j);
            if (c < 32 || c > 126) {
                console.log(`Non-ASCII at ${j}: 0x${c.toString(16)} (${c})`);
            }
        }
        console.log('---');
    }
}