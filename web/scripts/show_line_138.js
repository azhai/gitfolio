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
    console.log('Line 138 of Groups component (original line', startLine + 137, '):');
    console.log(lines[startLine + 137]);
    console.log('\nPos 29:', lines[startLine + 137].charAt(29));
    console.log('\nContext around pos 29:');
    console.log(lines[startLine + 137].substring(20, 40));
    
    console.log('\nLines 135-142:');
    for (let i = 134; i < 142; i++) {
        const marker = i === 137 ? '>>>' : '   ';
        console.log(`${marker} ${i+1}: ${lines[startLine + i]}`);
    }
}