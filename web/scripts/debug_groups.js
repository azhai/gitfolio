const fs = require('fs');
const content = fs.readFileSync('web/app-spa.js', 'utf8');
const lines = content.split('\n');
let startLine = -1;
let endLine = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const Groups = {')) {
        startLine = i;
    }
    if (startLine >= 0 && lines[i].includes('const GroupDetail = {')) {
        endLine = i;
        break;
    }
}

if (startLine >= 0 && endLine > startLine) {
    const groupsCode = lines.slice(startLine, endLine).join('\n');
    
    try {
        new Function(groupsCode);
        console.log('Groups component syntax OK');
    } catch (e) {
        console.log('Error:', e.message);
        const errorMatch = e.message.match(/:(\d+)/);
        if (errorMatch) {
            const errorLine = parseInt(errorMatch[1]);
            console.log(`Error at line ${errorLine} of Groups component`);
            console.log('Content:', lines[startLine + errorLine - 1]);
            
            console.log('\nContext:');
            for (let i = Math.max(0, errorLine - 5); i < Math.min(groupsCode.split('\n').length, errorLine + 3); i++) {
                const marker = i === errorLine - 1 ? '>>>' : '   ';
                console.log(`${marker} ${i+1}: ${groupsCode.split('\n')[i]}`);
            }
        }
    }
}