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
    let stack = [];
    let inString = false;
    let stringChar = '';
    
    for (let lineIdx = startLine; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        for (let charIdx = 0; charIdx < line.length; charIdx++) {
            const c = line[charIdx];
            const prevChar = charIdx > 0 ? line[charIdx - 1] : '';
            
            if (inString) {
                if (c === stringChar && prevChar !== '\\') inString = false;
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
                if (stack.length === 0 || stack[stack.length-1].char !== '(') {
                    console.log(`Unmatched ')' at line ${lineIdx + 1}, pos ${charIdx}`);
                    console.log('Stack top:', stack[stack.length-1]);
                    
                    console.log('\nContext:');
                    for (let j = Math.max(startLine, lineIdx - 5); j <= Math.min(lines.length - 1, lineIdx + 2); j++) {
                        console.log(`${j+1}: ${lines[j]}`);
                    }
                    process.exit(1);
                }
                stack.pop();
            } else if (c === ']') {
                if (stack.length === 0 || stack[stack.length-1].char !== '[') {
                    console.log(`Unmatched ']' at line ${lineIdx + 1}, pos ${charIdx}`);
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
        
        if (lineIdx > startLine && lines[lineIdx].includes('const GroupDetail')) {
            break;
        }
    }
    
    if (stack.length > 0) {
        console.log('Unclosed brackets (' + stack.length + '):');
        stack.slice(-10).forEach(item => {
            console.log(`${item.char} at line ${item.line}, pos ${item.pos}: ${lines[item.line-1].substring(Math.max(0, item.pos - 30), item.pos + 30)}`);
        });
    } else {
        console.log('All brackets matched!');
    }
}