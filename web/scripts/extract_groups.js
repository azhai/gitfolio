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
    console.log(`Extracted Groups component: lines ${startLine+1} to ${endLine}`);
    console.log('Code length:', groupsCode.length);
    
    try {
        new Function(groupsCode);
        console.log('Groups syntax OK');
    } catch (e) {
        console.log('Groups error:', e.message);
        
        const errorLines = e.message.match(/:(\d+)/);
        if (errorLines) {
            const errorLine = parseInt(errorLines[1]);
            console.log(`Error at extracted line ${errorLine}, original line ${startLine + errorLine}`);
            console.log('Content:', lines[startLine + errorLine - 1]);
        }
    }
}