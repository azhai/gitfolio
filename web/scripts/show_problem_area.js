const fs = require('fs');
const content = fs.readFileSync('web/app-spa.js', 'utf8');
const lines = content.split('\n');
let startLine = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const Groups = {')) {
        startLine = i;
        break;
    }
}

if (startLine >= 0) {
    console.log('Groups component starts at line', startLine + 1);
    console.log('\nLines 60-75 of Groups component (original lines', startLine + 60, 'to', startLine + 75, '):');
    for (let i = 59; i < Math.min(80, lines.length - startLine); i++) {
        const marker = i === 66 ? '>>>' : '   ';
        console.log(`${marker} ${i+1}: ${lines[startLine + i]}`);
    }
}