const fs = require('fs');
const content = fs.readFileSync('web/app-spa.js', 'utf8');
const line = content.split('\n')[7765];
console.log('Full hex dump of line 7766:');
for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i);
    process.stdout.write(c.toString(16).padStart(2, '0') + ' ');
    if ((i + 1) % 20 === 0) process.stdout.write('\n');
}
console.log('\n\nCharacter by character:');
for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const code = line.charCodeAt(i);
    if (code < 32 || code > 126) {
        console.log(`[${i}] U+${code.toString(16).padStart(4, '0')} (${code})`);
    } else {
        process.stdout.write(c);
    }
}
console.log();