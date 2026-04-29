const fs = require('fs');
let code = fs.readFileSync('web/app-spa.js', 'utf8');
const lines = code.split('\n');
const line = lines[7717];
console.log('Hex dump:');
for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i);
    process.stdout.write(c.toString(16).padStart(2, '0') + ' ');
    if ((i + 1) % 16 === 0) console.log();
}
console.log();