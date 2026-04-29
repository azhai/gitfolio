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
    const codeLines = groupsCode.split('\n');
    
    let stack = [];
    let inString = false;
    let stringChar = '';
    let templateDepth = 0;
    
    for (let lineIdx = 0; lineIdx < codeLines.length; lineIdx++) {
        const line = codeLines[lineIdx];
        for (let charIdx = 0; charIdx < line.length; charIdx++) {
            const c = line[charIdx];
            const prevChar = charIdx > 0 ? line[charIdx - 1] : '';
            
            if (inString) {
                if (c === stringChar && prevChar !== '\\') {
                    inString = false;
                }
                continue;
            }
            
            if (c === '`') {
                templateDepth++;
                inString = true;
                stringChar = c;
                continue;
            }
            
            if (c === '"' || c === "'") {
                inString = true;
                stringChar = c;
                continue;
            }
            
            if (c === '(') {
                stack.push({char: '(', line: lineIdx + 1, pos: charIdx});
            } else if (c === ')') {
                if (stack.length === 0 || stack[stack.length-1].char !== '(') {
                    console.log(`Unmatched ')' at line ${lineIdx + 1}, pos ${charIdx}`);
                    console.log('Stack:', JSON.stringify(stack.slice(-5)));
                    process.exit(1);
                }
                stack.pop();
            }
        }
    }
    
    if (stack.length > 0) {
        console.log('Unclosed parentheses:');
        stack.forEach(item => {
            console.log(`  Line ${item.line}, pos ${item.pos}: ${codeLines[item.line-1].substring(Math.max(0, item.pos - 20), item.pos + 20)}`);
        });
    } else {
        console.log('All parentheses matched');
    }
}