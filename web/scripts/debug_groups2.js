const fs = require('fs');
const vm = require('vm');

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
        const script = new vm.Script(groupsCode);
        console.log('Groups component syntax OK');
    } catch (e) {
        console.log('Full error:', e.toString());
        console.log('Stack:', e.stack);
        
        if (e instanceof SyntaxError) {
            const lineMatch = e.message.match(/:(\d+)/);
            if (lineMatch) {
                const errorLine = parseInt(lineMatch[1]);
                console.log(`\nError at Groups component line ${errorLine} (original file line ${startLine + errorLine})`);
                console.log('Problematic line:', lines[startLine + errorLine - 1]);
                
                console.log('\nContext (5 lines before, 2 lines after):');
                for (let i = Math.max(0, errorLine - 6); i < Math.min(groupsCode.split('\n').length, errorLine + 2); i++) {
                    const marker = i === errorLine - 1 ? '>>>' : '   ';
                    console.log(`${marker} ${i+1}: ${groupsCode.split('\n')[i]}`);
                }
            }
        }
    }
}