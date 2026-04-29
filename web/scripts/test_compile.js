const fs = require('fs');
const vm = require('vm');

try {
    const code = fs.readFileSync('web/app-spa.js', 'utf8');
    console.log('File size:', code.length, 'bytes');
    console.log('First 10 bytes:', Array.from(code.slice(0, 10)).map(c => '0x' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '));
    
    new Function(code);
    console.log('Syntax OK with new Function()');
} catch (e) {
    console.log('Error:', e.message);
    console.log('Stack:', e.stack);
}