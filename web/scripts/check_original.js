const fs = require('fs');
const content = fs.readFileSync('web/src/pages/groups.js', 'utf8');
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
            
            if (c === '"' || c === "'" || c === '`') {
                inString = true;
                stringChar = c;
                continue;
            }
            
            if (c === '(' || c === '[' || c === '{') {
                stack.push({char: c, line: lineIdx + 1, pos: charIdx});
            } else if (c === ')') {
                if (stack.length === 0 || !['(', '[', '{'].includes(stack[stack.length-1].char)) {
                    console.log(`Unmatched ')' at line ${lineIdx + 1}, pos ${charIdx}`);
                    console.log('Stack top:', stack.length > 0 ? stack[stack.length-1] : 'empty');
                    process.exit(1);
                }
                stack.pop();
            } else if (c === ']') {
                if (stack.length === 0 || stack[stack.length-1].char !== '[') {
                    console.log(`Unmatched ']' at line ${lineIdx + 1}, pos ${charIdx}`);
                    console.log('Stack:', JSON.stringify(stack.slice(-5)));
                    
                    console.log('\nContext:');
                    for (let i = Math.max(0, lineIdx - 3); i <= Math.min(codeLines.length - 1, lineIdx + 2); i++) {
                        const marker = i === lineIdx ? '>>>' : '   ';
                        console.log(`${marker} ${i+1}: ${codeLines[i]}`);
                    }
                    process.exit(1);
                }
                stack.pop();
            } else if (c === '}') {
                if (stack.length === 0 || stack[stack.length-1].char !== '{') {
                    console.log(`Unmatched '}' at line ${lineIdx + 1}, pos ${charIdx}`);
                    process.exit(1);
                }
                stack.pop();
            }
        }
    }
    
    if (stack.length > 0) {
        console.log('Unclosed brackets (' + stack.length + '):');
        stack.forEach(item => {
            console.log(`  ${item.char} at line ${item.line}, pos ${item.pos}`);
        });
    } else {
        console.log('All brackets matched in original file!');
    }
}