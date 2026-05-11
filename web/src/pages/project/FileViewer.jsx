import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, Spinner, Button } from '@chakra-ui/react'
import { useParams, useLocation } from 'react-router-dom'
import { reposAPI } from '../../api/index'
import { t } from '../../i18n/index'
import { LuFileCode as CodeIcon } from 'react-icons/lu'

var BINARY_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'mp4', 'mp3', 'wav', 'avi', 'mov', 'zip', 'tar', 'gz', 'rar', '7z', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'exe', 'dll', 'so', 'dylib', 'woff', 'woff2', 'ttf', 'eot', 'o', 'obj', 'pyc', 'class', 'jar', 'wasm']

var IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'svg', 'webp']

function getExt(name) {
  if (!name) return ''
  var parts = name.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

function isBinary(name) {
  return BINARY_EXTS.indexOf(getExt(name)) >= 0
}

function isImage(name) {
  return IMAGE_EXTS.indexOf(getExt(name)) >= 0
}

function isMarkdown(name) {
  var lower = (name || '').toLowerCase()
  return lower === 'readme.md' || lower.endsWith('.md') || lower.endsWith('.markdown')
}

function getLang(name) {
  var ext = getExt(name)
  var lowerName = (name || '').toLowerCase()
  if (lowerName === 'dockerfile') return 'dockerfile'
  if (lowerName === 'makefile' || lowerName === 'gnumakefile') return 'makefile'
  if (lowerName === '.gitignore' || lowerName === '.dockerignore') return 'bash'
  if (lowerName === 'go.mod' || lowerName === 'go.sum') return 'go'
  if (lowerName === 'cargo.toml' || lowerName === 'cargo.lock') return 'toml'
  if (lowerName === 'package.json' || lowerName === 'tsconfig.json') return 'json'
  if (lowerName === 'cmakelists.txt' || lowerName.endsWith('.cmake')) return 'cmake'
  if (lowerName === 'gemfile' || lowerName === 'rakefile') return 'ruby'
  if (lowerName === 'vagrantfile') return 'ruby'
  if (lowerName === 'jenkinsfile') return 'groovy'
  var map = {
    go: 'go', rs: 'rust', py: 'python', rb: 'ruby',
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    java: 'java', kt: 'kotlin', kts: 'kotlin', scala: 'scala',
    c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp',
    cs: 'csharp', fs: 'fsharp',
    html: 'html', htm: 'html', xml: 'xml', xsl: 'xml', xslt: 'xml', svg: 'xml',
    css: 'css', scss: 'scss', sass: 'scss', less: 'less',
    json: 'json', jsonc: 'json',
    yaml: 'yaml', yml: 'yaml',
    toml: 'toml', ini: 'ini', cfg: 'ini', conf: 'ini',
    md: 'markdown', markdown: 'markdown',
    sql: 'sql', mysql: 'sql', pgsql: 'sql',
    sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
    php: 'php', phtml: 'php',
    swift: 'swift', m: 'objectivec', mm: 'objectivecpp',
    r: 'r', R: 'r', lua: 'lua', vim: 'vim',
    dart: 'dart', groovy: 'groovy', gradle: 'groovy',
    elixir: 'elixir', ex: 'elixir', exs: 'elixir',
    erl: 'erlang', hrl: 'erlang',
    hs: 'haskell', lhs: 'haskell',
    ml: 'ocaml', mli: 'ocaml',
    clj: 'clojure', cljs: 'clojure',
    proto: 'protobuf', thrift: 'thrift',
    dockerfile: 'dockerfile',
    tf: 'hcl', hcl: 'hcl',
    vue: 'vue', svelte: 'svelte',
    perl: 'perl', pl: 'perl', pm: 'perl',
    tcl: 'tcl',
    nim: 'nim',
    zig: 'zig',
    v: 'vlang',
    sol: 'solidity',
    asm: 'asm', s: 'asm',
    makefile: 'makefile', mk: 'makefile',
    cmake: 'cmake',
    diff: 'diff', patch: 'diff',
    log: 'log',
    txt: 'text',
  }
  return map[ext] || 'text'
}

var KEYWORDS = {
  go: 'break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var',
  python: 'and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|None|True|False',
  javascript: 'async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|from|function|if|import|in|instanceof|let|new|of|return|super|switch|this|throw|try|typeof|var|void|while|with|yield|null|undefined|true|false',
  typescript: 'abstract|as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|if|implements|import|in|instanceof|interface|let|new|of|package|private|protected|public|readonly|return|super|switch|this|throw|try|type|typeof|var|void|while|with|yield|null|undefined|true|false|never|unknown|any|void',
  java: 'abstract|assert|break|case|catch|class|const|continue|default|do|else|enum|extends|final|finally|for|goto|if|implements|import|instanceof|interface|native|new|package|private|protected|public|return|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|volatile|while|true|false|null',
  kotlin: 'abstract|actual|annotation|as|break|by|catch|class|companion|const|constructor|continue|crossinline|data|do|else|enum|expect|external|false|final|finally|for|fun|if|import|in|infix|init|inline|inner|interface|internal|is|it|lateinit|noinline|null|object|open|operator|out|override|package|private|protected|public|reified|return|sealed|suspend|super|tailrec|this|throw|true|try|typealias|typeof|val|var|vararg|when|where|while',
  rust: 'as|async|await|break|const|continue|crate|dyn|else|enum|extern|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|type|unsafe|use|where|while|true|false',
  c: 'auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while|NULL',
  cpp: 'alignas|alignof|and|and_eq|asm|auto|bitand|bitor|bool|break|case|catch|char|char8_t|char16_t|char32_t|class|compl|concept|const|consteval|constexpr|constinit|const_cast|continue|co_await|co_return|co_yield|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|false|float|for|friend|goto|if|inline|int|long|mutable|namespace|new|noexcept|not|not_eq|nullptr|operator|or|or_eq|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|true|try|typedef|typeid|typename|union|unsigned|using|virtual|void|volatile|wchar_t|while|xor|xor_eq',
  csharp: 'abstract|as|base|bool|break|byte|case|catch|char|checked|class|const|continue|decimal|default|delegate|do|double|else|enum|event|explicit|extern|false|finally|fixed|float|for|foreach|goto|if|implicit|in|int|interface|internal|is|lock|long|namespace|new|null|object|operator|out|override|params|private|protected|public|readonly|ref|return|sbyte|sealed|short|sizeof|stackalloc|static|string|struct|switch|this|throw|true|try|typeof|uint|ulong|unchecked|unsafe|ushort|using|virtual|void|volatile|while',
  ruby: 'BEGIN|END|alias|and|begin|break|case|class|def|defined|do|else|elsif|end|ensure|false|for|if|in|include|module|next|nil|not|or|redo|rescue|retry|return|self|super|then|true|undef|unless|until|when|while|yield',
  php: 'abstract|and|array|as|break|callable|case|catch|class|clone|const|continue|declare|default|die|do|echo|else|elseif|empty|enddeclare|endfor|endforeach|endif|endswitch|endwhile|eval|exit|extends|final|finally|fn|for|foreach|function|global|goto|if|implements|include|include_once|instanceof|insteadof|interface|isset|list|match|namespace|new|or|print|private|protected|public|require|require_once|return|static|switch|throw|trait|try|unset|use|var|while|xor|yield|null|true|false',
  swift: 'associatedtype|async|await|break|case|catch|class|continue|convenience|default|defer|deinit|didSet|do|else|enum|extension|fallthrough|false|fileprivate|final|for|func|get|guard|if|import|in|infix|init|inout|internal|is|lazy|let|mutating|nil|none|nonisolated|nonmutating|open|operator|optional|override|postfix|precedence|prefix|private|protocol|public|repeat|required|rethrows|return|self|Self|set|some|static|struct|subscript|super|switch|throw|throws|true|try|typealias|unowned|var|weak|where|while|willSet',
  dart: 'abstract|as|assert|async|await|break|case|catch|class|const|continue|covariant|default|deferred|do|dynamic|else|enum|export|extends|extension|external|factory|false|final|finally|for|Function|get|hide|if|implements|import|in|interface|is|late|library|mixin|new|null|on|operator|part|required|rethrow|return|set|show|static|super|switch|this|throw|true|try|typedef|var|void|while|with|yield',
  sql: 'SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|JOIN|INNER|LEFT|RIGHT|OUTER|ON|AND|OR|NOT|IN|EXISTS|BETWEEN|LIKE|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|ALL|AS|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|ELSE|END|IS|NULL|TRUE|FALSE|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|DEFAULT|AUTO_INCREMENT|UNIQUE|CHECK|VIEW|TRIGGER|PROCEDURE|FUNCTION|BEGIN|COMMIT|ROLLBACK|GRANT|REVOKE',
  bash: 'if|then|else|elif|fi|for|while|until|do|done|case|esac|in|function|select|time|coproc|return|exit|break|continue|declare|export|local|readonly|typeset|unset|source|alias|echo|cd|pwd|ls|mkdir|rm|cp|mv|cat|grep|sed|awk|find|sort|uniq|wc|head|tail|true|false',
  dockerfile: 'FROM|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL|MAINTAINER|AS',
  makefile: 'define|endef|ifdef|ifndef|ifeq|ifneq|else|endif|include|override|export|unexport|private|vpath',
  toml: '',
  yaml: '',
  json: '',
  ini: '',
  html: '',
  xml: '',
  css: '',
  scss: '',
  less: '',
  vue: '',
  svelte: '',
  protobuf: 'syntax|import|package|option|message|enum|service|rpc|returns|stream|reserved|extensions|to|max|repeated|optional|required|bool|int32|int64|uint32|uint64|sint32|sint64|fixed32|fixed64|sfixed32|sfixed64|float|double|string|bytes|any|true|false',
  hcl: 'resource|data|provider|variable|output|locals|module|terraform|backend|required_providers|source|version|default|type|description|value|for_each|count|depends_on|lifecycle|create_before_destroy|prevent_destroy|ignore_changes|true|false|null',
  cmake: 'cmake_minimum_required|project|add_executable|add_library|target_link_libraries|find_package|include|set|if|else|elseif|endif|foreach|endforeach|while|endwhile|function|endfunction|macro|endmacro|message|option|add_subdirectory|install|configure_file|add_definitions|include_directories|link_directories|add_compile_options|target_include_directories|target_compile_options|set_target_properties|get_target_property|file|execute_process|separate_arguments|string|list|math|return|break|continue|ON|OFF|TRUE|FALSE',
  groovy: 'abstract|as|assert|break|case|catch|class|const|continue|def|default|do|else|enum|extends|false|final|finally|for|goto|if|implements|import|in|instanceof|interface|native|new|null|package|private|protected|public|return|static|strictfp|super|switch|synchronized|this|throw|throws|transient|true|try|void|volatile|while',
  elixir: 'def|defp|defmodule|defstruct|defprotocol|defimpl|defmacro|defmacrop|defguard|defguardp|defcallback|defexception|do|end|fn|if|else|elseif|for|in|case|cond|when|with|receive|after|try|catch|rescue|raise|throw|nil|true|false|and|or|not|alias|import|require|use|quote|unquote|super|send|spawn|link|unlink|receive|after',
  haskell: 'module|where|import|data|type|newtype|class|instance|deriving|if|then|else|case|of|let|in|do|return|qualified|as|hiding|forall|family|pattern|where|infixl|infixr|infix',
  perl: 'my|our|local|sub|if|elsif|else|unless|while|until|for|foreach|do|eval|require|use|package|BEGIN|END|return|die|warn|print|say|chomp|split|join|map|grep|sort|push|pop|shift|unshift|undef|defined|wantarray|bless|tie|untie|ref|new|true|false|null',
  diff: '',
  log: '',
  text: '',
}

var COMMENT_STYLES = {
  go: { line: '//', block: ['/*', '*/'] },
  rust: { line: '//', block: ['/*', '*/'] },
  python: { line: '#', block: null },
  javascript: { line: '//', block: ['/*', '*/'] },
  typescript: { line: '//', block: ['/*', '*/'] },
  java: { line: '//', block: ['/*', '*/'] },
  kotlin: { line: '//', block: ['/*', '*/'] },
  c: { line: '//', block: ['/*', '*/'] },
  cpp: { line: '//', block: ['/*', '*/'] },
  csharp: { line: '//', block: ['/*', '*/'] },
  ruby: { line: '#', block: ['=begin', '=end'] },
  php: { line: '//', block: ['/*', '*/'] },
  swift: { line: '//', block: ['/*', '*/'] },
  dart: { line: '//', block: ['/*', '*/'] },
  sql: { line: '--', block: ['/*', '*/'] },
  bash: { line: '#', block: null },
  dockerfile: { line: '#', block: null },
  makefile: { line: '#', block: null },
  toml: { line: '#', block: null },
  yaml: { line: '#', block: null },
  ini: { line: ';', block: null },
  html: { line: null, block: ['<!--', '-->'] },
  xml: { line: null, block: ['<!--', '-->'] },
  css: { line: null, block: ['/*', '*/'] },
  scss: { line: '//', block: ['/*', '*/'] },
  less: { line: '//', block: ['/*', '*/'] },
  vue: { line: '//', block: ['/*', '*/'] },
  svelte: { line: '//', block: ['/*', '*/'] },
  protobuf: { line: '//', block: null },
  hcl: { line: '#', block: ['/*', '*/'] },
  cmake: { line: '#', block: null },
  groovy: { line: '//', block: ['/*', '*/'] },
  elixir: { line: '#', block: null },
  haskell: { line: '--', block: ['{-', '-}'] },
  perl: { line: '#', block: null },
  diff: { line: null, block: null },
  log: { line: null, block: null },
  json: { line: null, block: null },
  text: { line: null, block: null },
}

var TYPE_KEYWORDS = {
  go: 'bool|byte|complex64|complex128|error|float32|float64|int|int8|int16|int32|int64|rune|string|uint|uint8|uint16|uint32|uint64|uintptr',
  python: 'int|float|str|bool|list|dict|tuple|set|bytes|bytearray|complex|frozenset|range|type|object|None',
  javascript: 'undefined|null|NaN|Infinity',
  typescript: 'string|number|boolean|void|never|unknown|any|undefined|null|object|bigint|symbol|NaN|Infinity',
  java: 'boolean|byte|char|double|float|int|long|short|void|String|Integer|Long|Double|Float|Boolean|Byte|Short|Character|Object|Class',
  kotlin: 'Boolean|Byte|Short|Int|Long|Float|Double|String|Array|List|Map|Set|Unit|Nothing|Any',
  rust: 'i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize|f32|f64|bool|char|str|Self|Option|Result|Vec|String|Box|Rc|Arc',
  c: 'int|long|short|float|double|char|void|unsigned|signed|size_t|ptrdiff_t|NULL|FILE',
  cpp: 'int|long|short|float|double|char|void|bool|wchar_t|size_t|nullptr_t|auto|std|string|vector|map|set|unique_ptr|shared_ptr',
  csharp: 'bool|byte|char|decimal|double|float|int|long|sbyte|short|string|uint|ulong|ushort|void|object|dynamic|var',
  ruby: 'Integer|Float|String|Array|Hash|Symbol|TrueClass|FalseClass|NilClass|Regexp|Range|Proc|Lambda',
  php: 'int|float|string|bool|array|object|null|callable|iterable|void|mixed|never|self|static|parent',
  swift: 'Int|UInt|Float|Double|String|Bool|Character|Array|Dictionary|Set|Optional|Any|AnyObject|Void|Never|Result',
  dart: 'int|double|String|bool|List|Map|Set|dynamic|Object|void|Never|Future|Stream|Iterable|Duration|BigInt|num|Pattern|Uri|DateTime',
  sql: 'INTEGER|INT|BIGINT|SMALLINT|TINYINT|FLOAT|DOUBLE|DECIMAL|NUMERIC|VARCHAR|CHAR|TEXT|BLOB|DATE|TIME|DATETIME|TIMESTAMP|BOOLEAN|SERIAL|BIGSERIAL',
  protobuf: 'int32|int64|uint32|uint64|sint32|sint64|fixed32|fixed64|sfixed32|sfixed64|float|double|bool|string|bytes|any|repeated|optional|required',
  hcl: 'string|number|bool|list|map|set|object|tuple|any|bool|true|false|null',
}

function highlightLine(line, lang) {
  var escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  if (lang === 'json') {
    escaped = escaped.replace(/("(?:[^"\\]|\\.)*")\s*:/g, '<span style="color:#7c3aed">$1</span>:')
    escaped = escaped.replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span style="color:#16a34a">$1</span>')
    escaped = escaped.replace(/:\s*(\d+\.?\d*)/g, ': <span style="color:#2563eb">$1</span>')
    escaped = escaped.replace(/:\s*(true|false|null)/g, ': <span style="color:#dc2626">$1</span>')
    return escaped
  }

  if (lang === 'html' || lang === 'xml' || lang === 'vue' || lang === 'svelte') {
    escaped = escaped.replace(/(&lt;\/?[\w-]+)/g, '<span style="color:#7c3aed">$1</span>')
    escaped = escaped.replace(/(\/?&gt;)/g, '<span style="color:#7c3aed">$1</span>')
    escaped = escaped.replace(/\s([\w-]+)(=)/g, ' <span style="color:#d97706">$1</span>$2')
    escaped = escaped.replace(/("(?:[^"\\]|\\.)*")/g, '<span style="color:#16a34a">$1</span>')
    escaped = escaped.replace(/('(?:[^'\\]|\\.)*')/g, '<span style="color:#16a34a">$1</span>')
    escaped = escaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span style="color:#9ca3af">$1</span>')
    return escaped
  }

  if (lang === 'css' || lang === 'scss' || lang === 'less') {
    escaped = escaped.replace(/([\w-]+)\s*:/g, '<span style="color:#7c3aed">$1</span>:')
    escaped = escaped.replace(/(#[0-9a-fA-F]{3,8})\b/g, '<span style="color:#16a34a">$1</span>')
    escaped = escaped.replace(/(\d+\.?\d*)(px|em|rem|%|vh|vw|s|ms|deg|fr)/g, '<span style="color:#2563eb">$1$2</span>')
    escaped = escaped.replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#9ca3af">$1</span>')
    return escaped
  }

  if (lang === 'diff') {
    if (escaped.startsWith('+') || escaped.startsWith('&gt;+')) return '<span style="color:#16a34a">' + escaped + '</span>'
    if (escaped.startsWith('-') || escaped.startsWith('&gt;-')) return '<span style="color:#dc2626">' + escaped + '</span>'
    if (escaped.startsWith('@@') || escaped.startsWith('&gt;@@')) return '<span style="color:#2563eb">' + escaped + '</span>'
    return escaped
  }

  if (lang === 'yaml' || lang === 'toml' || lang === 'ini') {
    escaped = escaped.replace(/^(\s*[\w.-]+)(:)/gm, '$1<span style="color:#7c3aed">$2</span>')
    escaped = escaped.replace(/:\s+(true|false|null|yes|no)/g, ': <span style="color:#dc2626">$1</span>')
    escaped = escaped.replace(/:\s+(\d+\.?\d*)/g, ': <span style="color:#2563eb">$1</span>')
    escaped = escaped.replace(/:\s+("(?:[^"\\]|\\.)*")/g, ': <span style="color:#16a34a">$1</span>')
    escaped = escaped.replace(/:\s+('(?:[^'\\]|\\.)*')/g, ': <span style="color:#16a34a">$1</span>')
    escaped = escaped.replace(/(#.*)/g, '<span style="color:#9ca3af">$1</span>')
    return escaped
  }

  if (lang === 'sql') {
    var sqlKw = KEYWORDS.sql
    escaped = escaped.replace(new RegExp('\\b(' + sqlKw + ')\\b', 'gi'), '<span style="color:#7c3aed">$1</span>')
    escaped = escaped.replace(/('(?:[^'\\]|\\.)*')/g, '<span style="color:#16a34a">$1</span>')
    escaped = escaped.replace(/(--.*)/g, '<span style="color:#9ca3af">$1</span>')
    escaped = escaped.replace(/(\d+\.?\d*)/g, '<span style="color:#2563eb">$1</span>')
    return escaped
  }

  if (lang === 'makefile') {
    escaped = escaped.replace(/^([\w.-]+)\s*:/gm, '<span style="color:#7c3aed">$1</span>:')
    escaped = escaped.replace(/(\$[\({][\w.]+[\)}])/g, '<span style="color:#d97706">$1</span>')
    escaped = escaped.replace(/(#.*)/g, '<span style="color:#9ca3af">$1</span>')
    return escaped
  }

  if (lang === 'dockerfile') {
    var dkKw = KEYWORDS.dockerfile
    escaped = escaped.replace(new RegExp('\\b(' + dkKw + ')\\b', 'g'), '<span style="color:#7c3aed">$1</span>')
    escaped = escaped.replace(/("(?:[^"\\]|\\.)*")/g, '<span style="color:#16a34a">$1</span>')
    escaped = escaped.replace(/(#.*)/g, '<span style="color:#9ca3af">$1</span>')
    return escaped
  }

  if (lang === 'cmake') {
    var cmakeKw = KEYWORDS.cmake
    escaped = escaped.replace(new RegExp('\\b(' + cmakeKw + ')\\b', 'g'), '<span style="color:#7c3aed">$1</span>')
    escaped = escaped.replace(/(\$[\{][\w.]+[\}])/g, '<span style="color:#d97706">$1</span>')
    escaped = escaped.replace(/("(?:[^"\\]|\\.)*")/g, '<span style="color:#16a34a">$1</span>')
    escaped = escaped.replace(/(#.*)/g, '<span style="color:#9ca3af">$1</span>')
    return escaped
  }

  var kw = KEYWORDS[lang]
  var cs = COMMENT_STYLES[lang] || {}
  var types = TYPE_KEYWORDS[lang]

  var placeholders = []
  function addPlaceholder(html) {
    placeholders.push(html)
    return '\x00PH' + (placeholders.length - 1) + 'PH\x00'
  }

  if (cs.line) {
    var lineCommentRe = cs.line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    escaped = escaped.replace(new RegExp('(' + lineCommentRe + '.*)', 'g'), function(m) {
      return addPlaceholder('<span style="color:#9ca3af">' + m + '</span>')
    })
  }

  escaped = escaped.replace(/("(?:[^"\\]|\\.)*")/g, function(m) {
    return addPlaceholder('<span style="color:#16a34a">' + m + '</span>')
  })
  escaped = escaped.replace(/('(?:[^'\\]|\\.)*')/g, function(m) {
    return addPlaceholder('<span style="color:#16a34a">' + m + '</span>')
  })
  escaped = escaped.replace(/(`(?:[^`\\]|\\.)*`)/g, function(m) {
    return addPlaceholder('<span style="color:#16a34a">' + m + '</span>')
  })

  if (kw) {
    escaped = escaped.replace(new RegExp('\\b(' + kw + ')\\b', 'g'), '<span style="color:#7c3aed">$1</span>')
  }

  if (types) {
    escaped = escaped.replace(new RegExp('\\b(' + types + ')\\b', 'g'), '<span style="color:#0891b2">$1</span>')
  }

  escaped = escaped.replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#2563eb">$1</span>')

  for (var i = placeholders.length - 1; i >= 0; i--) {
    escaped = escaped.replace('\x00PH' + i + 'PH\x00', placeholders[i])
  }

  return escaped
}

function renderMarkdown(text) {
  var html = text
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(_, lang, code) {
    var l = lang || 'text'
    var lines = code.replace(/\n$/, '').split('\n')
    var highlighted = lines.map(function(line) {
      return highlightLine(line, l) || ' '
    }).join('<br/>')
    return '<div style="background:#f6f8fa;padding:16px;border-radius:8px;overflow:auto;font-size:13px;line-height:1.6;margin:12px 0;font-family:\'JetBrains Mono\',\'Fira Code\',\'SF Mono\',Consolas,monospace">' + highlighted + '</div>'
  })
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f0fdf4;padding:2px 6px;border-radius:4px;font-size:13px;color:#16a34a;font-family:\'JetBrains Mono\',\'Fira Code\',\'SF Mono\',Consolas,monospace">$1</code>')
  html = html.replace(/^#### (.+)$/gm, '<h4 style="font-size:15px;font-weight:600;margin:16px 0 8px">$1</h4>')
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:600;margin:18px 0 8px">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:700;margin:20px 0 10px">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:700;margin:24px 0 12px">$1</h1>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/^\- (.+)$/gm, '<li style="margin-left:20px;list-style:disc">$1</li>')
  html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-left:20px;list-style:decimal">$1</li>')
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote style="border-left:3px solid #22c55e;padding-left:12px;color:#666;margin:8px 0">$1</blockquote>')
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#16a34a;text-decoration:underline">$1</a>')
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>')
  html = html.replace(/\n\n/g, '</p><p style="margin:8px 0">')
  html = html.replace(/\n/g, '<br/>')
  html = '<p style="margin:8px 0">' + html + '</p>'
  return html
}

function getRawUrl(owner, repo, filePath, ref) {
  var encodedPath = filePath.split('/').map(function(s) { return encodeURIComponent(s) }).join('/')
  return '/api/v1/' + owner + '/' + repo + '/raw/' + encodedPath + '?ref=' + (ref || 'HEAD')
}

const FileViewer = ({ filePath: propFilePath, owner: propOwner, repo: propRepo, branchRef: propRef }) => {
  const params = useParams()
  const location = useLocation()
  const owner = propOwner || params.owner
  const repo = propRepo || params.repo
  var ref = propRef || 'HEAD'

  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  var filePath = propFilePath
  if (!filePath) {
    var pathParts = location.pathname.replace('/' + owner + '/' + repo + '/tree/', '').split('/')
    filePath = pathParts.join('/')
  }
  var fileName = filePath.split('/').pop()
  var lang = getLang(fileName)
  var binary = isBinary(fileName)
  var image = isImage(fileName)
  var markdown = isMarkdown(fileName)
  var [showSource, setShowSource] = useState(false)

  useEffect(() => {
    if (binary) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    reposAPI.file(owner, repo, filePath, ref).then(function(data) {
      if (typeof data === 'string') {
        setContent(data)
      } else if (data && typeof data.content === 'string') {
        setContent(data.content)
      } else if (data && data.content) {
        setContent(String(data.content))
      } else {
        setContent('')
      }
    }).catch(function(err) {
      setError(err.message || t('fileViewer.loadFailed'))
    }).finally(function() { setLoading(false) })
  }, [owner, repo, filePath, ref, binary])

  var lines = content ? content.split('\n') : []

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  if (error) {
    return (
      <Box textAlign="center" py="40px" color="#dc2626">
        <Text fontSize="14px">{error}</Text>
      </Box>
    )
  }

  if (image) {
    return (
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" textAlign="center">
        <Box as="img" src={getRawUrl(owner, repo, filePath, ref)} alt={fileName}
          maxW="100%" maxH="600px" borderRadius="6px"
          onError={function(e) { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }}
          sx={{ display: 'block', mx: 'auto' }} />
        <Text fontSize="13px" color="#aaa" mt="12px" display="none">{t('fileViewer.imageLoadFailed')}</Text>
      </Box>
    )
  }

  if (binary) {
    return (
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" py="60px" textAlign="center" color="#888">
        <Text fontSize="36px" mb="8px">📦</Text>
        <Text fontSize="14px" mb="12px">{t('fileViewer.binaryFile')}</Text>
        <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
          _hover={{ bg: '#16a34a' }}
          as="a" href={getRawUrl(owner, repo, filePath, ref)} target="_blank">
          {t('fileViewer.downloadFile')}
        </Button>
      </Box>
    )
  }

  if (markdown && content) {
    if (showSource) {
      return (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden" pos="relative">
          <Flex pos="absolute" top="10px" right="12px" zIndex={2}>
            <Button h="26px" px="10px" fontSize="12px" rounded="4px" variant="outline"
              borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#22c55e', color: '#22c55e' }}
              onClick={function() { setShowSource(false) }}
              leftIcon={<CodeIcon size={12} />}>
              {t('fileViewer.rendered')}
            </Button>
          </Flex>
          <Box overflow="auto" maxH="70vh">
            <Box as="pre" fontSize="13px" fontFamily="'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace" lineHeight="1.6" m={0} p={0}>
              {lines.map(function(line, idx) {
                return (
                  <Flex key={idx} _hover={{ bg: '#f0fdf4' }} transition="background-color 0.1s" align="flex-start">
                    <Box w="52px" textAlign="right" pr="14px" pl="12px" color="#bbb" userSelect="none" flexShrink={0} fontSize="12px" lineHeight="1.6" py="0" pos="sticky" left="0" bg="white" zIndex={1}>
                      {idx + 1}
                    </Box>
                    <Box flex={1} pr="16px" py="0" whiteSpace="pre-wrap" wordBreak="break-all" overflowWrap="break-word">
                      <span dangerouslySetInnerHTML={{ __html: highlightLine(line, lang) || ' ' }} />
                    </Box>
                  </Flex>
                )
              })}
            </Box>
          </Box>
        </Box>
      )
    }
    return (
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px 28px" pos="relative"
        fontSize="14px" lineHeight="1.8" color="#333"
        sx={{ '& h1, & h2, & h3, & h4': { color: '#1a1a1a' }, '& a': { color: '#16a34a' }, '& code': { fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace" } }}>
        <Flex pos="absolute" top="10px" right="12px" zIndex={2}>
          <Button h="26px" px="10px" fontSize="12px" rounded="4px" variant="outline"
            borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#22c55e', color: '#22c55e' }}
            onClick={function() { setShowSource(true) }}
            leftIcon={<CodeIcon size={12} />}>
            {t('fileViewer.viewSource')}
          </Button>
        </Flex>
        <Box dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
      </Box>
    )
  }

  if (content) {
    return (
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden" pos="relative">
        <Flex pos="absolute" top="10px" right="12px" zIndex={2}>
          <Button h="26px" px="10px" fontSize="12px" rounded="4px" variant="outline"
            borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#22c55e', color: '#22c55e' }}
            as="a" href={getRawUrl(owner, repo, filePath, ref)} target="_blank"
            leftIcon={<CodeIcon size={12} />}>
            {t('fileViewer.viewSource')}
          </Button>
        </Flex>
        <Box overflow="auto" maxH="70vh">
          <Box as="pre" fontSize="13px" fontFamily="'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace" lineHeight="1.6" m={0} p={0}>
            {lines.map(function(line, idx) {
              return (
                <Flex key={idx} _hover={{ bg: '#f0fdf4' }} transition="background-color 0.1s" align="flex-start">
                  <Box w="52px" textAlign="right" pr="14px" pl="12px" color="#bbb" userSelect="none" flexShrink={0} fontSize="12px" lineHeight="1.6" py="0" pos="sticky" left="0" bg="white" zIndex={1}>
                    {idx + 1}
                  </Box>
                  <Box flex={1} pr="16px" py="0" whiteSpace="pre-wrap" wordBreak="break-all" overflowWrap="break-word">
                    <span dangerouslySetInnerHTML={{ __html: highlightLine(line, lang) || ' ' }} />
                  </Box>
                </Flex>
              )
            })}
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Box textAlign="center" py="40px" color="#aaa">
      <Text fontSize="14px">{t('fileViewer.emptyFile')}</Text>
    </Box>
  )
}

export default FileViewer
export { highlightLine }
