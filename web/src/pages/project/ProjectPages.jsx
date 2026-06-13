// Merged project pages

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertDialog, AlertDialogBody, AlertDialogCloseButton, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, Avatar, Badge, Box, Button, Divider, Flex, HStack, Input, Menu, MenuButton, MenuItem, MenuList, Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay, Select, SimpleGrid, Spinner, Switch, Tab, TabList, TabPanel, TabPanels, Tabs, Text, Textarea, Tooltip, VStack, useBreakpointValue, useDisclosure, useToast } from '@chakra-ui/react'
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { issuesAPI, labelsAPI, prsAPI, releasesAPI, reposAPI, tasksAPI } from '../../api/index'
import { getLanguage, t, timeAgo } from '../../i18n/index'
import { LuCircleCheck as CheckCircle, LuCircleCheckBig as CheckCircle2, LuCircleX as XCircle, LuClipboardList as ClipboardList, LuClock as Clock, LuFile as FileIcon, LuFileCode as CodeIcon, LuFileDiff as FileDiff, LuFileText as FileText, LuGitBranch as GitBranch, LuGitPullRequest as GitPullRequest, LuImage as ImageIcon, LuLink as LinkIcon, LuLock as Lock, LuMessageSquare as MessageSquare, LuPaperclip as Paperclip, LuPencil as EditIcon, LuPlus as PlusIcon, LuRefreshCw as RefreshCw, LuRocket as Rocket, LuSettings as Settings, LuTrash2 as Trash2, LuTriangleAlert as AlertTriangle, LuTriangleAlert as TriangleAlert, LuUpload as Upload, LuUpload as UploadIcon, LuUser as User, LuWrench as Wrench, LuX as X } from 'react-icons/lu'
import MarkdownRenderer from '../../components/MarkdownRenderer'
import FileTable from '../../components/FileTable'
import { GitWorkflowProvider } from '../../contexts/GitWorkflowContext'
import WorkingPanel from '../../components/gitworkflow/working_panel'
import ConflictBanner from '../../components/gitworkflow/conflict_banner'
import { useAuth } from '../../contexts/AuthContext'
import StashPanel from '../../components/gitworkflow/stash_panel'
import CommitActionMenu from '../../components/gitworkflow/commit_action_menu'
import RebaseEditor from '../../components/gitworkflow/rebase_editor'
import SimpleEditor from '../../components/SimpleEditor'
import DateTimePicker from '../../components/DateTimePicker'
import SimpleRenderer from '../../components/SimpleRenderer'
import CommitDiffList from '../../components/gitworkflow/commit_diff_list'

// ─── FileViewer ───

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

function resolveImageUrl(src, owner, repo, filePath, ref) {
  if (!src) return src
  if (/^(https?:\/\/|\/\/|data:|\/)/.test(src)) return src
  var dir = filePath.substring(0, filePath.lastIndexOf('/'))
  var resolved = dir ? dir + '/' + src : src
  resolved = resolved.replace(/^\.\//, '')
  return getRawUrl(owner, repo, resolved, ref)
}

function renderMarkdown(text, owner, repo, filePath, ref) {
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
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(_, alt, src) {
    var url = resolveImageUrl(src, owner, repo, filePath, ref)
    return '<img src="' + url + '" alt="' + alt + '" style="max-width:100%;border-radius:6px" />'
  })
  html = html.replace(/<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, function(_, before, src, after) {
    var url = resolveImageUrl(src, owner, repo, filePath, ref)
    return '<img ' + before + 'src="' + url + '"' + after + '>'
  })
  html = html.replace(/<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi, function(_, before, href, after) {
    if (/^(https?:\/\/|\/\/|\/|#|mailto:)/.test(href)) {
      return '<a ' + before + 'href="' + href + '"' + after + '>'
    }
    var dir = filePath.substring(0, filePath.lastIndexOf('/'))
    var resolved = dir ? dir + '/' + href : href
    resolved = resolved.replace(/^\.\//, '')
    var treeUrl = '/' + owner + '/' + repo + '/tree/' + (ref && ref !== 'HEAD' ? ref + '/' : '') + resolved
    return '<a ' + before + 'href="' + treeUrl + '"' + after + '>'
  })
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, text, href) {
    if (/^(https?:\/\/|\/\/|\/|#|mailto:)/.test(href)) {
      return '<a href="' + href + '" style="color:#16a34a;text-decoration:underline">' + text + '</a>'
    }
    var dir = filePath.substring(0, filePath.lastIndexOf('/'))
    var resolved = dir ? dir + '/' + href : href
    // Remove leading ./ if present
    resolved = resolved.replace(/^\.\//, '')
    var treeUrl = '/' + owner + '/' + repo + '/tree/' + (ref && ref !== 'HEAD' ? ref + '/' : '') + resolved
    return '<a href="' + treeUrl + '" style="color:#16a34a;text-decoration:underline">' + text + '</a>'
  })
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
  const [hexContent, setHexContent] = useState('')
  const [hexTotalSize, setHexTotalSize] = useState(0)
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
    if (binary && !image) {
      setLoading(true)
      reposAPI.file(owner, repo, filePath, ref, true).then(function(data) {
        setHexContent(data.hex_content || '')
        setHexTotalSize(data.total_size || 0)
      }).catch(function(err) {
        setError(err.message || t('fileViewer.loadFailed'))
      }).finally(function() { setLoading(false) })
      return
    }
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
    var sizeStr = hexTotalSize > 0 ? (hexTotalSize >= 1024 ? (hexTotalSize / 1024).toFixed(1) + ' KB' : hexTotalSize + ' B') : ''
    return (
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
        <Flex align="center" justify="space-between" px="16px" py="10px" borderBottom="1px solid" borderColor="#f0f0f0">
          <HStack gap="8px">
            <Text fontSize="13px" color="#888">{t('fileViewer.binaryFile')}</Text>
            {sizeStr && <Text fontSize="12px" color="#aaa">{sizeStr}</Text>}
          </HStack>
          <Button h="26px" px="10px" fontSize="12px" rounded="4px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }}
            as="a" href={getRawUrl(owner, repo, filePath, ref)} target="_blank">
            {t('fileViewer.downloadFile')}
          </Button>
        </Flex>
        {hexContent && (
          <Box overflow="auto" maxH="70vh">
            <Box as="pre" fontSize="12px" fontFamily="'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace"
              lineHeight="1.5" m={0} p="8px 0" color="#333" bg="#fafafa">
              {hexContent.split('\n').map(function(line, idx) {
                return (
                  <Flex key={idx} px="16px" _hover={{ bg: '#f0fdf4' }} transition="background-color 0.1s">
                    <Text whiteSpace="pre" fontFamily="inherit" fontSize="inherit">{line || ' '}</Text>
                  </Flex>
                )
              })}
            </Box>
            {hexTotalSize > 8192 && (
              <Text fontSize="12px" color="#aaa" textAlign="center" py="8px">
                Showing first 8 KB of {sizeStr}
              </Text>
            )}
          </Box>
        )}
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
        sx={{ '& h1, & h2, & h3, & h4': { color: '#1a1a1a' }, '& a': { color: '#0969da' }, '& code': { fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace" } }}>
        <Flex pos="absolute" top="10px" right="12px" zIndex={2}>
          <Button h="26px" px="10px" fontSize="12px" rounded="4px" variant="outline"
            borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#22c55e', color: '#22c55e' }}
            onClick={function() { setShowSource(true) }}
            leftIcon={<CodeIcon size={12} />}>
            {t('fileViewer.viewSource')}
          </Button>
        </Flex>
        <MarkdownRenderer source={content} owner={owner} repo={repo} filePath={filePath} gitRef={ref} />
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




// ─── ProjectTree ───

const ProjectTree = () => {
  const { owner, repo } = useParams()
  const location = useLocation()
  const [readmePath, setReadmePath] = useState(null)
  const [readmeLoading, setReadmeLoading] = useState(false)
  const [refNames, setRefNames] = useState([])
  const [repoInfo, setRepoInfo] = useState(null)
  const [panelCollapsed, setPanelCollapsed] = useState(true)

  var basePath = '/' + owner + '/' + repo
  var path = location.pathname

  var pathAfterBase = path.replace(basePath, '')
  if (pathAfterBase.startsWith('/tree/')) {
    pathAfterBase = pathAfterBase.replace('/tree/', '')
  }
  if (pathAfterBase.startsWith('/tree')) {
    pathAfterBase = pathAfterBase.replace('/tree', '')
  }

  useEffect(function() {
    reposAPI.get(owner, repo).then(function(data) { setRepoInfo(data) }).catch(function() {})
  }, [owner, repo])

  useEffect(function() {
    Promise.all([
      reposAPI.branches(owner, repo).catch(function() { return [] }),
      reposAPI.tags(owner, repo).catch(function() { return [] }),
    ]).then(function([branchData, tagData]) {
      var branchList = Array.isArray(branchData && branchData.branches ? branchData.branches : branchData)
        ? (branchData.branches || branchData) : []
      var tagList = Array.isArray(tagData && tagData.tags ? tagData.tags : tagData)
        ? (tagData.tags || tagData) : []
      var names = []
        .concat(branchList.map(function(b) { return typeof b === 'string' ? b : (b.name || '') }))
        .concat(tagList.map(function(t) { return typeof t === 'string' ? t : (t.name || '') }))
      setRefNames(names)
    })
  }, [owner, repo])

  var parsed = useMemo(function() {
    if (!pathAfterBase) return { ref: '', filePath: '' }
    var firstSegment = pathAfterBase.split('/')[0]
    if (firstSegment === '__staged__' || firstSegment === '__working__') {
      return { ref: firstSegment, filePath: pathAfterBase.substring(firstSegment.length + 1) }
    }
    if (refNames.indexOf(firstSegment) >= 0) {
      return { ref: firstSegment, filePath: pathAfterBase.substring(firstSegment.length + 1) }
    }
    return { ref: '', filePath: pathAfterBase }
  }, [pathAfterBase, refNames])

  var hasExtension = parsed.filePath.lastIndexOf('.') > parsed.filePath.lastIndexOf('/')
  var isFile = hasExtension && parsed.filePath.length > 0
  var isDir = !isFile

  useEffect(() => {
    if (isFile) {
      setReadmePath(null)
      return
    }
    setReadmeLoading(true)
    var dirPath = parsed.filePath || ''
    var useRef = parsed.ref || 'HEAD'
    reposAPI.tree(owner, repo, dirPath, useRef).then(function(data) {
      var entries = data && Array.isArray(data.entries) ? data.entries : []
      var readme = entries.find(function(e) {
        var n = (e.name || '').toLowerCase()
        return n === 'readme.md' || n === 'readme' || n === 'readme.txt' || n === 'readme.markdown'
      })
      if (readme) {
        var fullPath = dirPath ? dirPath + '/' + readme.name : readme.name
        setReadmePath(fullPath)
      } else {
        setReadmePath(null)
      }
    }).catch(function() { setReadmePath(null) }).finally(function() { setReadmeLoading(false) })
  }, [owner, repo, parsed.filePath, parsed.ref, isFile])

  if (isFile) {
    return <FileViewer filePath={parsed.filePath} owner={owner} repo={repo} branchRef={parsed.ref || 'HEAD'} />
  }

  var hasLocalPath = repoInfo && repoInfo.local_path

  return (
    <GitWorkflowProvider owner={owner} repo={repo}>
      {hasLocalPath && <ConflictBanner />}
      <Flex gap="0" direction={{ base: 'column', md: 'row' }} position="relative">
          <Box flex={{ base: '1', md: hasLocalPath && !panelCollapsed ? '0 0 60%' : '1', lg: hasLocalPath && !panelCollapsed ? '0 0 60%' : '1' }} minW={0} overflow="hidden">
            <FileTable workingPanelToggle={hasLocalPath ? {
              collapsed: panelCollapsed,
              onToggle: function() { setPanelCollapsed(!panelCollapsed) },
            } : null} />
            {isDir && readmeLoading && (
              <Box display="flex" justifyContent="center" py="20px">
                <Spinner size="md" color="#22c55e" />
              </Box>
            )}
            {isDir && readmePath && !readmeLoading && (
              <Box mt="20px">
                <FileViewer filePath={readmePath} owner={owner} repo={repo} branchRef={parsed.ref || 'HEAD'} />
              </Box>
            )}
          </Box>
          {hasLocalPath && !panelCollapsed && (
            <Box flex={{ base: '1', md: '0 0 38%', lg: '0 0 38%' }} bg="white" border="1px solid" borderColor="#e5e7eb" rounded="8px" p="12px" maxH="80vh" overflowY="auto" ml="12px">
              <WorkingPanel />
            </Box>
          )}
        </Flex>
    </GitWorkflowProvider>
  )
}



// ─── ProjectIssues ───

var PAGE_SIZE = 30

function PaginationBar(_ref) {
  var page = _ref.page
  var totalPages = _ref.totalPages
  var onPageChange = _ref.onPageChange

  if (totalPages <= 1) return null

  var start = Math.floor((page - 1) / 5) * 5 + 1
  var end = Math.min(start + 4, totalPages)
  var pages = []
  for (var i = start; i <= end; i++) {
    pages.push(i)
  }

  return (
    <Flex justify="center" align="center" gap="6px" mt="16px">
      <Button h="28px" px="10px" fontSize="12px" rounded="6px"
        isDisabled={page <= 1}
        onClick={function() { onPageChange(page - 1) }}
        variant="outline" borderColor="#d1d5db">
        ‹
      </Button>
      {start > 1 && (
        <Button h="28px" px="10px" fontSize="12px" rounded="6px"
          variant="outline" borderColor="#d1d5db"
          onClick={function() { onPageChange(start - 1) }}>
          ...
        </Button>
      )}
      {pages.map(function(p) {
        return (
          <Button key={p} h="28px" px="12px" fontSize="12px" rounded="6px"
            bg={p === page ? '#22c55e' : 'transparent'}
            color={p === page ? 'white' : '#666'}
            variant={p === page ? 'solid' : 'outline'}
            borderColor={p === page ? '#22c55e' : '#d1d5db'}
            _hover={p === page ? { bg: '#16a34a' } : { bg: '#f9fafb' }}
            onClick={function() { onPageChange(p) }}>
            {p}
          </Button>
        )
      })}
      {end < totalPages && (
        <Button h="28px" px="10px" fontSize="12px" rounded="6px"
          variant="outline" borderColor="#d1d5db"
          onClick={function() { onPageChange(end + 1) }}>
          ...
        </Button>
      )}
      <Button h="28px" px="10px" fontSize="12px" rounded="6px"
        isDisabled={page >= totalPages}
        onClick={function() { onPageChange(page + 1) }}
        variant="outline" borderColor="#d1d5db">
        ›
      </Button>
    </Flex>
  )
}

var STATUS_TABS = [
  { key: 'open', label: '🟢 ' + t('issue.open') },
  { key: 'closed', label: '✅ ' + t('issue.closed') },
  { key: 'all', label: '📋 ' + t('common.all') },
]

const ProjectIssues = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const { isGuest } = useAuth()
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [openCount, setOpenCount] = useState(0)
  const [closedCount, setClosedCount] = useState(0)
  const [repoInfo, setRepoInfo] = useState(null)

  useEffect(function() {
    reposAPI.get(owner, repo).then(function(data) { setRepoInfo(data) }).catch(function() {})
  }, [owner, repo])

  useEffect(function() {
    setLoading(true)
    setPage(1)
  }, [statusFilter])

  useEffect(function() {
    setLoading(true)
    var params = { page: page, per_page: PAGE_SIZE }
    if (statusFilter !== 'all') params.state = statusFilter
    issuesAPI.list(owner, repo, params).then(function(res) {
      setIssues(Array.isArray(res.data) ? res.data : [])
      setTotal(res.total || 0)
    }).catch(function() {
      setIssues([])
      setTotal(0)
    }).finally(function() { setLoading(false) })
  }, [owner, repo, page, statusFilter])

  useEffect(function() {
    issuesAPI.list(owner, repo, { page: 1, per_page: 1, state: 'open' }).then(function(res) {
      setOpenCount(res.total || 0)
    }).catch(function() {})
    issuesAPI.list(owner, repo, { page: 1, per_page: 1, state: 'closed' }).then(function(res) {
      setClosedCount(res.total || 0)
    }).catch(function() {})
  }, [owner, repo])

  var totalPages = Math.ceil(total / PAGE_SIZE) || 1

  var filtered = issues.filter(function(i) {
    var matchSearch = i.title.toLowerCase().indexOf(search.toLowerCase()) >= 0
    if (!matchSearch) return false
    return true
  })

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb="16px">
        <HStack gap="4px" fontSize="13.5px" fontWeight="600">
          {STATUS_TABS.map(function(tab) {
            var isActive = statusFilter === tab.key
            return (
              <Button key={tab.key} h="30px" px="12px" fontSize="13px" rounded="6px" variant="ghost"
                color={isActive ? '#16a34a' : '#888'}
                bg={isActive ? '#f0fdf4' : 'transparent'}
                _hover={{ bg: isActive ? '#f0fdf4' : '#f9fafb', color: isActive ? '#16a34a' : '#333' }}
                onClick={function() { setStatusFilter(tab.key) }}>
                {tab.label} ({tab.key === 'all' ? (openCount + closedCount) : (tab.key === 'open' ? openCount : closedCount)})
              </Button>
            )
          })}
        </HStack>
        {repoInfo && repoInfo.project_type !== 'mirror' && (
        <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }}
          onClick={function() { navigate('/' + owner + '/' + repo + '/issues/new') }} isDisabled={isGuest}>
          {t('issue.newIssue')}
        </Button>
        )}
      </Flex>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="16px" mb="16px">
        <Input placeholder={t('issue.searchPlaceholder')} value={search} onChange={function(e) { setSearch(e.target.value) }}
          h="34px" fontSize="13.5px" borderRadius="8px" borderColor="#d1d5db"
          _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
      </Box>

      <VStack spacing="10px" align="stretch">
        {filtered.map(function(issue) {
          return (
            <Flex key={issue.id} direction="column" bg="white" border="1px solid" borderColor="#e2e2e2"
              rounded="8px" p="16px 20px" transition="all 0.15s"
              _hover={{ borderColor: '#d1d5db', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              cursor="pointer"
              onClick={function() { navigate('/' + owner + '/' + repo + '/issues/' + issue.number) }}>
              <Flex gap="8px" mb="4px" align="center">
                {issue.is_closed ? (
                  <Badge fontSize="11px" px="7px" py="1px" rounded="4px" bg="#fef2f2" color="#dc2626">{t('issue.closed')}</Badge>
                ) : (
                  <Badge fontSize="11px" px="7px" py="1px" rounded="4px" bg="#dcfce7" color="#16a34a">{t('issue.open')}</Badge>
                )}
                <Text fontSize="13.5px" fontWeight="600" color="#333">{issue.title}</Text>
              </Flex>
              <Text fontSize="12.5px" color="#888" noOfLines={1}>
                #{issue.number} {t('common.by')} {issue.author || t('common.unknown')} {t('common.createdAt')} {timeAgo(issue.created_at)}
                {issue.comments_count > 0 && ' · 💬 ' + issue.comments_count}
              </Text>
            </Flex>
          )
        })}
      </VStack>

      <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />

      {!loading && filtered.length === 0 && (
        <Box textAlign="center" py="50px" color="#aaa">
          <Text fontSize="36px" mb="6px">⚠️</Text>
          <Text fontSize="14px">{t('issue.noIssues')}</Text>
        </Box>
      )}
    </Box>
  )
}



// ─── ProjectPRs ───

var PAGE_SIZE_ProjectPRs = 30

function PaginationBar_ProjectPRs(_ref) {
  var page = _ref.page
  var totalPages = _ref.totalPages
  var onPageChange = _ref.onPageChange

  if (totalPages <= 1) return null

  var start = Math.floor((page - 1) / 5) * 5 + 1
  var end = Math.min(start + 4, totalPages)
  var pages = []
  for (var i = start; i <= end; i++) {
    pages.push(i)
  }

  return (
    <Flex justify="center" align="center" gap="6px" mt="16px">
      <Button h="28px" px="10px" fontSize="12px" rounded="6px"
        isDisabled={page <= 1}
        onClick={function() { onPageChange(page - 1) }}
        variant="outline" borderColor="#d1d5db">
        ‹
      </Button>
      {start > 1 && (
        <Button h="28px" px="10px" fontSize="12px" rounded="6px"
          variant="outline" borderColor="#d1d5db"
          onClick={function() { onPageChange(start - 1) }}>
          ...
        </Button>
      )}
      {pages.map(function(p) {
        return (
          <Button key={p} h="28px" px="12px" fontSize="12px" rounded="6px"
            bg={p === page ? '#22c55e' : 'transparent'}
            color={p === page ? 'white' : '#666'}
            variant={p === page ? 'solid' : 'outline'}
            borderColor={p === page ? '#22c55e' : '#d1d5db'}
            _hover={p === page ? { bg: '#16a34a' } : { bg: '#f9fafb' }}
            onClick={function() { onPageChange(p) }}>
            {p}
          </Button>
        )
      })}
      {end < totalPages && (
        <Button h="28px" px="10px" fontSize="12px" rounded="6px"
          variant="outline" borderColor="#d1d5db"
          onClick={function() { onPageChange(end + 1) }}>
          ...
        </Button>
      )}
      <Button h="28px" px="10px" fontSize="12px" rounded="6px"
        isDisabled={page >= totalPages}
        onClick={function() { onPageChange(page + 1) }}
        variant="outline" borderColor="#d1d5db">
        ›
      </Button>
    </Flex>
  )
}

var STATUS_MAP = {
  open: { bg: '#dcfce7', color: '#16a34a' },
  closed: { bg: '#fef2f2', color: '#dc2626' },
}

var STATUS_TABS_ProjectPRs = [
  { key: 'open', label: '🟢 ' + t('pr.open') },
  { key: 'closed', label: '✅ ' + t('pr.closed') },
  { key: 'all', label: '📋 ' + t('common.all') },
]

const ProjectPRs = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const { isGuest } = useAuth()
  const [prs, setPrs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [openCount, setOpenCount] = useState(0)
  const [closedCount, setClosedCount] = useState(0)
  const [repoInfo, setRepoInfo] = useState(null)

  useEffect(function() {
    reposAPI.get(owner, repo).then(function(data) { setRepoInfo(data) }).catch(function() {})
  }, [owner, repo])

  useEffect(function() {
    setLoading(true)
    setPage(1)
  }, [statusFilter])

  useEffect(function() {
    setLoading(true)
    var params = { page: page, per_page: PAGE_SIZE_ProjectPRs }
    if (statusFilter !== 'all') params.state = statusFilter
    prsAPI.list(owner, repo, params).then(function(res) {
      setPrs(Array.isArray(res.data) ? res.data : [])
      setTotal(res.total || 0)
      if (statusFilter === 'open') setOpenCount(res.total || 0)
      if (statusFilter === 'closed') setClosedCount(res.total || 0)
    }).catch(function() {
      setPrs([])
      setTotal(0)
    }).finally(function() { setLoading(false) })
  }, [owner, repo, page, statusFilter])

  useEffect(function() {
    prsAPI.list(owner, repo, { page: 1, per_page: 1, state: 'open' }).then(function(res) {
      setOpenCount(res.total || 0)
    }).catch(function() {})
    prsAPI.list(owner, repo, { page: 1, per_page: 1, state: 'closed' }).then(function(res) {
      setClosedCount(res.total || 0)
    }).catch(function() {})
  }, [owner, repo])

  var totalPages = Math.ceil(total / PAGE_SIZE_ProjectPRs) || 1

  var filtered = prs.filter(function(pr) {
    var matchSearch = pr.title.toLowerCase().indexOf(search.toLowerCase()) >= 0
    if (!matchSearch) return false
    return true
  })

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb="16px">
        <HStack gap="4px" fontSize="13.5px" fontWeight="600">
          {STATUS_TABS_ProjectPRs.map(function(tab) {
            var isActive = statusFilter === tab.key
            return (
              <Button key={tab.key} h="30px" px="12px" fontSize="13px" rounded="6px" variant="ghost"
                color={isActive ? '#16a34a' : '#888'}
                bg={isActive ? '#f0fdf4' : 'transparent'}
                _hover={{ bg: isActive ? '#f0fdf4' : '#f9fafb', color: isActive ? '#16a34a' : '#333' }}
                onClick={function() { setStatusFilter(tab.key) }}>
                {tab.label} ({tab.key === 'all' ? (openCount + closedCount) : (tab.key === 'open' ? openCount : closedCount)})
              </Button>
            )
          })}
        </HStack>
        {repoInfo && repoInfo.project_type !== 'mirror' && (
        <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }}
          onClick={function() { navigate('/' + owner + '/' + repo + '/pull_requests/new') }} isDisabled={isGuest}>
          {t('pr.newPR')}
        </Button>
        )}
      </Flex>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="16px" mb="16px">
        <Input placeholder={t('pr.searchPlaceholder')} value={search} onChange={function(e) { setSearch(e.target.value) }}
          h="34px" fontSize="13.5px" borderRadius="8px" borderColor="#d1d5db"
          _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
      </Box>

      <VStack spacing="10px" align="stretch">
        {filtered.map(function(pr) {
          var status = pr.is_closed ? 'closed' : 'open'
          var cfg = STATUS_MAP[status] || STATUS_MAP.open
          var statusLabel = status === 'closed' ? t('pr.closed') : t('pr.open')
          return (
            <Flex key={pr.id} direction="column" bg="white" border="1px solid" borderColor="#e2e2e2"
              rounded="8px" p="16px 20px" transition="all 0.15s"
              _hover={{ borderColor: '#d1d5db', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              cursor="pointer"
              onClick={function() { navigate('/' + owner + '/' + repo + '/pull_requests/' + pr.number) }}>
              <Flex gap="8px" mb="4px" align="center">
                <Badge fontSize="11px" px="7px" py="1px" rounded="4px" bg={cfg.bg} color={cfg.color}>
                  {statusLabel}
                </Badge>
                <Text fontSize="13.5px" fontWeight="600" color="#333">{pr.title}</Text>
              </Flex>
              <Text fontSize="12.5px" color="#888" noOfLines={1}>
                #{pr.number} {t('common.by')} {pr.author || t('common.unknown')}
                {' '}<Text as="span" color="#16a34a">{pr.source_branch}</Text> → <Text as="span" color="#dc2626">{pr.target_branch}</Text>
                {' · '}{timeAgo(pr.updated_at)}
                {pr.comments_count > 0 && ' · 💬 ' + pr.comments_count}
              </Text>
            </Flex>
          )
        })}
      </VStack>

      <PaginationBar_ProjectPRs page={page} totalPages={totalPages} onPageChange={setPage} />

      {!loading && filtered.length === 0 && (
        <Box textAlign="center" py="50px" color="#aaa">
          <Text fontSize="36px" mb="6px">🔀</Text>
          <Text fontSize="14px">{t('pr.noPRs')}</Text>
        </Box>
      )}
    </Box>
  )
}



// ─── ProjectCommits ───

function shortHash(hash) {
  return hash ? hash.substring(0, 7) : ''
}

var LANE_COLORS = [
  '#e74c3c', '#2ecc71', '#3498db', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#e91e63',
  '#00bcd4', '#8bc34a', '#ff5722', '#607d8b',
  '#795548', '#cddc39', '#ff9800', '#673ab7',
]

var ROW_H = 32

function getLaneColor(laneIndex) {
  return LANE_COLORS[laneIndex % LANE_COLORS.length]
}

function computeGraphLayout(commits) {
  if (!commits || commits.length === 0) return null

  var commitLanes = {}
  var commitFlows = {}
  var maxLane = 0
  var activeLanes = []
  var hashToLane = {}
  var lanesAbove = []
  var lanesBelow = []

  function findLaneForHash(hash) {
    if (hash in hashToLane) return hashToLane[hash]
    return -1
  }

  function findAvailableLane() {
    for (var i = 0; i < activeLanes.length; i++) {
      if (activeLanes[i] === null) return i
    }
    activeLanes.push(null)
    if (activeLanes.length - 1 > maxLane) maxLane = activeLanes.length - 1
    return activeLanes.length - 1
  }

  function setLane(lane, hash) {
    while (activeLanes.length <= lane) {
      activeLanes.push(null)
      if (activeLanes.length - 1 > maxLane) maxLane = activeLanes.length - 1
    }
    if (hash in hashToLane && hashToLane[hash] !== lane) {
      var oldLane = hashToLane[hash]
      if (oldLane < activeLanes.length && activeLanes[oldLane] === hash) {
        activeLanes[oldLane] = null
      }
    }
    activeLanes[lane] = hash
    hashToLane[hash] = lane
  }

  function clearLane(lane) {
    if (lane < activeLanes.length && activeLanes[lane] !== null) {
      var oldHash = activeLanes[lane]
      if (hashToLane[oldHash] === lane) {
        delete hashToLane[oldHash]
      }
      activeLanes[lane] = null
    }
  }

  function snapshotActive() {
    var s = new Set()
    for (var i = 0; i < activeLanes.length; i++) {
      if (activeLanes[i] !== null) s.add(i)
    }
    return s
  }

  for (var i = 0; i < commits.length; i++) {
    lanesAbove[i] = snapshotActive()

    var commit = commits[i]
    var hash = commit.hash
    var parents = commit.parents || []

    var myLane = findLaneForHash(hash)
    if (myLane === -1) {
      myLane = findAvailableLane()
    }

    commitLanes[hash] = myLane

    var flows = []

    if (parents.length === 0) {
      clearLane(myLane)
      commitFlows[hash] = flows
      lanesBelow[i] = snapshotActive()
      continue
    }

    var firstParent = parents[0]
    setLane(myLane, firstParent)
    flows.push({ fromLane: myLane, toLane: myLane, type: 'straight' })

    for (var p = 1; p < parents.length; p++) {
      var parentHash = parents[p]
      var existingLane = findLaneForHash(parentHash)

      if (existingLane !== -1) {
        flows.push({ fromLane: myLane, toLane: existingLane, type: 'merge' })
      } else {
        var newLane = findAvailableLane()
        setLane(newLane, parentHash)
        flows.push({ fromLane: myLane, toLane: newLane, type: 'branch' })
      }
    }

    commitFlows[hash] = flows
    lanesBelow[i] = snapshotActive()
  }

  var laneCount = maxLane + 1
  var laneColorsMap = {}
  for (var l = 0; l < laneCount; l++) {
    laneColorsMap[l] = getLaneColor(l)
  }

  return { commitLanes: commitLanes, commitFlows: commitFlows, laneCount: laneCount, laneColors: laneColorsMap, lanesAbove: lanesAbove, lanesBelow: lanesBelow }
}

function renderFullGraph(layout, commits) {
  if (!layout || commits.length === 0) return null

  var commitLanes = layout.commitLanes
  var commitFlows = layout.commitFlows
  var laneCount = layout.laneCount
  var laneColors = layout.laneColors
  var lanesAbove = layout.lanesAbove
  var lanesBelow = layout.lanesBelow

  var LANE_W = 18
  var NODE_R = 3
  var LINE_W = 1.8
  var PAD_X = 4
  var totalWidth = Math.max(laneCount, 1) * LANE_W + PAD_X * 2
  var totalHeight = commits.length * ROW_H

  var allPaths = []
  var allCircles = []

  for (var idx = 0; idx < commits.length; idx++) {
    var commit = commits[idx]
    var hash = commit.hash
    var myLane = commitLanes[hash] || 0
    var myX = myLane * LANE_W + LANE_W / 2 + PAD_X
    var myY = idx * ROW_H + ROW_H / 2
    var color = laneColors[myLane]

    var above = lanesAbove[idx]
    var below = lanesBelow[idx]
    var rowTop = idx * ROW_H
    var rowBot = (idx + 1) * ROW_H

    if (above.has(myLane)) {
      allPaths.push({ d: 'M ' + myX + ' ' + rowTop + ' L ' + myX + ' ' + (myY - NODE_R), color: color })
    }

    var flows = commitFlows[hash] || []
    var flowTargetLanes = new Set()

    for (var fi = 0; fi < flows.length; fi++) {
      var flow = flows[fi]
      var toX = flow.toLane * LANE_W + LANE_W / 2 + PAD_X
      var toColor = laneColors[flow.toLane]
      flowTargetLanes.add(flow.toLane)

      if (flow.type === 'straight') {
        allPaths.push({ d: 'M ' + myX + ' ' + (myY + NODE_R) + ' L ' + myX + ' ' + rowBot, color: toColor })
      } else {
        var cp1y = myY + (rowBot - myY) * 0.4
        var cp2y = rowBot - (rowBot - myY) * 0.4
        allPaths.push({ d: 'M ' + myX + ' ' + (myY + NODE_R) + ' C ' + myX + ' ' + cp1y + ', ' + toX + ' ' + cp2y + ', ' + toX + ' ' + rowBot, color: toColor })
      }
    }

    var handledLanes = new Set([myLane])
    flowTargetLanes.forEach(function(l) { handledLanes.add(l) })

    above.forEach(function(lane) {
      if (handledLanes.has(lane)) return
      var lx = lane * LANE_W + LANE_W / 2 + PAD_X
      var lColor = laneColors[lane]

      if (below.has(lane)) {
        allPaths.push({ d: 'M ' + lx + ' ' + rowTop + ' L ' + lx + ' ' + rowBot, color: lColor })
      } else {
        allPaths.push({ d: 'M ' + lx + ' ' + rowTop + ' L ' + lx + ' ' + (myY - NODE_R), color: lColor })
        var cp1y2 = (myY - NODE_R) + (myY - (myY - NODE_R)) * 0.5
        allPaths.push({ d: 'M ' + lx + ' ' + (myY - NODE_R) + ' C ' + lx + ' ' + cp1y2 + ', ' + myX + ' ' + (myY - NODE_R - 2) + ', ' + myX + ' ' + (myY - NODE_R), color: lColor })
      }
    })

    allCircles.push({ cx: myX, cy: myY, r: NODE_R + 1, fill: '#1a1a2e' })
    allCircles.push({ cx: myX, cy: myY, r: NODE_R, fill: color, stroke: '#fff', strokeWidth: 1.2 })
  }

  return React.createElement('svg', {
    width: totalWidth, height: totalHeight,
    viewBox: '0 0 ' + totalWidth + ' ' + totalHeight,
    style: { display: 'block' },
  },
    allPaths.map(function(p, pi) {
      return React.createElement('path', {
        key: 'p' + pi, d: p.d,
        stroke: p.color, strokeWidth: LINE_W,
        fill: 'none', strokeLinecap: 'round',
      })
    }),
    allCircles.map(function(c, ci) {
      return React.createElement('circle', {
        key: 'c' + ci, cx: c.cx, cy: c.cy, r: c.r,
        fill: c.fill, stroke: c.stroke || 'none', strokeWidth: c.strokeWidth || 0,
      })
    })
  )
}

var PAGE_SIZE_ProjectCommits = 5

function PaginationBar_ProjectCommits(_ref) {
  var page = _ref.page
  var totalPages = _ref.totalPages
  var onPageChange = _ref.onPageChange

  if (totalPages <= 1) return null

  var start = Math.floor((page - 1) / PAGE_SIZE_ProjectCommits) * PAGE_SIZE_ProjectCommits + 1
  var end = Math.min(start + PAGE_SIZE_ProjectCommits - 1, totalPages)
  var pages = []
  for (var i = start; i <= end; i++) {
    pages.push(i)
  }

  return (
    <Flex justify="center" align="center" gap="6px" mt="16px">
      <Button h="28px" px="10px" fontSize="12px" rounded="6px"
        isDisabled={page <= 1}
        onClick={function() { onPageChange(page - 1) }}
        variant="outline" borderColor="#d1d5db">
        &lsaquo;
      </Button>
      {start > 1 && (
        <Button h="28px" px="10px" fontSize="12px" rounded="6px"
          variant="outline" borderColor="#d1d5db"
          onClick={function() { onPageChange(start - 1) }}>
          ...
        </Button>
      )}
      {pages.map(function(p) {
        return (
          <Button key={p} h="28px" px="12px" fontSize="12px" rounded="6px"
            bg={p === page ? '#22c55e' : 'transparent'}
            color={p === page ? 'white' : '#666'}
            variant={p === page ? 'solid' : 'outline'}
            borderColor={p === page ? '#22c55e' : '#d1d5db'}
            _hover={p === page ? { bg: '#16a34a' } : { bg: '#f9fafb' }}
            onClick={function() { onPageChange(p) }}>
            {p}
          </Button>
        )
      })}
      {end < totalPages && (
        <Button h="28px" px="10px" fontSize="12px" rounded="6px"
          variant="outline" borderColor="#d1d5db"
          onClick={function() { onPageChange(end + 1) }}>
          ...
        </Button>
      )}
      <Button h="28px" px="10px" fontSize="12px" rounded="6px"
        isDisabled={page >= totalPages}
        onClick={function() { onPageChange(page + 1) }}
        variant="outline" borderColor="#d1d5db">
        &rsaquo;
      </Button>
    </Flex>
  )
}

var ProjectCommits = function() {
  var params = useParams()
  var owner = params.owner
  var repo = params.repo
  var navigate = useNavigate()
  var toast = useToast()
  var isGuest = useAuth().isGuest

  var _useState = useState([])
  var commits = _useState[0]
  var setCommits = _useState[1]

  var _useState2 = useState(true)
  var loading = _useState2[0]
  var setLoading = _useState2[1]

  var _useState3 = useState(1)
  var page = _useState3[0]
  var setPage = _useState3[1]

  var _useState4 = useState(0)
  var total = _useState4[0]
  var setTotal = _useState4[1]

  var _useState6 = useState('__all__')
  var selectedBranch = _useState6[0]
  var setSelectedBranch = _useState6[1]

  var _useState7 = useState([])
  var branches = _useState7[0]
  var setBranches = _useState7[1]

  var _useState8 = useState([])
  var tags = _useState8[0]
  var setTags = _useState8[1]

  var _useState9 = useState(null)
  var repoInfo = _useState9[0]
  var setRepoInfo = _useState9[1]

  var _useState10 = useState(false)
  var pulling = _useState10[0]
  var setPulling = _useState10[1]

  // Commit operation mode: null / 'revert' / 'reset' / 'rebase'
  var _useState11 = useState(null)
  var opMode = _useState11[0]
  var setOpMode = _useState11[1]

  var _useState12 = useState(null)
  var selectFrom = _useState12[0]
  var setSelectFrom = _useState12[1]

  var _useState13 = useState(null)
  var selectTo = _useState13[0]
  var setSelectTo = _useState13[1]

  var _useState14 = useState(false)
  var operating = _useState14[0]
  var setOperating = _useState14[1]

  // Reset count
  var _useState20 = useState(1)
  var resetCount = _useState20[0]
  var setResetCount = _useState20[1]

  // Conflict state
  var _useState21 = useState(null)
  var conflictInfo = _useState21[0]
  var setConflictInfo = _useState21[1]

  // Tag modal
  var tagModal = useDisclosure()
  var _useState15 = useState('')
  var newTagName = _useState15[0]
  var setNewTagName = _useState15[1]

  var _useState16 = useState('')
  var newTagBranch = _useState16[0]
  var setNewTagBranch = _useState16[1]

  var _useState17 = useState(false)
  var creatingTag = _useState17[0]
  var setCreatingTag = _useState17[1]

  // Default branch modal
  var branchModal = useDisclosure()
  var _useState18 = useState('')
  var defaultBranchInput = _useState18[0]
  var setDefaultBranchInput = _useState18[1]

  var _useState19 = useState(false)
  var settingBranch = _useState19[0]
  var setSettingBranch = _useState19[1]

  var rebaseEditor = useDisclosure()
  var createBranchModal = useDisclosure()
  var mergeBranchModal = useDisclosure()

  var _useState22 = useState('')
  var newBranchName = _useState22[0]
  var setNewBranchName = _useState22[1]

  var _useState23 = useState('')
  var mergeSource = _useState23[0]
  var setMergeSource = _useState23[1]

  var hasLocalPath = repoInfo && repoInfo.local_path

  // Check git status for conflicts on mount
  useEffect(function() {
    if (!hasLocalPath) return
    reposAPI.getGitStatus(owner, repo).then(function(data) {
      if (data.rebasing || data.reverting || data.merging) {
        var opType = data.rebasing ? 'rebase' : data.reverting ? 'revert' : 'merge'
        setConflictInfo({ type: opType, active: true })
      }
    }).catch(function() {})
  }, [owner, repo, hasLocalPath])

  // Load repo info
  useEffect(function() {
    reposAPI.get(owner, repo).then(function(data) {
      setRepoInfo(data)
    }).catch(function() {})
  }, [owner, repo])

  // Load branches and tags
  useEffect(function() {
    reposAPI.branches(owner, repo).then(function(data) {
      var list = data.branches || []
      setBranches(list)
    }).catch(function() { setBranches([]) })

    reposAPI.tags(owner, repo).then(function(data) {
      setTags(data.tags || [])
    }).catch(function() { setTags([]) })
  }, [owner, repo])

  // Load commits
  useEffect(function() {
    setLoading(true)
    var params = { page: page, per_page: 30 }
    if (selectedBranch && selectedBranch !== '__all__') {
      params.ref = selectedBranch
      params.all = 'false'
    } else {
      params.all = 'true'
    }
    reposAPI.commits(owner, repo, params).then(function(data) {
      var list = Array.isArray(data && data.commits ? data.commits : data) ? (data.commits || data) : []
      setCommits(list)
      setTotal(data && data.total ? data.total : 0)
    }).catch(function() { setCommits([]) }).finally(function() { setLoading(false) })
  }, [owner, repo, page, selectedBranch])

  // Reset operation mode when branch changes
  useEffect(function() {
    setOpMode(null)
    setSelectFrom(null)
    setSelectTo(null)
  }, [selectedBranch])

  var graphLayout = useMemo(function() {
    if (selectedBranch !== '__all__' || commits.length === 0) return null
    return computeGraphLayout(commits)
  }, [commits, selectedBranch])

  var graphSVG = useMemo(function() {
    if (!graphLayout) return null
    return renderFullGraph(graphLayout, commits)
  }, [graphLayout, commits])

  var graphWidth = graphLayout ? Math.max(graphLayout.laneCount, 1) * 18 + 8 : 0
  var totalPages = Math.ceil(total / 30) || 1

  var handlePull = useCallback(function() {
    setPulling(true)
    reposAPI.syncPull(owner, repo).then(function() {
      toast({ title: t('projectSettings.pullCodeStarted'), status: 'success', duration: 3000 })
    }).catch(function(err) {
      toast({ title: err.message || t('projectSettings.syncFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setPulling(false) })
  }, [owner, repo, toast])

  var handleCreateTag = useCallback(function() {
    if (!newTagName.trim()) return
    setCreatingTag(true)
    reposAPI.createTag(owner, repo, newTagName.trim(), newTagBranch || (repoInfo && repoInfo.default_branch) || 'main').then(function() {
      toast({ title: 'Tag created: ' + newTagName, status: 'success', duration: 3000 })
      setNewTagName('')
      setNewTagBranch('')
      tagModal.onClose()
      return reposAPI.tags(owner, repo)
    }).then(function(data) {
      setTags(data.tags || [])
    }).catch(function(err) {
      toast({ title: err.message || 'Failed to create tag', status: 'error', duration: 3000 })
    }).finally(function() { setCreatingTag(false) })
  }, [owner, repo, newTagName, newTagBranch, repoInfo, tagModal, toast])

  var handleDeleteTag = useCallback(function(tagName) {
    if (!confirm('Delete tag "' + tagName + '"?')) return
    reposAPI.deleteTag(owner, repo, tagName).then(function() {
      toast({ title: 'Tag deleted: ' + tagName, status: 'success', duration: 3000 })
      return reposAPI.tags(owner, repo)
    }).then(function(data) {
      setTags(data.tags || [])
    }).catch(function(err) {
      toast({ title: err.message || 'Failed to delete tag', status: 'error', duration: 3000 })
    })
  }, [owner, repo, toast])

  var handleSetDefaultBranch = useCallback(function() {
    if (!defaultBranchInput.trim()) return
    setSettingBranch(true)
    reposAPI.setDefaultBranch(owner, repo, defaultBranchInput.trim()).then(function() {
      toast({ title: 'Default branch set to: ' + defaultBranchInput, status: 'success', duration: 3000 })
      setSelectedBranch(defaultBranchInput.trim())
      setRepoInfo(function(prev) { return prev ? Object.assign({}, prev, { default_branch: defaultBranchInput.trim() }) : prev })
      branchModal.onClose()
    }).catch(function(err) {
      toast({ title: err.message || 'Failed to set default branch', status: 'error', duration: 3000 })
    }).finally(function() { setSettingBranch(false) })
  }, [owner, repo, defaultBranchInput, branchModal, toast])

  var handleDeleteCommits = useCallback(function() {
    if (!selectFrom || !selectTo) return
    if (!confirm(t('projectCommits.confirmRebase', { from: shortHash(selectFrom), to: shortHash(selectTo) }))) return
    setOperating(true)
    reposAPI.deleteCommitRange(owner, repo, selectFrom, selectTo).then(function() {
      toast({ title: t('projectCommits.rebaseSuccess'), status: 'success', duration: 3000 })
      setOpMode(null)
      setSelectFrom(null)
      setSelectTo(null)
      setPage(1)
    }).catch(function(err) {
      var msg = err.message || t('projectCommits.operationFailed')
      if (msg.indexOf('CONFLICT') !== -1) {
        setConflictInfo({ type: 'rebase', active: true, message: msg })
      }
      toast({ title: msg, status: 'error', duration: 5000 })
    }).finally(function() { setOperating(false) })
  }, [owner, repo, selectFrom, selectTo, toast])

  var handleRevertCommit = useCallback(function(sha) {
    if (!confirm(t('projectCommits.confirmRevert', { sha: shortHash(sha) }))) return
    setOperating(true)
    reposAPI.revertCommit(owner, repo, sha).then(function() {
      toast({ title: t('projectCommits.revertSuccess'), status: 'success', duration: 3000 })
      setOpMode(null)
      setPage(1)
    }).catch(function(err) {
      var msg = err.message || t('projectCommits.operationFailed')
      if (msg.indexOf('CONFLICT') !== -1) {
        setConflictInfo({ type: 'revert', active: true, message: msg })
      }
      toast({ title: msg, status: 'error', duration: 5000 })
    }).finally(function() { setOperating(false) })
  }, [owner, repo, toast])

  var handleResetCommits = useCallback(function() {
    if (resetCount <= 0) return
    if (!confirm(t('projectCommits.confirmReset', { count: resetCount }))) return
    setOperating(true)
    reposAPI.resetCommits(owner, repo, resetCount).then(function() {
      toast({ title: t('projectCommits.resetSuccess'), status: 'success', duration: 3000 })
      setOpMode(null)
      setResetCount(1)
      setPage(1)
    }).catch(function(err) {
      toast({ title: err.message || t('projectCommits.operationFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setOperating(false) })
  }, [owner, repo, resetCount, toast])

  var handleAbort = useCallback(function() {
    if (!conflictInfo) return
    setOperating(true)
    reposAPI.abortOperation(owner, repo, conflictInfo.type).then(function() {
      toast({ title: t('projectCommits.abortSuccess'), status: 'success', duration: 3000 })
      setConflictInfo(null)
      setPage(1)
    }).catch(function(err) {
      toast({ title: err.message || t('projectCommits.operationFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setOperating(false) })
  }, [owner, repo, conflictInfo, toast])

  var handleCommitClick = useCallback(function(hash) {
    // 全部分支模式下直接导航到详情
    if (selectedBranch === '__all__') {
      navigate('/' + owner + '/' + repo + '/commits/' + hash)
      return
    }
    if (opMode === 'revert') {
      handleRevertCommit(hash)
      return
    }
    if (opMode === 'rebase') {
      if (!selectFrom) {
        setSelectFrom(hash)
      } else if (!selectTo) {
        var fromIdx = commits.findIndex(function(c) { return (c.hash || c.sha || c.id) === selectFrom })
        var toIdx = commits.findIndex(function(c) { return (c.hash || c.sha || c.id) === hash })
        if (fromIdx <= toIdx) {
          setSelectTo(hash)
        } else {
          setSelectTo(selectFrom)
          setSelectFrom(hash)
        }
      } else {
        setSelectFrom(hash)
        setSelectTo(null)
      }
      return
    }
    navigate('/' + owner + '/' + repo + '/commits/' + hash)
  }, [selectedBranch, opMode, selectFrom, selectTo, commits, owner, repo, navigate, handleRevertCommit])

  var isSelected = useCallback(function(hash) {
    return hash === selectFrom || hash === selectTo
  }, [selectFrom, selectTo])

  var isInSelectedRange = useCallback(function(hash) {
    if (!selectFrom || !selectTo) return false
    var fromIdx = commits.findIndex(function(c) { return (c.hash || c.sha || c.id) === selectFrom })
    var toIdx = commits.findIndex(function(c) { return (c.hash || c.sha || c.id) === selectTo })
    var idx = commits.findIndex(function(c) { return (c.hash || c.sha || c.id) === hash })
    return idx >= fromIdx && idx <= toIdx
  }, [selectFrom, selectTo, commits])

  if (loading && commits.length === 0) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  return (
    <GitWorkflowProvider owner={owner} repo={repo}>
      <>
        {hasLocalPath && <ConflictBanner />}
      {/* Toolbar */}
      <Flex justify="space-between" align="center" mb="12px" flexWrap="wrap" gap="8px">
        <HStack gap="12px" fontSize="14px" fontWeight="600">
          <Text color="#333">{t('projectCommits.title')}</Text>
        </HStack>
        <HStack gap="8px" flexWrap="wrap">
          {hasLocalPath && opMode && (
            <Button h="28px" px="10px" fontSize="11px" rounded="6px"
              variant="outline" borderColor="#aaa" color="#666"
              _hover={{ bg: '#f5f5f5' }}
              onClick={function() { setOpMode(null); setSelectFrom(null); setSelectTo(null); setResetCount(1) }}>
              {t('projectCommits.cancelOp')}
            </Button>
          )}
        </HStack>
      </Flex>

      {/* Branch selector + Commit ops + Branch ops + Total count */}
      <Flex mb="12px" gap="8px" align="center" flexWrap="wrap">
        <Select h="30px" fontSize="12px" w="180px" borderRadius="6px"
          value={selectedBranch}
          onChange={function(e) { setSelectedBranch(e.target.value); setPage(1) }}>
          <option value="__all__">{t('projectCommits.allBranches')}</option>
          {branches.map(function(b) {
            var name = b.replace(/^remotes\/origin\//, '')
            return <option key={b} value={name}>{name}{repoInfo && repoInfo.default_branch === name ? ' (' + t('projectBranches.default') + ')' : ''}</option>
          })}
        </Select>

        {hasLocalPath && selectedBranch !== '__all__' && !conflictInfo && !isGuest && (
          <Menu>
            <MenuButton h="28px" px="12px" fontSize="12px" rounded="6px"
              as={Button} variant="outline" borderColor="#ef4444" color="#ef4444"
              _hover={{ bg: '#fef2f2' }}
              isActive={!!opMode}>
              {opMode ? t('projectCommits.cancelOp') : t('projectCommits.commitOps')}
            </MenuButton>
            <MenuList minW="140px" fontSize="12px">
              <MenuItem onClick={function() { setOpMode(opMode === 'revert' ? null : 'revert'); setSelectFrom(null); setSelectTo(null) }}
                bg={opMode === 'revert' ? '#fef2f2' : undefined}
                fontWeight={opMode === 'revert' ? '600' : '400'}>
                {opMode === 'revert' ? '✓ ' : ''}{t('projectCommits.revert')}
              </MenuItem>
              <MenuItem onClick={function() { setOpMode(opMode === 'reset' ? null : 'reset'); setSelectFrom(null); setSelectTo(null) }}
                bg={opMode === 'reset' ? '#fef2f2' : undefined}
                fontWeight={opMode === 'reset' ? '600' : '400'}>
                {opMode === 'reset' ? '✓ ' : ''}{t('projectCommits.reset')}
              </MenuItem>
              <MenuItem onClick={function() { setOpMode(opMode === 'rebase' ? null : 'rebase'); setSelectFrom(null); setSelectTo(null) }}
                bg={opMode === 'rebase' ? '#fef2f2' : undefined}
                fontWeight={opMode === 'rebase' ? '600' : '400'}>
                {opMode === 'rebase' ? '✓ ' : ''}{t('projectCommits.rebase')}
              </MenuItem>
            </MenuList>
          </Menu>
        )}

        {hasLocalPath && !isGuest && (
          <Menu>
            <MenuButton h="28px" px="12px" fontSize="12px" rounded="6px"
              as={Button} variant="outline" borderColor="#8b5cf6" color="#7c3aed"
              _hover={{ bg: '#f5f3ff' }}>
              {t('gitWorkflow.branchOps')}
            </MenuButton>
            <MenuList minW="160px" fontSize="12px">
              <MenuItem onClick={function() {
                setDefaultBranchInput((repoInfo && repoInfo.default_branch) || 'main')
                branchModal.onOpen()
              }}>
                📌 {t('projectCommits.setDefaultBranch')}
              </MenuItem>
              <MenuItem onClick={function() {
                reposAPI.checkout(owner, repo, selectedBranch !== '__all__' ? selectedBranch : (repoInfo && repoInfo.default_branch) || 'main').then(function() {
                  toast({ title: t('gitWorkflow.switchSuccess', { branch: selectedBranch }), status: 'success', duration: 3000 })
                }).catch(function(err) { toast({ title: err.message || t('gitWorkflow.switchFailed'), status: 'error', duration: 5000 }) })
              }} isDisabled={selectedBranch === '__all__'}>
                🔀 {t('gitWorkflow.checkoutCurrent')}
              </MenuItem>
              <MenuItem onClick={function() { setNewBranchName(''); createBranchModal.onOpen() }}>
                + {t('gitWorkflow.createBranch')}
              </MenuItem>
              <MenuItem onClick={function() { setMergeSource(''); mergeBranchModal.onOpen() }}>
                ⊕ {t('gitWorkflow.mergeBranch')}
              </MenuItem>
              <MenuItem onClick={handlePull}>
                ⬇ {t('projectSettings.pullCode')}
              </MenuItem>
            </MenuList>
          </Menu>
        )}

        {hasLocalPath && !isGuest && (
          <Button h="28px" px="12px" fontSize="12px" rounded="6px"
            variant="outline" borderColor="#8b5cf6" color="#7c3aed"
            _hover={{ bg: '#f5f3ff' }}
            onClick={function() {
              setNewTagName('')
              setNewTagBranch(selectedBranch !== '__all__' ? selectedBranch : (repoInfo && repoInfo.default_branch) || 'main')
              tagModal.onOpen()
            }}>
            {t('projectCommits.createTag')}
          </Button>
        )}

        {tags.length > 0 && (
          <HStack gap="4px" flexWrap="wrap">
            {tags.slice(0, 5).map(function(tag) {
              return (
                <HStack key={tag} spacing="2px" bg="#f5f3ff" px="6px" py="2px" rounded="4px" fontSize="11px">
                  <Text color="#7c3aed" fontWeight="500">{tag}</Text>
                  {hasLocalPath && !isGuest && (
                    <Text color="#aaa" cursor="pointer" _hover={{ color: '#ef4444' }}
                      onClick={function() { handleDeleteTag(tag) }}>x</Text>
                  )}
                </HStack>
              )
            })}
            {tags.length > 5 && (
              <Text fontSize="11px" color="#999">+{tags.length - 5}</Text>
            )}
          </HStack>
        )}

        <Text color="#888" fontSize="12px" ml="auto">{t('projectCommits.total', { count: total })}</Text>
      </Flex>

      {/* Conflict warning bar */}
      {conflictInfo && conflictInfo.active && (
        <Flex mb="8px" p="8px 12px" bg="#fef2f2" rounded="6px" align="center" gap="8px" borderLeft="3px solid #ef4444">
          <Text fontSize="12px" color="#991b1b" flex="1">
            {t('projectCommits.conflictDetected', { type: conflictInfo.type })}
          </Text>
          <Button h="26px" px="10px" fontSize="11px" rounded="4px"
            bg="#ef4444" color="white" _hover={{ bg: '#dc2626' }}
            onClick={handleAbort} isLoading={operating}>
            {t('projectCommits.abortOp')}
          </Button>
        </Flex>
      )}

      {/* Operation action bar */}
      {opMode === 'revert' && (
        <Flex mb="8px" p="8px 12px" bg="#fffbeb" rounded="6px" align="center" gap="8px">
          <Text fontSize="12px" color="#92400e">
            {t('projectCommits.revertHint')}
          </Text>
        </Flex>
      )}

      {opMode === 'reset' && (
        <Flex mb="8px" p="8px 12px" bg="#fffbeb" rounded="6px" align="center" gap="8px">
          <Text fontSize="12px" color="#92400e" mr="8px">
            {t('projectCommits.resetHint')}
          </Text>
          <Input type="number" min="1" max="99" value={resetCount}
            onChange={function(e) { setResetCount(Math.max(1, parseInt(e.target.value) || 1)) }}
            w="60px" h="26px" fontSize="12px" textAlign="center" borderRadius="4px" />
          <Button h="26px" px="10px" fontSize="11px" rounded="4px"
            bg="#ef4444" color="white" _hover={{ bg: '#dc2626' }}
            onClick={handleResetCommits} isLoading={operating}>
            {t('projectCommits.confirmResetBtn')}
          </Button>
        </Flex>
      )}

      {opMode === 'rebase' && selectFrom && (
        <Flex mb="8px" p="8px 12px" bg="#fef2f2" rounded="6px" align="center" gap="8px" borderLeft="3px solid #ef4444">
          <Text fontSize="12px" color="#991b1b" flex={1}>
            {selectTo
              ? t('gitWorkflow.deleteRangeHint', { from: shortHash(selectFrom), to: shortHash(selectTo) })
              : t('gitWorkflow.deleteSelectToHint', { from: shortHash(selectFrom) })}
          </Text>
          <Button h="26px" px="10px" fontSize="11px" rounded="4px"
            variant="outline" borderColor="#aaa" color="#666"
            _hover={{ bg: '#f5f5f5' }}
            onClick={function() { setOpMode(null); setSelectFrom(null); setSelectTo(null) }}>
            {t('common.cancel')}
          </Button>
          {selectFrom && selectTo && (
            <Button h="26px" px="10px" fontSize="11px" rounded="4px"
              bg="#ef4444" color="white" _hover={{ bg: '#dc2626' }}
              onClick={handleDeleteCommits} isLoading={operating}>
              {t('gitWorkflow.confirmDeleteCommits')}
            </Button>
          )}
        </Flex>
      )}

      {/* Commit list */}
      <Box position="relative" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
        {selectedBranch === '__all__' && graphSVG && (
          <Box position="absolute" left="0" top="0" bg="#fafbfc" borderRight="1px solid" borderColor="#f0f0f0" zIndex={1}>
            {graphSVG}
          </Box>
        )}

        <Box ml={selectedBranch === '__all__' && graphLayout ? (graphWidth + 'px') : '0'}>
          {commits.map(function(commit, idx) {
            var hash = commit.hash || commit.sha || commit.id || ''
            var message = commit.message || commit.subject || ''
            var author = commit.author || commit.author_name || ''
            var time = commit.date || commit.time || commit.created_at || ''
            var firstLine = message.split('\n')[0]
            var selected = isSelected(hash)
            var inRange = isInSelectedRange(hash)

            return (
              <Flex
                key={hash || idx}
                align="center"
                h={ROW_H + 'px'}
                borderBottom={idx < commits.length - 1 ? '1px solid' : 'none'}
                borderColor="#f0f0f0"
                bg={selected ? '#fef2f2' : inRange ? '#fefce8' : 'transparent'}
                _hover={{ bg: selected ? '#fee2e2' : inRange ? '#fef9c3' : '#f9faffb' }}
                cursor="pointer"
                px="12px"
                onClick={function() { handleCommitClick(hash) }}
                transition="background-color 0.15s"
              >
                {selectedBranch !== '__all__' && opMode && (
                  <Box w="16px" h="16px" mr="8px" borderRadius="4px"
                    border="2px solid" borderColor={selected ? '#ef4444' : inRange ? '#f59e0b' : '#d1d5db'}
                    bg={selected ? '#ef4444' : inRange ? '#f59e0b' : 'transparent'}
                    flexShrink={0}
                  />
                )}
                <Text fontSize="13px" fontWeight="500" color="#333" noOfLines={1} flex="1" pr="8px">
                  {firstLine}
                </Text>
                <Text fontSize="12px" color="#888" flexShrink={0} mr="12px" w="60px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                  {author}
                </Text>
                <Text fontSize="11px" color="#aaa" flexShrink={0} mr="12px" w="70px" textAlign="right">
                  {timeAgo(time)}
                </Text>
                <Text fontSize="12px" fontFamily="monospace" color="#16a34a" flexShrink={0}
                  bg="#f0fdf4" px="6px" py="1px" rounded="4px" _hover={{ bg: '#dcfce7' }}>
                  {commit.short_hash || shortHash(hash)}
                </Text>
                {hasLocalPath && !isGuest && selectedBranch !== '__all__' && !conflictInfo && (
                  <CommitActionMenu commitHash={hash}
                    onCherryPick={function(sha) { reposAPI.cherryPick(owner, repo, [sha]).then(function() { toast({ title: t('gitWorkflow.cherryPickSuccess'), status: 'success', duration: 3000 }); setPage(1) }).catch(function(err) { toast({ title: err.message || t('gitWorkflow.cherryPickFailed'), status: 'error', duration: 5000 }) }) }}
                    onRevert={handleRevertCommit}
                    onReset={function() { setOpMode('reset') }}
                    onRebase={function() { rebaseEditor.onOpen() }}
                    onDeleteCommit={function(sha) {
                      setOpMode('rebase')
                      setSelectFrom(sha)
                      setSelectTo(sha)
                    }}
                    onSelectRange={function(sha) {
                      setOpMode('rebase')
                      if (!selectFrom) {
                        setSelectFrom(sha)
                        setSelectTo(null)
                      } else if (!selectTo) {
                        if (sha === selectFrom) {
                          setSelectTo(sha)
                        } else {
                          setSelectTo(sha)
                        }
                      } else {
                        setSelectFrom(sha)
                        setSelectTo(null)
                      }
                    }}
                    isGuest={isGuest} />
                )}
              </Flex>
            )
          })}
        </Box>
      </Box>

      <PaginationBar_ProjectCommits page={page} totalPages={totalPages} onPageChange={setPage} />

      {hasLocalPath && !isGuest && (
        <Box mt="16px">
          <Text fontSize="11px" color="#6b7280" mb="4px" fontWeight="500">{t('gitWorkflow.stashManagement')}</Text>
          <StashPanel owner={owner} repo={repo} />
        </Box>
      )}

      <RebaseEditor isOpen={rebaseEditor.isOpen} onClose={rebaseEditor.onClose}
        owner={owner} repo={repo} commits={commits}
        onSuccess={function() { setPage(1) }} />

      {!loading && commits.length === 0 && (
        <Box textAlign="center" py="50px" color="#aaa">
          <Text fontSize="36px" mb="6px">📝</Text>
          <Text fontSize="14px">{t('projectCommits.noCommits')}</Text>
        </Box>
      )}

      {/* Create Tag Modal */}
      <Modal isOpen={tagModal.isOpen} onClose={tagModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent mx="16px">
          <ModalHeader fontSize="15px">{t('projectCommits.createTag')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb="20px">
            <Box mb="12px">
              <Text fontSize="12px" color="#666" mb="4px">{t('projectCommits.tagName')}</Text>
              <Input value={newTagName} onChange={function(e) { setNewTagName(e.target.value) }}
                placeholder="v1.0.0" h="36px" fontSize="14px" borderRadius="6px" />
            </Box>
            <Box mb="12px">
              <Text fontSize="12px" color="#666" mb="4px">{t('projectCommits.tagBranch')}</Text>
              <Select value={newTagBranch} onChange={function(e) { setNewTagBranch(e.target.value) }}
                h="36px" fontSize="14px" borderRadius="6px">
                {branches.map(function(b) {
                  var name = b.replace(/^remotes\/origin\//, '')
                  return <option key={b} value={name}>{name}</option>
                })}
              </Select>
            </Box>
            <Button w="100%" h="36px" fontSize="13px" rounded="6px"
              bg="#8b5cf6" color="white" _hover={{ bg: '#7c3aed' }}
              onClick={handleCreateTag} isLoading={creatingTag}
              isDisabled={!newTagName.trim()}>
              {t('projectCommits.createTag')}
            </Button>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Set Default Branch Modal */}
      <Modal isOpen={branchModal.isOpen} onClose={branchModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent mx="16px">
          <ModalHeader fontSize="15px">{t('projectCommits.setDefaultBranch')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb="20px">
            <Box mb="12px">
              <Text fontSize="12px" color="#666" mb="4px">{t('projectCommits.defaultBranchName')}</Text>
              <Select value={defaultBranchInput} onChange={function(e) { setDefaultBranchInput(e.target.value) }}
                h="36px" fontSize="14px" borderRadius="6px">
                {branches.map(function(b) {
                  var name = b.replace(/^remotes\/origin\//, '')
                  return <option key={b} value={name}>{name}</option>
                })}
              </Select>
            </Box>
            <Button w="100%" h="36px" fontSize="13px" rounded="6px"
              bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }}
              onClick={handleSetDefaultBranch} isLoading={settingBranch}>
              {t('projectCommits.setDefaultBranch')}
            </Button>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Create Branch Modal */}
      <Modal isOpen={createBranchModal.isOpen} onClose={createBranchModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent mx="16px">
          <ModalHeader fontSize="15px">{t('gitWorkflow.createBranch')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb="20px">
            <Box mb="12px">
              <Text fontSize="12px" color="#666" mb="4px">{t('gitWorkflow.branchNamePlaceholder')}</Text>
              <Input value={newBranchName} onChange={function(e) { setNewBranchName(e.target.value) }}
                placeholder="feature/new-feature" h="36px" fontSize="14px" borderRadius="6px" />
            </Box>
            <Text fontSize="11px" color="#888" mb="12px">
              {t('gitWorkflow.createBranchFrom', { branch: selectedBranch !== '__all__' ? selectedBranch : (repoInfo && repoInfo.default_branch) || 'HEAD' })}
            </Text>
            <Button w="100%" h="36px" fontSize="13px" rounded="6px"
              bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }}
              onClick={function() {
                if (!newBranchName.trim()) return
                reposAPI.createBranch(owner, repo, newBranchName.trim(), selectedBranch !== '__all__' ? selectedBranch : 'HEAD').then(function() {
                  toast({ title: t('gitWorkflow.createBranchSuccess'), status: 'success', duration: 3000 })
                  setNewBranchName('')
                  createBranchModal.onClose()
                  setSelectedBranch(newBranchName.trim())
                  setPage(1)
                }).catch(function(err) { toast({ title: err.message || t('gitWorkflow.createBranchFailed'), status: 'error', duration: 3000 }) })
              }} isDisabled={!newBranchName.trim()}>
              {t('common.create')}
            </Button>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Merge Branch Modal */}
      <Modal isOpen={mergeBranchModal.isOpen} onClose={mergeBranchModal.onClose} isCentered>
        <ModalOverlay />
        <ModalContent mx="16px">
          <ModalHeader fontSize="15px">{t('gitWorkflow.mergeBranch')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb="20px">
            <Box mb="12px">
              <Text fontSize="12px" color="#666" mb="4px">{t('gitWorkflow.selectSourceBranch')}</Text>
              <Select value={mergeSource} onChange={function(e) { setMergeSource(e.target.value) }}
                h="36px" fontSize="14px" borderRadius="6px">
                <option value="">{t('gitWorkflow.selectSourceBranch')}</option>
                {branches.filter(function(b) { var n = b.replace(/^remotes\/origin\//, ''); return n !== selectedBranch }).map(function(b) { var n = b.replace(/^remotes\/origin\//, ''); return <option key={b} value={n}>{n}</option> })}
              </Select>
            </Box>
            <Text fontSize="11px" color="#888" mb="12px">
              {t('gitWorkflow.mergeIntoHint', { source: mergeSource || '...', target: selectedBranch !== '__all__' ? selectedBranch : (repoInfo && repoInfo.default_branch) || '?' })}
            </Text>
            <Button w="100%" h="36px" fontSize="13px" rounded="6px"
              bg="#8b5cf6" color="white" _hover={{ bg: '#7c3aed' }}
              onClick={function() {
                if (!mergeSource) return
                var target = selectedBranch !== '__all__' ? selectedBranch : (repoInfo && repoInfo.default_branch) || 'main'
                reposAPI.mergeBranch(owner, repo, mergeSource, target).then(function() {
                  toast({ title: t('gitWorkflow.mergeSuccess'), status: 'success', duration: 3000 })
                  mergeBranchModal.onClose()
                  setPage(1)
                }).catch(function(err) { toast({ title: err.message || t('gitWorkflow.mergeFailed'), status: 'error', duration: 5000 }) })
              }} isDisabled={!mergeSource}>
              {t('gitWorkflow.mergeBranch')}
            </Button>
          </ModalBody>
        </ModalContent>
      </Modal>
      </>
    </GitWorkflowProvider>
  )
}



// ─── ProjectBranches ───

var PAGE_SIZE_ProjectBranches = 20

function PaginationBar_ProjectBranches(_ref) {
  var page = _ref.page
  var totalPages = _ref.totalPages
  var onPageChange = _ref.onPageChange

  if (totalPages <= 1) return null

  var start = Math.floor((page - 1) / 5) * 5 + 1
  var end = Math.min(start + 4, totalPages)
  var pages = []
  for (var i = start; i <= end; i++) {
    pages.push(i)
  }

  return (
    <Flex justify="center" align="center" gap="6px" mt="16px">
      <Button h="28px" px="10px" fontSize="12px" rounded="6px"
        isDisabled={page <= 1}
        onClick={function() { onPageChange(page - 1) }}
        variant="outline" borderColor="#d1d5db">
        ‹
      </Button>
      {start > 1 && (
        <Button h="28px" px="10px" fontSize="12px" rounded="6px"
          variant="outline" borderColor="#d1d5db"
          onClick={function() { onPageChange(start - 1) }}>
          ...
        </Button>
      )}
      {pages.map(function(p) {
        return (
          <Button key={p} h="28px" px="12px" fontSize="12px" rounded="6px"
            bg={p === page ? '#22c55e' : 'transparent'}
            color={p === page ? 'white' : '#666'}
            variant={p === page ? 'solid' : 'outline'}
            borderColor={p === page ? '#22c55e' : '#d1d5db'}
            _hover={p === page ? { bg: '#16a34a' } : { bg: '#f9fafb' }}
            onClick={function() { onPageChange(p) }}>
            {p}
          </Button>
        )
      })}
      {end < totalPages && (
        <Button h="28px" px="10px" fontSize="12px" rounded="6px"
          variant="outline" borderColor="#d1d5db"
          onClick={function() { onPageChange(end + 1) }}>
          ...
        </Button>
      )}
      <Button h="28px" px="10px" fontSize="12px" rounded="6px"
        isDisabled={page >= totalPages}
        onClick={function() { onPageChange(page + 1) }}
        variant="outline" borderColor="#d1d5db">
        ›
      </Button>
    </Flex>
  )
}

function LocalStatusSection(_ref) {
  var unpushedCommits = _ref.unpushedCommits
  var stagedFiles = _ref.stagedFiles
  var workingFiles = _ref.workingFiles
  var untrackedFiles = _ref.untrackedFiles

  var hasUnpushed = unpushedCommits && unpushedCommits.length > 0
  var hasStaged = stagedFiles && stagedFiles.length > 0
  var hasWorking = workingFiles && workingFiles.length > 0
  var hasUntracked = untrackedFiles && untrackedFiles.length > 0
  var hasLocalChanges = hasStaged || hasWorking || hasUntracked

  if (!hasUnpushed && !hasLocalChanges) return null

  return (
    <Box mt="20px">
      <Text fontSize="14px" fontWeight="600" color="#333" mb="12px">{t('projectBranches.localStatus')}</Text>

      {hasUnpushed && (
        <Box mb="16px" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
          <Flex align="center" px="14px" py="10px" bg="#faf5ff" borderBottom="1px solid" borderColor="#e2e2e2">
            <UploadIcon size={14} color="#7c3aed" />
            <Text fontSize="13px" fontWeight="600" color="#7c3aed" ml="8px">
              {t('projectBranches.unpushedCommits')} ({unpushedCommits.length})
            </Text>
          </Flex>
          <VStack spacing="0" align="stretch">
            {unpushedCommits.map(function(commit, idx) {
              return (
                <Flex key={commit.hash || idx} align="center" px="14px" py="8px"
                  borderBottom={idx < unpushedCommits.length - 1 ? '1px solid' : 'none'} borderColor="#f0f0f0"
                  _hover={{ bg: '#f9fafb' }}>
                  <Badge fontSize="11px" px="6px" py="1px" rounded="4px" bg="#f0fdf4" color="#16a34a"
                    fontFamily="monospace" mr="10px">
                    {commit.short_hash}
                  </Badge>
                  <Text fontSize="13px" color="#333" flex={1} noOfLines={1}>{commit.message}</Text>
                  <Text fontSize="12px" color="#888" ml="10px">{commit.author}</Text>
                  <Text fontSize="11px" color="#aaa" ml="8px">{timeAgo(commit.date)}</Text>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}

      {hasStaged && (
        <Box mb="16px" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
          <Flex align="center" px="14px" py="10px" bg="#f0fdf4" borderBottom="1px solid" borderColor="#e2e2e2">
            <PlusIcon size={14} color="#16a34a" />
            <Text fontSize="13px" fontWeight="600" color="#16a34a" ml="8px">
              {t('projectBranches.stagedFiles')} ({stagedFiles.length})
            </Text>
          </Flex>
          <VStack spacing="0" align="stretch">
            {stagedFiles.map(function(f, idx) {
              var path = typeof f === 'string' ? f : f.path || f.name
              var status = typeof f === 'string' ? '' : f.status || ''
              var statusColors = { A: '#16a34a', M: '#d97706', D: '#dc2626' }
              var isDeleted = status === 'D'
              return (
                <Flex key={idx} align="center" px="14px" py="7px"
                  borderBottom={idx < stagedFiles.length - 1 ? '1px solid' : 'none'} borderColor="#f0f0f0"
                  _hover={{ bg: '#f9fafb' }}>
                  {status && (
                    <Text fontSize="10px" fontWeight="700" fontFamily="monospace" mr="8px"
                      color={statusColors[status] || '#888'}
                      bg={statusColors[status] ? statusColors[status] + '15' : '#f3f4f6'}
                      px="4px" py="0" rounded="3px" lineHeight="16px" flexShrink={0}>
                      {status}
                    </Text>
                  )}
                  <Text fontSize="12.5px" fontFamily="monospace" color={isDeleted ? '#aaa' : '#16a34a'}
                    textDecoration={isDeleted ? 'line-through' : 'none'}>
                    {path}
                  </Text>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}

      {hasWorking && (
        <Box mb="16px" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
          <Flex align="center" px="14px" py="10px" bg="#fffbeb" borderBottom="1px solid" borderColor="#e2e2e2">
            <EditIcon size={14} color="#d97706" />
            <Text fontSize="13px" fontWeight="600" color="#d97706" ml="8px">
              {t('projectBranches.modifiedFiles')} ({workingFiles.length})
            </Text>
          </Flex>
          <VStack spacing="0" align="stretch">
            {workingFiles.map(function(f, idx) {
              var path = typeof f === 'string' ? f : f.path || f.name
              var status = typeof f === 'string' ? '' : f.status || ''
              var statusColors = { A: '#16a34a', M: '#d97706', D: '#dc2626' }
              var isDeleted = status === 'D'
              return (
                <Flex key={idx} align="center" px="14px" py="7px"
                  borderBottom={idx < workingFiles.length - 1 ? '1px solid' : 'none'} borderColor="#f0f0f0"
                  _hover={{ bg: '#f9fafb' }}>
                  {status && (
                    <Text fontSize="10px" fontWeight="700" fontFamily="monospace" mr="8px"
                      color={statusColors[status] || '#888'}
                      bg={statusColors[status] ? statusColors[status] + '15' : '#f3f4f6'}
                      px="4px" py="0" rounded="3px" lineHeight="16px" flexShrink={0}>
                      {status}
                    </Text>
                  )}
                  <Text fontSize="12.5px" fontFamily="monospace" color={isDeleted ? '#aaa' : '#d97706'}
                    textDecoration={isDeleted ? 'line-through' : 'none'}>
                    {path}
                  </Text>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}

      {hasUntracked && (
        <Box mb="16px" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
          <Flex align="center" px="14px" py="10px" bg="#f9fafb" borderBottom="1px solid" borderColor="#e2e2e2">
            <PlusIcon size={14} color="#6b7280" />
            <Text fontSize="13px" fontWeight="600" color="#6b7280" ml="8px">
              {t('projectBranches.untrackedFiles')} ({untrackedFiles.length})
            </Text>
          </Flex>
          <VStack spacing="0" align="stretch">
            {untrackedFiles.map(function(f, idx) {
              var path = typeof f === 'string' ? f : f.path || f.name
              return (
                <Flex key={idx} align="center" px="14px" py="7px"
                  borderBottom={idx < untrackedFiles.length - 1 ? '1px solid' : 'none'} borderColor="#f0f0f0"
                  _hover={{ bg: '#f9fafb' }}>
                  <Text fontSize="10px" fontWeight="700" fontFamily="monospace" mr="8px"
                    color="#6b7280" bg="#f3f4f6"
                    px="4px" py="0" rounded="3px" lineHeight="16px" flexShrink={0}>
                    A
                  </Text>
                  <Text fontSize="12.5px" fontFamily="monospace" color="#6b7280">
                    {path}
                  </Text>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}
    </Box>
  )
}

const ProjectBranches = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const [branches, setBranches] = useState([])
  const [stagedFiles, setStagedFiles] = useState([])
  const [workingFiles, setWorkingFiles] = useState([])
  const [untrackedFiles, setUntrackedFiles] = useState([])
  const [unpushedCommits, setUnpushedCommits] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    reposAPI.branches(owner, repo).then(function(data) {
      setBranches(Array.isArray(data && data.branches ? data.branches : data) ? (data.branches || data) : [])
      if (data && data.staged_files) setStagedFiles(data.staged_files)
      if (data && data.working_files) setWorkingFiles(data.working_files)
      if (data && data.untracked_files) setUntrackedFiles(data.untracked_files)
      if (data && data.unpushed_commits) setUnpushedCommits(data.unpushed_commits)
    }).catch(function() { setBranches([]) }).finally(function() { setLoading(false) })
  }, [owner, repo])

  var totalPages = Math.ceil(branches.length / PAGE_SIZE_ProjectBranches) || 1
  var startIdx = (page - 1) * PAGE_SIZE_ProjectBranches
  var endIdx = Math.min(startIdx + PAGE_SIZE_ProjectBranches, branches.length)
  var pageBranches = branches.slice(startIdx, endIdx)

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box>
      <HStack gap="8px" fontSize="14px" fontWeight="600" color="#333" mb="16px">
        <GitBranch size={16} color="#333" />
        <Text>{t('branch.title')}</Text>
        <Text as="span" color="#888" fontWeight="400">({branches.length})</Text>
      </HStack>

      <VStack spacing="0" align="stretch" border="1px solid" borderColor="#e2e2e2" rounded="10px" overflow="hidden">
        {pageBranches.map(function(branch, idx) {
          var name = typeof branch === 'string' ? branch : (branch.name || '')
          var isDefault = name === 'main' || name === 'master'
          return (
            <Flex
              key={name || idx}
              align="center" justify="space-between"
              px="16px" py="10px"
              borderBottom={idx < pageBranches.length - 1 ? '1px solid' : 'none'}
              borderColor="#f0f0f0"
              _hover={{ bg: '#f9fafb' }}
              transition="background-color 0.15s"
            >
              <HStack gap="10px">
                <GitBranch size={14} color="#16a34a" />
                <RouterLink to={'/' + owner + '/' + repo + '/tree/' + name}
                  style={{ textDecoration: 'none' }}>
                  <Text fontSize="13.5px" fontWeight="500" color="#16a34a" fontFamily="monospace"
                    _hover={{ textDecoration: 'underline' }}>
                    {name}
                  </Text>
                </RouterLink>
                {isDefault && (
                  <Badge fontSize="11px" px="7px" py="1px" rounded="4px" bg="#dcfce7" color="#16a34a">
                    {t('projectBranches.default')}
                  </Badge>
                )}
              </HStack>
            </Flex>
          )
        })}
      </VStack>

      <PaginationBar_ProjectBranches page={page} totalPages={totalPages} onPageChange={setPage} />

      <LocalStatusSection
        unpushedCommits={unpushedCommits}
        stagedFiles={stagedFiles}
        workingFiles={workingFiles}
        untrackedFiles={untrackedFiles}
      />

      {!loading && branches.length === 0 && (
        <Box textAlign="center" py="50px" color="#aaa">
          <GitBranch size={36} color="#ccc" mb="6px" />
          <Text fontSize="14px">{t('projectBranches.noBranches')}</Text>
        </Box>
      )}
    </Box>
  )
}



// ─── ProjectMisc ───

// ─── ProjectTags ──────────────────────────────────────────────

const ProjectTags = () => {
  const { owner, repo } = useParams()
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reposAPI.tags(owner, repo).then(function(data) {
      setTags(Array.isArray(data && data.tags ? data.tags : data) ? (data.tags || data) : [])
    }).catch(function() { setTags([]) }).finally(function() { setLoading(false) })
  }, [owner, repo])

  if (loading) {
    return <Box display="flex" justifyContent="center" py="60px"><Spinner size="lg" color="#22c55e" /></Box>
  }

  return (
    <Box>
      <Text fontSize="14px" fontWeight="600" color="#333" mb="16px">
        🏷️ {t('tag.title')} <Text as="span" color="#888" fontWeight="400">({tags.length})</Text>
      </Text>
      <Box display="grid" gridTemplateColumns="repeat(5, 1fr)" gap="8px">
        {tags.map(function(tag, idx) {
          var name = typeof tag === 'string' ? tag : (tag.name || tag.tag || '')
          return (
            <RouterLink key={name || idx} to={'/' + owner + '/' + repo + '/tree/' + name} style={{ textDecoration: 'none' }}>
              <Flex align="center" gap="6px" px="10px" py="8px" bg="#f5f3ff" rounded="6px"
                _hover={{ bg: '#ede9fe' }} transition="background-color 0.15s">
                <Text fontSize="13px">🏷️</Text>
                <Text fontSize="13px" fontWeight="500" color="#7c3aed" fontFamily="monospace"
                  overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{name}</Text>
              </Flex>
            </RouterLink>
          )
        })}
      </Box>
      {!loading && tags.length === 0 && (
        <Box textAlign="center" py="50px" color="#aaa">
          <Text fontSize="36px" mb="6px">🏷️</Text>
          <Text fontSize="14px">{t('projectTags.noTags')}</Text>
        </Box>
      )}
    </Box>
  )
}

// ─── ProjectStats ─────────────────────────────────────────────

var LANG_COLORS = {
  Go: '#00ADD8', JavaScript: '#F7DF1E', TypeScript: '#3178C6',
  Python: '#3572A5', Ruby: '#701516', Java: '#b07219',
  Rust: '#DEA584', PHP: '#4F5D95', 'C++': '#f34b7d',
  C: '#555555', Shell: '#89e051', HTML: '#e34c26',
  CSS: '#563d7c', SQL: '#4479A1', Markdown: '#083FA1',
  YAML: '#CB171E', JSON: '#292929', Dockerfile: '#384d54',
}

const ProjectStats = () => {
  const { owner, repo } = useParams()
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [langStats, setLangStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      reposAPI.codeStats(owner, repo).catch(function() { return null }),
      reposAPI.commitActivity(owner, repo, 30).catch(function() { return null }),
    ]).then(function([codeStats, activityData]) {
      if (codeStats) {
        var langs = []
        if (Array.isArray(codeStats)) langs = codeStats
        else if (codeStats && codeStats.languages) langs = codeStats.languages
        setLangStats(langs)
      }
      if (activityData) {
        setStats(activityData)
        setActivity(Array.isArray(activityData.activity || activityData) ? (activityData.activity || activityData) : [])
      }
    }).finally(function() { setLoading(false) })
  }, [owner, repo])

  if (loading) {
    return <Box display="flex" justifyContent="center" py="60px"><Spinner size="lg" color="#22c55e" /></Box>
  }

  var totalLines = langStats.reduce(function(sum, l) { return sum + (l.lines || l.size || 0) }, 0)

  return (
    <Box>
      <Text fontSize="18px" fontWeight="700" color="#333" mb="20px">📊 {t('stats.title')}</Text>
      {langStats.length > 0 && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
          <Text fontSize="15px" fontWeight="600" color="#333" mb="16px">{t('stats.languageDistribution')}</Text>
          <Flex h="12px" rounded="6px" overflow="hidden" mb="12px">
            {langStats.map(function(lang, idx) {
              var pct = totalLines > 0 ? ((lang.lines || lang.size || 0) / totalLines * 100) : 0
              return (
                <Box key={lang.name || lang.language || idx} h="100%" flex={pct + '%'}
                  bg={LANG_COLORS[lang.name || lang.language] || '#959DA5'}
                  title={(lang.name || lang.language) + ': ' + pct.toFixed(1) + '%'} />
              )
            })}
          </Flex>
          <VStack spacing="8px" align="stretch">
            {langStats.map(function(lang, idx) {
              var name = lang.name || lang.language || 'Other'
              var lines = lang.lines || lang.size || 0
              var pct = totalLines > 0 ? (lines / totalLines * 100) : 0
              return (
                <Flex key={name} align="center" gap="10px" fontSize="13px">
                  <Box w="12px" h="12px" rounded="2px" bg={LANG_COLORS[name] || '#959DA5'} flexShrink={0} />
                  <Text fontWeight="500" color="#333" flex={1}>{name}</Text>
                  <Text color="#888">{lines.toLocaleString()} {t('stats.lines')}</Text>
                  <Text color="#aaa" w="50px" textAlign="right">{pct.toFixed(1)}%</Text>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}
      {activity.length > 0 && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
          <Text fontSize="15px" fontWeight="600" color="#333" mb="16px">{t('stats.commitActivity')}</Text>
          <VStack spacing="6px" align="stretch">
            {activity.slice().reverse().slice(0, 14).map(function(a, idx) {
              var count = a.count || a.commits || 0
              var maxCount = Math.max.apply(null, activity.map(function(x) { return x.count || x.commits || 1 }))
              var barWidth = maxCount > 0 ? (count / maxCount * 100) : 0
              return (
                <Flex key={idx} align="center" gap="10px" fontSize="13px">
                  <Text color="#888" w="80px" flexShrink={0}>{(a.date || '').substring(5)}</Text>
                  <Box flex={1} h="20px" bg="#f3f4f6" rounded="4px" overflow="hidden">
                    <Box h="100%" w={barWidth + '%'} bg="#22c55e" rounded="4px" transition="width 0.3s" />
                  </Box>
                  <Text color="#333" fontWeight="500" w="40px" textAlign="right">{count}</Text>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}
      {langStats.length === 0 && activity.length === 0 && (
        <Box textAlign="center" py="60px" color="#aaa">
          <Text fontSize="36px" mb="8px">📊</Text>
          <Text fontSize="14px">{t('stats.noStats')}</Text>
        </Box>
      )}
    </Box>
  )
}

// ─── ProjectReleases ──────────────────────────────────────────

const ProjectReleases = () => {
  const { owner, repo } = useParams()
  const [releases, setReleases] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    releasesAPI.list(owner, repo).then(function(res) {
      setReleases(Array.isArray(res.data) ? res.data : [])
    }).catch(function() { setReleases([]) }).finally(function() { setLoading(false) })
  }, [owner, repo])

  function handleSync() {
    setSyncing(true)
    releasesAPI.sync(owner, repo).then(function() {
      return releasesAPI.list(owner, repo)
    }).then(function(res) {
      setReleases(Array.isArray(res.data) ? res.data : [])
    }).catch(function() {}).finally(function() { setSyncing(false) })
  }

  if (loading) {
    return <Box display="flex" justifyContent="center" py="60px"><Spinner size="lg" color="#22c55e" /></Box>
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb="16px">
        <HStack gap="8px" fontSize="14px" fontWeight="600" color="#333">
          <Rocket size={16} color="#333" />
          <Text>{t('release.title')}</Text>
          <Text as="span" color="#888" fontWeight="400">({releases.length})</Text>
        </HStack>
        <Button h="30px" px="14px" fontSize="13px" rounded="6px" variant="outline"
          borderColor="#d1d5db" color="#666"
          _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
          onClick={handleSync} isLoading={syncing}>
          {t('projectReleases.syncFromRemote')}
        </Button>
      </Flex>
      <VStack spacing="14px" align="stretch">
        {releases.map(function(r) {
          return (
            <Flex key={r.id || r.tag_name} direction="column" bg="white" border="1px solid" borderColor="#e2e2e2"
              rounded="10px" p="20px" transition="all 0.15s"
              _hover={{ borderColor: '#d1d5db', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Flex gap="8px" mb="6px" align="center">
                <Text fontSize="15px" fontWeight="600" color="#333">{r.title || r.tag_name}</Text>
                <Badge fontSize="11px" px="7px" py="1px" rounded="4px" bg="#ede9fe" color="#7c3aed" fontFamily="monospace">{r.tag_name}</Badge>
                {r.is_draft && <Badge fontSize="11px" px="7px" py="1px" rounded="4px" bg="#fef2f2" color="#dc2626">{t('projectReleases.draft')}</Badge>}
                {r.is_prerelease && <Badge fontSize="11px" px="7px" py="1px" rounded="4px" bg="#fffbeb" color="#f59e0b">{t('projectReleases.prerelease')}</Badge>}
              </Flex>
              {r.body && <Text fontSize="13px" color="#666" mb="10px" noOfLines={3} whiteSpace="pre-wrap">{r.body}</Text>}
              <HStack gap="14px" fontSize="12.5px" color="#888">
                {r.author && <HStack gap="4px"><User size={13} /><Text>{r.author.username || r.author.full_name || t('common.unknownUser')}</Text></HStack>}
                <Text>{timeAgo(r.created_at)}</Text>
              </HStack>
            </Flex>
          )
        })}
      </VStack>
      {!loading && releases.length === 0 && (
        <Box textAlign="center" py="50px" color="#aaa">
          <Rocket size={36} color="#ccc" mb="6px" />
          <Text fontSize="14px">{t('projectReleases.noReleases')}</Text>
        </Box>
      )}
    </Box>
  )
}

// ─── ProjectTasks ──────────────────────────────────────────────

var TASK_STATUS_CONFIG = {
  draft: { label: t('task.draft'), bg: '#f3f4f6', color: '#666', icon: '📝' },
  progress: { label: t('task.inProgress'), bg: '#dbeafe', color: '#2563eb', icon: '🔄' },
  review: { label: t('task.review'), bg: '#fef3c7', color: '#d97706', icon: '👀' },
  completed: { label: t('task.done'), bg: '#dcfce7', color: '#16a34a', icon: '✅' },
}

var PRIORITY_COLORS = {
  1: '#dc2626', 2: '#f97316', 3: '#eab308', 4: '#22c55e', 5: '#3b82f6',
}

const ProjectTasks = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const { isGuest } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    var params = {}
    if (statusFilter) params.status = statusFilter
    tasksAPI.list(owner, repo, params).then(function(res) {
      setTasks(Array.isArray(res.data) ? res.data : [])
    }).catch(function() { setTasks([]) }).finally(function() { setLoading(false) })
  }, [owner, repo, statusFilter])

  if (loading) {
    return <Box display="flex" justifyContent="center" py="60px"><Spinner size="lg" color="#22c55e" /></Box>
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb="16px">
        <HStack gap="12px" fontSize="14px" fontWeight="600">
          <Text color="#333">📋 {t('task.title')}</Text>
          <Text color="#888" fontSize="13px">({tasks.length})</Text>
        </HStack>
        <HStack gap="10px">
          <Select h="30px" w="150px" fontSize="13px" borderColor="#d1d5db" rounded="6px"
            value={statusFilter} onChange={function(e) { setStatusFilter(e.target.value) }}>
            <option value="">{t('common.all')}</option>
            <option value="draft">{t('task.draft')}</option>
            <option value="progress">{t('task.inProgress')}</option>
            <option value="review">{t('task.review')}</option>
            <option value="completed">{t('task.done')}</option>
          </Select>
          <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }}
            onClick={function() { navigate('/' + owner + '/' + repo + '/tasks/new') }} isDisabled={isGuest}>
            + {t('task.newTask')}
          </Button>
        </HStack>
      </Flex>
      <VStack spacing="10px" align="stretch">
        {tasks.map(function(task) {
          var cfg = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.draft
          var priorityColor = PRIORITY_COLORS[task.priority] || '#888'
          return (
            <Flex key={task.id} direction="column" bg="white" border="1px solid" borderColor="#e2e2e2"
              rounded="8px" p="16px 20px" transition="all 0.15s"
              _hover={{ borderColor: '#d1d5db', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              cursor="pointer"
              onClick={function() { navigate('/' + owner + '/' + repo + '/tasks/' + task.id) }}>
              <Flex gap="8px" mb="4px" align="center">
                <Text fontSize="14px">{cfg.icon}</Text>
                <Badge fontSize="11px" px="7px" py="1px" rounded="4px" bg={cfg.bg} color={cfg.color}>{cfg.label}</Badge>
                <Text fontSize="13.5px" fontWeight="600" color="#333">{task.title}</Text>
              </Flex>
              <HStack gap="14px" fontSize="12.5px" color="#888" mt="6px">
                <HStack gap="4px"><Box w="8px" h="8px" rounded="full" bg={priorityColor} /><Text>P{task.priority}</Text></HStack>
                {task.initiator && <Text>👤 {task.initiator}</Text>}
                {task.handler && <Text>🔧 {task.handler}</Text>}
                <Text>{timeAgo(task.created_at)}</Text>
              </HStack>
            </Flex>
          )
        })}
      </VStack>
      {!loading && tasks.length === 0 && (
        <Box textAlign="center" py="50px" color="#aaa">
          <Text fontSize="36px" mb="6px">📋</Text>
          <Text fontSize="14px">{t('task.noTasks')}</Text>
        </Box>
      )}
    </Box>
  )
}

// ─── exports ───────────────────────────────────────────────────



// ─── ProjectNewItems ───

// ─── NewIssue ──────────────────────────────────────────────────

const NewIssue = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ title: '', body: '', labels: [], assignee: '' })
  const [availableLabels, setAvailableLabels] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    labelsAPI.list(owner, repo).then(function(data) {
      setAvailableLabels(Array.isArray(data) ? data : [])
    }).catch(function() { setAvailableLabels([]) })
  }, [owner, repo])

  function toggleLabel(labelName) {
    setForm(function(prev) {
      var labels = prev.labels.slice()
      var idx = labels.indexOf(labelName)
      if (idx >= 0) labels.splice(idx, 1)
      else labels.push(labelName)
      return Object.assign({}, prev, { labels: labels })
    })
  }

  function handleSubmit() {
    if (!form.title.trim()) {
      toast({ title: t('issue.titleRequired'), status: 'error', duration: 3000 })
      return
    }
    setSubmitting(true)
    issuesAPI.create(owner, repo, form).then(function(data) {
      navigate('/' + owner + '/' + repo + '/issues/' + data.number)
    }).catch(function(err) {
      toast({ title: err.message || t('issue.createFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  return (
    <Box>
      <HStack gap="8px" mb="20px">
        <TriangleAlert size={18} color="#333" />
        <Text fontSize="18px" fontWeight="700" color="#333">{t('issue.newIssue')}</Text>
      </HStack>
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px">
        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('issue.title')}</Text>
          <Input value={form.title} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { title: e.target.value }) }) }}
            placeholder={t('issue.title')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('issue.description')}</Text>
          <SimpleEditor value={form.body} onChange={function(val) { setForm(function(p) { return Object.assign({}, p, { body: val }) }) }}
            placeholder={t('issue.describeIssue')} height={280} owner={owner} repo={repo} />
        </Box>
        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('issue.responsible')}</Text>
          <Input value={form.assignee} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { assignee: e.target.value }) }) }}
            placeholder={t('common.username')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        {availableLabels.length > 0 && (
          <Box mb="20px">
            <Text fontSize="13px" fontWeight="600" color="#555" mb="8px">{t('issue.labels')}</Text>
            <HStack gap="6px" flexWrap="wrap">
              {availableLabels.map(function(label) {
                var name = label.name || label
                var isSelected = form.labels.indexOf(name) >= 0
                return (
                  <Badge key={name} fontSize="12px" px="8px" py="3px" rounded="12px" cursor="pointer"
                    bg={isSelected ? (label.color || '#22c55e') : '#f3f4f6'}
                    color={isSelected ? (label.text_color || 'white') : '#666'}
                    _hover={{ opacity: 0.8 }}
                    onClick={function() { toggleLabel(name) }}>{name}</Badge>
                )
              })}
            </HStack>
          </Box>
        )}
        <Flex justify="flex-end" gap="10px">
          <Button h="34px" px="16px" fontSize="13px" rounded="6px" variant="outline" borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>{t('common.cancel')}</Button>
          <Button h="34px" px="20px" fontSize="13px" rounded="6px" bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>{t('issue.createIssue')}</Button>
        </Flex>
      </Box>
    </Box>
  )
}

// ─── NewPR ─────────────────────────────────────────────────────

const NewPR = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ title: '', body: '', source_branch: '', target_branch: '', assignee: '' })
  const [branches, setBranches] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    reposAPI.branches(owner, repo).then(function(data) {
      var list = Array.isArray(data && data.branches ? data.branches : data) ? (data.branches || data) : []
      setBranches(list.map(function(b) { return typeof b === 'string' ? b : (b.name || '') }))
    }).catch(function() { setBranches([]) })
  }, [owner, repo])

  useEffect(() => {
    if (branches.length > 0 && !form.target_branch) {
      var defaultBranch = branches.find(function(b) { return b === 'main' || b === 'master' }) || branches[0]
      setForm(function(prev) { return Object.assign({}, prev, { target_branch: defaultBranch }) })
    }
  }, [branches])

  function handleSubmit() {
    if (!form.title.trim()) { toast({ title: t('newPR.titleRequired'), status: 'error', duration: 3000 }); return }
    if (!form.source_branch) { toast({ title: t('newPR.sourceRequired'), status: 'error', duration: 3000 }); return }
    if (!form.target_branch) { toast({ title: t('newPR.targetRequired'), status: 'error', duration: 3000 }); return }
    setSubmitting(true)
    prsAPI.create(owner, repo, form).then(function(data) {
      navigate('/' + owner + '/' + repo + '/pull_requests/' + data.number)
    }).catch(function(err) {
      toast({ title: err.message || t('newPR.createFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  return (
    <Box>
      <HStack gap="8px" mb="20px">
        <GitPullRequest size={18} color="#333" />
        <Text fontSize="18px" fontWeight="700" color="#333">{t('pr.newPR')}</Text>
      </HStack>
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px">
        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('pr.title')}</Text>
          <Input value={form.title} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { title: e.target.value }) }) }}
            placeholder={t('newPR.titlePlaceholder')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('pr.description')}</Text>
          <Textarea value={form.body} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { body: e.target.value }) }) }}
            placeholder={t('newPR.descriptionPlaceholder')} fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={6}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        <Flex gap="16px" mb="16px">
          <Box flex={1}>
            <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('pr.sourceBranch')}</Text>
            <Select value={form.source_branch} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { source_branch: e.target.value }) }) }}
              h="38px" fontSize="14px" borderColor="#d1d5db" borderRadius="8px" placeholder={t('newPR.selectSource')}>
              {branches.map(function(b) { return <option key={b} value={b}>{b}</option> })}
            </Select>
          </Box>
          <Box flex={1}>
            <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('pr.targetBranch')}</Text>
            <Select value={form.target_branch} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { target_branch: e.target.value }) }) }}
              h="38px" fontSize="14px" borderColor="#d1d5db" borderRadius="8px" placeholder={t('newPR.selectTarget')}>
              {branches.map(function(b) { return <option key={b} value={b}>{b}</option> })}
            </Select>
          </Box>
        </Flex>
        <Box mb="20px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('pr.assignee')}</Text>
          <Input value={form.assignee} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { assignee: e.target.value }) }) }}
            placeholder={t('newPR.assigneePlaceholder')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        <Flex justify="flex-end" gap="10px">
          <Button h="34px" px="16px" fontSize="13px" rounded="6px" variant="outline" borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>{t('common.cancel')}</Button>
          <Button h="34px" px="20px" fontSize="13px" rounded="6px" bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>{t('pr.newPR')}</Button>
        </Flex>
      </Box>
    </Box>
  )
}

// ─── NewTask ───────────────────────────────────────────────────

var PRIORITY_OPTIONS = [
  { value: 1, labelKey: 'task.priorityOptions.p1', color: '#dc2626' },
  { value: 2, labelKey: 'task.priorityOptions.p2', color: '#f97316' },
  { value: 3, labelKey: 'task.priorityOptions.p3', color: '#eab308' },
  { value: 4, labelKey: 'task.priorityOptions.p4', color: '#22c55e' },
  { value: 5, labelKey: 'task.priorityOptions.p5', color: '#3b82f6' },
]

const NewTask = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ title: '', goal: '', draft: '', priority: 3, handler: '', verifier: '', review_at: '' })
  const [availableIssues, setAvailableIssues] = useState([])
  const [selectedIssueIds, setSelectedIssueIds] = useState([])
  const [showIssuePicker, setShowIssuePicker] = useState(false)
  const [createdTaskId, setCreatedTaskId] = useState(null)

  useEffect(() => {
    issuesAPI.list(owner, repo, { state: 'open', per_page: 50 }).then(function(data) {
      var items = Array.isArray(data) ? data : (data && data.items ? data.items : [])
      setAvailableIssues(items)
    }).catch(function() { setAvailableIssues([]) })
  }, [owner, repo])

  useEffect(() => {
    if (!createdTaskId) return
    var promises = selectedIssueIds.map(function(issueId) {
      return tasksAPI.linkIssue(owner, repo, createdTaskId, issueId).catch(function() {})
    })
    Promise.all(promises).then(function() {
      navigate('/' + owner + '/' + repo + '/tasks/' + createdTaskId)
    })
  }, [createdTaskId])

  function toggleIssueSelection(issueId) {
    setSelectedIssueIds(function(prev) {
      if (prev.indexOf(issueId) >= 0) return prev.filter(function(id) { return id !== issueId })
      return prev.concat([issueId])
    })
  }

  function handleSubmit() {
    if (!form.title.trim()) { toast({ title: t('task.titleRequired'), status: 'error', duration: 3000 }); return }
    setSubmitting(true)
    tasksAPI.create(owner, repo, form).then(function(data) {
      if (selectedIssueIds.length > 0) { setCreatedTaskId(data.id) }
      else { navigate('/' + owner + '/' + repo + '/tasks/' + data.id) }
    }).catch(function(err) {
      toast({ title: err.message || t('task.createFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  var selectedIssues = availableIssues.filter(function(i) { return selectedIssueIds.indexOf(i.id) >= 0 })

  return (
    <Box>
      <HStack gap="8px" mb="20px">
        <ClipboardList size={18} color="#333" />
        <Text fontSize="18px" fontWeight="700" color="#333">{t('task.newTask')}</Text>
      </HStack>
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px">
        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('task.title')} *</Text>
          <Input value={form.title} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { title: e.target.value }) }) }}
            placeholder={t('task.title')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('task.goal')}</Text>
          <SimpleEditor value={form.goal} onChange={function(val) { setForm(function(p) { return Object.assign({}, p, { goal: val }) }) }}
            placeholder={t('task.goalPlaceholder')} height={200} owner={owner} repo={repo} />
        </Box>
        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('task.draftOrPlan')}</Text>
          <SimpleEditor value={form.draft} onChange={function(val) { setForm(function(p) { return Object.assign({}, p, { draft: val }) }) }}
            placeholder={t('task.draftPlaceholder')} height={200} owner={owner} repo={repo} />
        </Box>
        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('task.priority')}</Text>
          <HStack gap="8px" flexWrap="wrap">
            {PRIORITY_OPTIONS.map(function(opt) {
              var isActive = form.priority === opt.value
              return (
                <Badge key={opt.value} fontSize="12px" px="10px" py="4px" rounded="6px" cursor="pointer"
                  bg={isActive ? opt.color : '#f3f4f6'} color={isActive ? 'white' : '#666'}
                  _hover={{ opacity: 0.8 }}
                  onClick={function() { setForm(function(p) { return Object.assign({}, p, { priority: opt.value }) }) }}>
                  {t(opt.labelKey)}
                </Badge>
              )
            })}
          </HStack>
        </Box>
        <Flex gap="16px" mb="20px">
          <Box flex={1}>
            <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('task.handler')}</Text>
            <Input value={form.handler} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { handler: e.target.value }) }) }}
              placeholder={t('common.username')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
              _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          </Box>
          <Box flex={1}>
            <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('task.verifier')}</Text>
            <Input value={form.verifier} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { verifier: e.target.value }) }) }}
              placeholder={t('common.username')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
              _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          </Box>
        </Flex>
        <Box mb="20px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('task.reviewAt')}</Text>
          <DateTimePicker value={form.review_at} onChange={function(val) { setForm(function(p) { return Object.assign({}, p, { review_at: val }) }) }} placeholder={t('task.reviewAt')} />
        </Box>
        <Box mb="20px">
          <Flex justify="space-between" align="center" mb="8px">
            <HStack gap="6px"><LinkIcon size={14} color="#555" /><Text fontSize="13px" fontWeight="600" color="#555">{t('task.linkedIssues')}</Text></HStack>
            <Button h="22px" px="8px" fontSize="11px" variant="outline" borderColor="#d1d5db" color="#666"
              onClick={function() { setShowIssuePicker(!showIssuePicker) }}>
              {showIssuePicker ? t('common.collapse') : t('common.selectIssue')}
            </Button>
          </Flex>
          {selectedIssues.length > 0 && (
            <HStack gap="6px" flexWrap="wrap" mb="8px">
              {selectedIssues.map(function(issue) {
                return (
                  <Badge key={issue.id} fontSize="11px" px="8px" py="3px" rounded="6px" bg="#eff6ff" color="#2563eb"
                    display="flex" alignItems="center" gap="4px">
                    <Text>#{issue.number}</Text>
                    <Text maxW="120px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{issue.title}</Text>
                    <Box as="span" cursor="pointer" _hover={{ color: '#dc2626' }} onClick={function() { toggleIssueSelection(issue.id) }}><X size={12} /></Box>
                  </Badge>
                )
              })}
            </HStack>
          )}
          {showIssuePicker && (
            <Box border="1px solid" borderColor="#e2e2e2" rounded="8px" maxH="200px" overflow="auto">
              {availableIssues.length > 0 ? availableIssues.map(function(issue) {
                var isSelected = selectedIssueIds.indexOf(issue.id) >= 0
                return (
                  <Flex key={issue.id} align="center" gap="8px" px="12px" py="8px" cursor="pointer"
                    bg={isSelected ? '#f0fdf4' : 'transparent'} _hover={{ bg: isSelected ? '#f0fdf4' : '#f9fafb' }}
                    onClick={function() { toggleIssueSelection(issue.id) }}
                    borderBottom="1px solid" borderColor="#f0f0f0">
                    <Box w="14px" h="14px" rounded="3px" border="2px solid"
                      borderColor={isSelected ? '#22c55e' : '#d1d5db'} bg={isSelected ? '#22c55e' : 'transparent'}
                      display="flex" alignItems="center" justifyContent="center">
                      {isSelected && <Text fontSize="9px" color="white">✓</Text>}
                    </Box>
                    <Text fontSize="12px" color="#888">#{issue.number}</Text>
                    <Text fontSize="12.5px" color="#333" flex={1} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{issue.title}</Text>
                  </Flex>
                )
              }) : <Text fontSize="12px" color="#aaa" py="12px" textAlign="center">{t('common.noLinkableIssues')}</Text>}
            </Box>
          )}
        </Box>
        <Flex justify="flex-end" gap="10px">
          <Button h="34px" px="16px" fontSize="13px" rounded="6px" variant="outline" borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>{t('common.cancel')}</Button>
          <Button h="34px" px="20px" fontSize="13px" rounded="6px" bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>{t('task.createTask')}</Button>
        </Flex>
      </Box>
    </Box>
  )
}

// ─── exports ───────────────────────────────────────────────────



// ─── ProjectDetails ───

// ─── CommitDetail ──────────────────────────────────────────────

const CommitDetail = () => {
  const { owner, repo, sha } = useParams()
  const navigate = useNavigate()
  const [commit, setCommit] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reposAPI.commitDetail(owner, repo, sha).then(function(data) {
      setCommit(data)
    }).catch(function() { setCommit(null) }).finally(function() { setLoading(false) })
  }, [owner, repo, sha])

  if (loading) return <Box display="flex" justifyContent="center" py="60px"><Spinner size="lg" color="#22c55e" /></Box>
  if (!commit) return <Box textAlign="center" py="50px" color="#aaa"><FileDiff size={36} color="#ccc" mb="6px" /><Text fontSize="14px">{t('commitDetail.notFound')}</Text></Box>

  var hash = commit.hash || commit.sha || ''
  var message = commit.message || ''
  var author = commit.author || commit.author_name || ''
  var authorEmail = commit.author_email || ''
  var date = commit.date || commit.time || commit.created_at || ''
  var parents = commit.parents || []
  var files = commit.files || []

  return (
    <Box>
      <Flex align="center" gap="10px" mb="6px">
        <Text fontSize="18px" fontWeight="700" color="#333">{t('commitDetail.title')}</Text>
        <Badge fontSize="13px" px="10px" py="2px" rounded="6px" bg="#f0fdf4" color="#16a34a" fontFamily="monospace">{hash.substring(0, 12)}</Badge>
      </Flex>
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
        <Text fontSize="14px" fontWeight="600" color="#333" mb="10px" whiteSpace="pre-wrap">{message.split('\n')[0]}</Text>
        {message.split('\n').length > 1 && <Text fontSize="13px" color="#666" mb="10px" whiteSpace="pre-wrap">{message.split('\n').slice(1).join('\n').trim()}</Text>}
        <HStack gap="16px" fontSize="13px" color="#888">
          <HStack gap="4px"><User size={13} /><Text>{author}</Text></HStack>
          {authorEmail && <Text>{authorEmail}</Text>}
          <Text>{timeAgo(date)}</Text>
        </HStack>
        {parents.length > 0 && (
          <HStack gap="8px" mt="8px" fontSize="12.5px" color="#888">
            <Text>{t('commitDetail.parentCommit')}</Text>
            {parents.map(function(p, idx) {
              var parentHash = typeof p === 'string' ? p : (p.hash || p.sha || '')
              return (
                <Badge key={idx} fontSize="11px" px="6px" py="1px" rounded="4px" bg="#f3f4f6" color="#666"
                  fontFamily="monospace" cursor="pointer" _hover={{ bg: '#e5e7eb' }}
                  onClick={function() { navigate('/' + owner + '/' + repo + '/commits/' + parentHash) }}>
                  {parentHash.substring(0, 7)}
                </Badge>
              )
            })}
          </HStack>
        )}
      </Box>
      {files.length > 0 && <CommitDiffList owner={owner} repo={repo} sha={hash} files={files} />}
    </Box>
  )
}

// ─── IssueDetail ───────────────────────────────────────────────

const IssueDetail = () => {
  const { owner, repo, number } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { isGuest } = useAuth()
  const [issue, setIssue] = useState(null)
  const [comments, setComments] = useState([])
  const [allLabels, setAllLabels] = useState([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [updatingLabels, setUpdatingLabels] = useState(false)

  useEffect(() => {
    Promise.all([
      issuesAPI.get(owner, repo, number),
      issuesAPI.comments(owner, repo, number),
      labelsAPI.list(owner, repo).catch(function() { return [] }),
    ]).then(function([issueData, commentsData, labelsData]) {
      setIssue(issueData)
      setComments(Array.isArray(commentsData) ? commentsData : [])
      setAllLabels(Array.isArray(labelsData) ? labelsData : [])
    }).catch(function() { setIssue(null) }).finally(function() { setLoading(false) })
  }, [owner, repo, number])

  function handleComment() {
    if (!commentText.trim()) return
    setSubmitting(true)
    issuesAPI.createComment(owner, repo, number, { body: commentText }).then(function(newComment) {
      setComments(function(prev) { return prev.concat([newComment]) })
      setCommentText('')
    }).catch(function(err) {
      toast({ title: err.message || t('issue.commentFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  function handleToggleClose() {
    if (!issue) return
    issuesAPI.update(owner, repo, number, { is_closed: !issue.is_closed }).then(function(data) {
      setIssue(data)
    }).catch(function(err) {
      toast({ title: err.message || t('issue.operationFailed'), status: 'error', duration: 3000 })
    })
  }

  function handleToggleLabel(labelName) {
    if (!issue) return
    setUpdatingLabels(true)
    var currentLabels = (issue.labels || []).map(function(l) { return l.name || l })
    var newLabels = currentLabels.indexOf(labelName) >= 0
      ? currentLabels.filter(function(n) { return n !== labelName })
      : currentLabels.concat([labelName])
    issuesAPI.update(owner, repo, number, { labels: newLabels }).then(function(data) {
      setIssue(data)
    }).catch(function(err) {
      toast({ title: err.message || t('issue.updateLabelsFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setUpdatingLabels(false) })
  }

  if (loading) return <Box display="flex" justifyContent="center" py="60px"><Spinner size="lg" color="#22c55e" /></Box>
  if (!issue) return <Box textAlign="center" py="50px" color="#aaa"><TriangleAlert size={36} color="#ccc" mb="6px" /><Text fontSize="14px">{t('issue.notFound')}</Text></Box>

  var currentLabelNames = (issue.labels || []).map(function(l) { return l.name || l })

  return (
    <Box>
      <Flex justify="space-between" align="start" mb="16px">
        <Box flex={1}>
          <HStack gap="10px" mb="6px" align="center">
            {issue.is_closed
              ? <Badge fontSize="12px" px="8px" py="2px" rounded="4px" bg="#fef2f2" color="#dc2626">{t('issue.closed')}</Badge>
              : <Badge fontSize="12px" px="8px" py="2px" rounded="4px" bg="#dcfce7" color="#16a34a">{t('issue.open')}</Badge>}
            <Text fontSize="18px" fontWeight="700" color="#333">{issue.title}</Text>
          </HStack>
          <Text fontSize="13px" color="#888">
            #{issue.number} {t('issue.createdBy', { author: issue.author || t('common.unknownUser'), time: timeAgo(issue.created_at) })}
            {issue.assignee && ' · ' + t('issue.assignedTo') + ' ' + issue.assignee}
          </Text>
        </Box>
        <Button h="30px" px="14px" fontSize="13px" rounded="6px"
          bg={issue.is_closed ? '#22c55e' : '#dc2626'} color="white"
          _hover={{ bg: issue.is_closed ? '#16a34a' : '#b91c1c' }}
          onClick={handleToggleClose}>
          {issue.is_closed ? t('issue.reopenIssue') : t('issue.closeIssue')}
        </Button>
      </Flex>
      <Flex gap="20px" align="start">
        <Box flex={1}>
          {issue.body && (
            <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
              <Flex align="center" gap="8px" mb="10px">
                <Avatar size="sm" name={issue.author} bg="#22c55e" color="white" />
                <Text fontSize="13px" fontWeight="600" color="#333">{issue.author || t('common.unknownUser')}</Text>
                <Text fontSize="12px" color="#aaa">{t('issue.postedAt', { time: timeAgo(issue.created_at) })}</Text>
              </Flex>
              <Divider borderColor="#f0f0f0" mb="12px" />
              <SimpleRenderer source={issue.body} owner={owner} repo={repo} />
            </Box>
          )}
          <HStack gap="6px" mb="10px"><MessageSquare size={14} color="#333" /><Text fontSize="13px" fontWeight="600" color="#333">{t('issue.comments')} ({comments.length})</Text></HStack>
          <VStack spacing="10px" align="stretch" mb="16px">
            {comments.map(function(c) {
              return (
                <Box key={c.id} bg="white" border="1px solid" borderColor="#e2e2e2" rounded="8px" p="16px">
                  <Flex align="center" gap="8px" mb="8px">
                    <Avatar size="sm" name={c.author} bg="#22c55e" color="white" />
                    <Text fontSize="13px" fontWeight="600" color="#333">{c.author || t('common.unknownUser')}</Text>
                    <Text fontSize="12px" color="#aaa">{timeAgo(c.created_at)}</Text>
                  </Flex>
                  <Divider borderColor="#f0f0f0" mb="10px" />
                  <SimpleRenderer source={c.body} fontSize="13.5px" owner={owner} repo={repo} />
                </Box>
              )
            })}
          </VStack>
          <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="8px" p="16px">
            <SimpleEditor value={commentText} onChange={setCommentText} placeholder={t('issue.writeComment')} height={180} owner={owner} repo={repo} />
            <Flex justify="flex-end" mt="10px">
              <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
                _hover={{ bg: '#16a34a' }} onClick={handleComment} isLoading={submitting}
                isDisabled={!commentText.trim() || isGuest}>{t('issue.submitComment')}</Button>
            </Flex>
          </Box>
        </Box>
        <Box w="240px" flexShrink={0}>
          <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="8px" p="16px">
            <VStack spacing="12px" align="stretch">
              <Box>
                <Text fontSize="11px" fontWeight="600" color="#aaa" textTransform="uppercase" mb="4px">{t('issue.status')}</Text>
                <Badge fontSize="12px" px="8px" py="2px" rounded="4px"
                  bg={issue.is_closed ? '#fef2f2' : '#dcfce7'} color={issue.is_closed ? '#dc2626' : '#16a34a'}>
                  {issue.is_closed ? t('issue.closed') : t('issue.open')}
                </Badge>
              </Box>
              <Box>
                <Text fontSize="11px" fontWeight="600" color="#aaa" textTransform="uppercase" mb="4px">{t('issue.author')}</Text>
                <HStack gap="6px"><Avatar size="xs" name={issue.author} bg="#22c55e" color="white" /><Text fontSize="13px" color="#333">{issue.author || t('common.unknown')}</Text></HStack>
              </Box>
              {issue.assignee && (
                <Box>
                  <Text fontSize="11px" fontWeight="600" color="#aaa" textTransform="uppercase" mb="4px">{t('issue.assignedTo')}</Text>
                  <HStack gap="6px"><Avatar size="xs" name={issue.assignee} bg="#2563eb" color="white" /><Text fontSize="13px" color="#333">{issue.assignee}</Text></HStack>
                </Box>
              )}
              <Box>
                <Flex justify="space-between" align="center" mb="6px">
                  <Text fontSize="11px" fontWeight="600" color="#aaa" textTransform="uppercase">{t('issue.labels')}</Text>
                  <Button h="18px" px="4px" fontSize="10px" variant="link" color="#22c55e"
                    onClick={function() { setShowLabelPicker(!showLabelPicker) }}>{showLabelPicker ? t('common.collapse') : t('common.edit')}</Button>
                </Flex>
                {currentLabelNames.length > 0 && (
                  <VStack spacing="4px" align="start" mb="6px">
                    {issue.labels.map(function(label) {
                      return <Badge key={label.name || label} fontSize="11px" px="8px" py="2px" rounded="12px" bg={label.color || '#e5e7eb'} color={label.text_color || '#333'}>{label.name || label}</Badge>
                    })}
                  </VStack>
                )}
                {showLabelPicker && (
                  <Box border="1px solid" borderColor="#e2e2e2" rounded="6px" p="8px" maxH="160px" overflow="auto">
                    {allLabels.length > 0 ? allLabels.map(function(label) {
                      var name = label.name || label
                      var isActive = currentLabelNames.indexOf(name) >= 0
                      return (
                        <Flex key={name} align="center" gap="6px" py="4px" px="4px" cursor="pointer" rounded="4px" _hover={{ bg: '#f9fafb' }}
                          onClick={function() { handleToggleLabel(name) }}>
                          <Box w="14px" h="14px" rounded="3px" border="2px solid" borderColor={isActive ? '#22c55e' : '#d1d5db'} bg={isActive ? '#22c55e' : 'transparent'}
                            display="flex" alignItems="center" justifyContent="center">
                            {isActive && <Text fontSize="9px" color="white">✓</Text>}
                          </Box>
                          <Box w="10px" h="10px" rounded="2px" bg={label.color || '#e5e7eb'} />
                          <Text fontSize="12px" color="#333">{name}</Text>
                        </Flex>
                      )
                    }) : <Text fontSize="12px" color="#aaa" py="4px">{t('issue.noLabels')}</Text>}
                  </Box>
                )}
              </Box>
              <Box>
                <Text fontSize="11px" fontWeight="600" color="#aaa" textTransform="uppercase" mb="4px">{t('issue.createdAt')}</Text>
                <Text fontSize="12.5px" color="#666">{new Date(issue.created_at).toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US')}</Text>
              </Box>
              <Box>
                <Text fontSize="11px" fontWeight="600" color="#aaa" textTransform="uppercase" mb="4px">{t('issue.updatedAt')}</Text>
                <Text fontSize="12.5px" color="#666">{new Date(issue.updated_at).toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US')}</Text>
              </Box>
              {issue.is_locked && (
                <Box>
                  <Badge fontSize="11px" px="8px" py="2px" rounded="4px" bg="#fef3c7" color="#d97706">
                    <HStack gap="4px"><Lock size={11} /><Text>{t('issue.locked')}</Text></HStack>
                  </Badge>
                </Box>
              )}
            </VStack>
          </Box>
        </Box>
      </Flex>
    </Box>
  )
}

// ─── PRDetail ──────────────────────────────────────────────────

function shortHash_PRDetail(hash) { return hash ? hash.substring(0, 7) : '' }

var PR_STATUS_MAP = {
  open: { bg: '#dcfce7', color: '#16a34a' },
  closed: { bg: '#fef2f2', color: '#dc2626' },
}

const PRDetail = () => {
  const { owner, repo, number } = useParams()
  const navigate = useNavigate()
  const { isGuest, isAdmin, isUser, user } = useAuth()
  const [pr, setPr] = useState(null)
  const [prCommits, setPrCommits] = useState([])
  const [prFiles, setPrFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [isRepoOwner, setIsRepoOwner] = useState(false)

  useEffect(() => {
    prsAPI.get(owner, repo, number).then(function(data) { setPr(data) }).catch(function() { setPr(null) }).finally(function() { setLoading(false) })
  }, [owner, repo, number])

  useEffect(() => {
    reposAPI.get(owner, repo).then(function(data) {
      if (data && user) setIsRepoOwner(data.owner_id === user.id)
    }).catch(function() {})
  }, [owner, repo, user])

  function loadCommits() {
    prsAPI.commits(owner, repo, number).then(function(data) {
      setPrCommits(Array.isArray(data && data.commits ? data.commits : data) ? (data.commits || data) : [])
    }).catch(function() { setPrCommits([]) })
  }

  function loadFiles() {
    prsAPI.files(owner, repo, number).then(function(data) {
      setPrFiles(Array.isArray(data && data.files ? data.files : data) ? (data.files || data) : [])
    }).catch(function() { setPrFiles([]) })
  }

  function handleAction(action) {
    if (!pr) return
    setActionLoading(true)
    var fn = action === 'merge' ? prsAPI.merge : (action === 'close' ? prsAPI.close : prsAPI.reopen)
    fn(owner, repo, number).then(function(data) {
      if (data && data.mr) setPr(data.mr)
      else return prsAPI.get(owner, repo, number)
    }).then(function(data) {
      if (data) setPr(data)
    }).catch(function() {}).finally(function() { setActionLoading(false) })
  }

  if (loading) return <Box display="flex" justifyContent="center" py="60px"><Spinner size="lg" color="#22c55e" /></Box>
  if (!pr) return <Box textAlign="center" py="50px" color="#aaa"><GitPullRequest size={36} color="#ccc" mb="6px" /><Text fontSize="14px">{t('prDetail.notFound')}</Text></Box>

  var status = pr.is_closed ? 'closed' : 'open'
  var cfg = PR_STATUS_MAP[status] || PR_STATUS_MAP.open
  var statusLabel = status === 'open' ? t('common.open') : t('common.closed')

  return (
    <Box>
      <Flex justify="space-between" align="start" mb="16px">
        <Box flex={1}>
          <HStack gap="10px" mb="6px" align="center">
            <Badge fontSize="12px" px="8px" py="2px" rounded="4px" bg={cfg.bg} color={cfg.color}>{statusLabel}</Badge>
            <Text fontSize="18px" fontWeight="700" color="#333">{pr.title}</Text>
          </HStack>
          <Text fontSize="13px" color="#888">#{pr.number} {t('prDetail.createdBy', { author: pr.author || t('common.unknown'), time: timeAgo(pr.created_at) })}</Text>
          <HStack gap="8px" mt="6px" fontSize="13px">
            <Text color="#16a34a" fontWeight="500">{pr.source_branch}</Text>
            <Text color="#888">→</Text>
            <Text color="#dc2626" fontWeight="500">{pr.target_branch}</Text>
          </HStack>
        </Box>
        <HStack gap="8px">
          {status === 'open' && !isGuest && (
            <>
              {(isAdmin || isUser || isRepoOwner) && (
                <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#7c3aed" color="white"
                  _hover={{ bg: '#6d28d9' }} onClick={function() { handleAction('merge') }} isLoading={actionLoading}>{t('pr.merge')}</Button>
              )}
              <Button h="30px" px="14px" fontSize="13px" rounded="6px" variant="outline"
                borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#dc2626', color: '#dc2626' }}
                onClick={function() { handleAction('close') }} isLoading={actionLoading}>{t('pr.close')}</Button>
            </>
          )}
          {status === 'closed' && !pr.is_merged && !isGuest && (
            <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
              _hover={{ bg: '#16a34a' }} onClick={function() { handleAction('reopen') }} isLoading={actionLoading}>{t('pr.reopen')}</Button>
          )}
        </HStack>
      </Flex>
      {pr.body && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
          <Text fontSize="13.5px" color="#333" whiteSpace="pre-wrap" lineHeight="1.7">{pr.body}</Text>
        </Box>
      )}
      <Tabs colorScheme="green" mb="20px">
        <TabList borderColor="#e5e7eb">
          <Tab fontSize="13px" fontWeight="500" _selected={{ color: '#16a34a', borderColor: '#16a34a' }} onClick={loadCommits}>{t('pr.commits')}</Tab>
          <Tab fontSize="13px" fontWeight="500" _selected={{ color: '#16a34a', borderColor: '#16a34a' }} onClick={loadFiles}>{t('pr.filesChanged')}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <VStack spacing="0" align="stretch" border="1px solid" borderColor="#e2e2e2" rounded="8px" overflow="hidden">
              {prCommits.map(function(c, idx) {
                var hash = c.hash || c.sha || ''
                var message = c.message || c.subject || ''
                var author = c.author || c.author_name || ''
                return (
                  <Flex key={hash || idx} align="center" px="14px" py="10px"
                    borderBottom={idx < prCommits.length - 1 ? '1px solid' : 'none'} borderColor="#f0f0f0" _hover={{ bg: '#f9fafb' }}>
                    <Badge fontSize="11px" px="6px" py="1px" rounded="4px" bg="#f0fdf4" color="#16a34a" fontFamily="monospace" mr="10px">{shortHash_PRDetail(hash)}</Badge>
                    <Text fontSize="13px" color="#333" flex={1} noOfLines={1}>{message.split('\n')[0]}</Text>
                    <Text fontSize="12px" color="#888" ml="10px">{author}</Text>
                  </Flex>
                )
              })}
              {prCommits.length === 0 && <Text textAlign="center" py="20px" fontSize="13px" color="#aaa">{t('prDetail.clickToLoad')}</Text>}
            </VStack>
          </TabPanel>
          <TabPanel px={0}>
            <VStack spacing="0" align="stretch" border="1px solid" borderColor="#e2e2e2" rounded="8px" overflow="hidden">
              {prFiles.map(function(f, idx) {
                var name = f.filename || f.name || f.path || ''
                var additions = f.additions || f.added || 0
                var deletions = f.deletions || f.deleted || 0
                return (
                  <Flex key={name || idx} align="center" px="14px" py="10px"
                    borderBottom={idx < prFiles.length - 1 ? '1px solid' : 'none'} borderColor="#f0f0f0" _hover={{ bg: '#f9fafb' }}>
                    <Text fontSize="13px" color="#333" flex={1} fontFamily="monospace" noOfLines={1}>{name}</Text>
                    <HStack gap="8px" fontSize="12px">
                      {additions > 0 && <Text color="#16a34a">+{additions}</Text>}
                      {deletions > 0 && <Text color="#dc2626">-{deletions}</Text>}
                    </HStack>
                  </Flex>
                )
              })}
              {prFiles.length === 0 && <Text textAlign="center" py="20px" fontSize="13px" color="#aaa">{t('prDetail.clickToLoad')}</Text>}
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}

// ─── TaskDetail ────────────────────────────────────────────────

var TASK_DETAIL_STATUS = {
  draft: { labelKey: 'task.status.draft', bg: '#f3f4f6', color: '#666' },
  progress: { labelKey: 'task.status.progress', bg: '#dbeafe', color: '#2563eb' },
  review: { labelKey: 'task.status.review', bg: '#fef3c7', color: '#d97706' },
  completed: { labelKey: 'task.status.completed', bg: '#dcfce7', color: '#16a34a' },
}

var TASK_PRIORITY_COLORS = { 1: '#dc2626', 2: '#f97316', 3: '#eab308', 4: '#22c55e', 5: '#3b82f6' }

var NEXT_STATUS = { draft: 'progress', progress: 'review', review: 'completed' }

function getFileIcon(fileType) {
  if (!fileType) return <FileIcon size={14} color="#888" />
  if (fileType.indexOf('image') >= 0) return <ImageIcon size={14} color="#22c55e" />
  if (fileType.indexOf('pdf') >= 0) return <FileText size={14} color="#dc2626" />
  if (fileType.indexOf('word') >= 0 || fileType.indexOf('document') >= 0) return <FileText size={14} color="#2563eb" />
  return <FileIcon size={14} color="#888" />
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const TaskDetail = () => {
  const { owner, repo, id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { isGuest } = useAuth()
  const [task, setTask] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [availableIssues, setAvailableIssues] = useState([])
  const [showIssuePicker, setShowIssuePicker] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const fileInputRef = useRef(null)
  const cancelRef = useRef()

  useEffect(() => {
    tasksAPI.get(owner, repo, id).then(function(data) { setTask(data) }).catch(function() { setTask(null) }).finally(function() { setLoading(false) })
    tasksAPI.comments(owner, repo, id).then(function(data) { setComments(Array.isArray(data) ? data : []) }).catch(function() { setComments([]) })
  }, [owner, repo, id])

  function refreshTask() { tasksAPI.get(owner, repo, id).then(function(data) { setTask(data) }) }

  function handleTransition() {
    if (!task) return
    var nextStatus = NEXT_STATUS[task.status]
    if (!nextStatus) return
    setSubmitting(true)
    tasksAPI.transition(owner, repo, id, { to_status: nextStatus }).then(function() {
      return tasksAPI.get(owner, repo, id)
    }).then(function(data) { setTask(data) }).catch(function() {}).finally(function() { setSubmitting(false) })
  }

  function handleComment() {
    if (!commentText.trim()) return
    setSubmitting(true)
    tasksAPI.createComment(owner, repo, id, { body: commentText }).then(function(newComment) {
      setComments(function(prev) { return prev.concat([newComment]) })
      setCommentText('')
    }).catch(function() {}).finally(function() { setSubmitting(false) })
  }

  function handleFileUpload(e) {
    var files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    var promises = Array.from(files).map(function(file) { return tasksAPI.uploadAttachment(owner, repo, id, file) })
    Promise.all(promises).then(function() {
      toast({ title: t('task.attachmentUploaded'), status: 'success', duration: 2000 })
      refreshTask()
    }).catch(function(err) {
      toast({ title: err.message || t('task.uploadFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' })
  }

  function handleDeleteAttachment() {
    if (!deleteTarget) return
    tasksAPI.deleteAttachment(owner, repo, id, deleteTarget.id).then(function() {
      toast({ title: t('task.attachmentDeleted'), status: 'success', duration: 2000 })
      refreshTask()
    }).catch(function(err) {
      toast({ title: err.message || t('task.deleteFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setDeleteTarget(null) })
  }

  function handleLinkIssue(issueId) {
    tasksAPI.linkIssue(owner, repo, id, issueId).then(function() {
      toast({ title: t('task.issueLinked'), status: 'success', duration: 2000 })
      refreshTask()
    }).catch(function(err) { toast({ title: err.message || t('task.linkFailed'), status: 'error', duration: 3000 }) })
  }

  function handleUnlinkIssue(issueId) {
    tasksAPI.unlinkIssue(owner, repo, id, issueId).then(function() {
      toast({ title: t('task.issueUnlinked'), status: 'success', duration: 2000 })
      refreshTask()
    }).catch(function(err) { toast({ title: err.message || t('task.unlinkFailed'), status: 'error', duration: 3000 }) })
  }

  function openIssuePicker() {
    if (availableIssues.length > 0) { setShowIssuePicker(!showIssuePicker); return }
    issuesAPI.list(owner, repo, { state: 'open', per_page: 50 }).then(function(data) {
      var items = Array.isArray(data) ? data : (data && data.items ? data.items : [])
      setAvailableIssues(items)
      setShowIssuePicker(true)
    }).catch(function() { setAvailableIssues([]) })
  }

  if (loading) return <Box display="flex" justifyContent="center" py="60px"><Spinner size="lg" color="#22c55e" /></Box>
  if (!task) return <Box textAlign="center" py="50px" color="#aaa"><ClipboardList size={36} color="#ccc" mb="6px" /><Text fontSize="14px">{t('task.notFound')}</Text></Box>

  var cfg = TASK_DETAIL_STATUS[task.status] || TASK_DETAIL_STATUS.draft
  var priorityColor = TASK_PRIORITY_COLORS[task.priority] || '#888'
  var nextStatus = NEXT_STATUS[task.status]
  var linkedIssueIds = (task.issues || []).map(function(i) { return i.id })

  return (
    <Box>
      <Flex justify="space-between" align="start" mb="16px">
        <Box flex={1}>
          <HStack gap="10px" mb="6px" align="center">
            <Badge fontSize="12px" px="8px" py="2px" rounded="4px" bg={cfg.bg} color={cfg.color}>{t(cfg.labelKey)}</Badge>
            <Text fontSize="18px" fontWeight="700" color="#333">{task.title}</Text>
          </HStack>
          <HStack gap="14px" fontSize="13px" color="#888" mt="6px">
            <HStack gap="4px"><Box w="8px" h="8px" rounded="full" bg={priorityColor} /><Text>P{task.priority}</Text></HStack>
            {task.initiator && <HStack gap="4px"><User size={13} /><Text>{task.initiator}</Text></HStack>}
            {task.handler && <HStack gap="4px"><Wrench size={13} /><Text>{task.handler}</Text></HStack>}
            {task.verifier && <HStack gap="4px"><CheckCircle2 size={13} /><Text>{task.verifier}</Text></HStack>}
            <Text>{timeAgo(task.created_at)}</Text>
          </HStack>
        </Box>
        {nextStatus && (
          <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleTransition} isLoading={submitting} isDisabled={isGuest}>
            {t('task.transitionTo', { status: t(TASK_DETAIL_STATUS[nextStatus].labelKey) })}
          </Button>
        )}
      </Flex>

      {task.goal && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="8px">{t('task.goal')}</Text>
          <SimpleRenderer source={task.goal} owner={owner} repo={repo} />
        </Box>
      )}
      {task.draft && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="8px">{t('task.draftOrPlan')}</Text>
          <SimpleRenderer source={task.draft} owner={owner} repo={repo} />
        </Box>
      )}
      {task.schedules && task.schedules.length > 0 && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="10px">{t('task.schedules')}</Text>
          <VStack spacing="8px" align="stretch">
            {task.schedules.map(function(s, idx) {
              return (
                <Flex key={s.id || idx} justify="space-between" align="center" fontSize="13px">
                  <Badge fontSize="11px" px="6px" py="1px" rounded="4px" bg="#eff6ff" color="#2563eb">{s.schedule_type || t('task.schedule')}</Badge>
                  <Text color="#666">{s.plan_start_date || t('common.pending')} ~ {s.plan_end_date || t('common.pending')}</Text>
                  <HStack gap="8px" fontSize="12px" color="#888">{s.user1 && <Text>{s.user1}</Text>}{s.user2 && <Text>{s.user2}</Text>}</HStack>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
        <Flex justify="space-between" align="center" mb="10px">
          <HStack gap="6px"><LinkIcon size={14} color="#555" /><Text fontSize="13px" fontWeight="600" color="#555">{t('task.linkedIssues')}</Text>
            {(task.issues && task.issues.length > 0) && <Badge fontSize="11px" px="6px" py="1px" rounded="8px" bg="#eff6ff" color="#2563eb">{task.issues.length}</Badge>}
          </HStack>
          <Button h="22px" px="8px" fontSize="11px" variant="outline" borderColor="#d1d5db" color="#666" onClick={openIssuePicker}>
            {showIssuePicker ? t('common.collapse') : t('common.linkIssue')}
          </Button>
        </Flex>
        {task.issues && task.issues.length > 0 && (
          <VStack spacing="6px" align="stretch" mb="8px">
            {task.issues.map(function(issue) {
              return (
                <Flex key={issue.id} align="center" gap="8px" fontSize="13px" py="4px" px="8px" rounded="6px" _hover={{ bg: '#f9fafb' }}>
                  <Text color="#888">#{issue.number}</Text>
                  <Text color="#333" flex={1} cursor="pointer" _hover={{ color: '#16a34a' }}
                    onClick={function() { navigate('/' + owner + '/' + repo + '/issues/' + issue.number) }}>{issue.title}</Text>
                  <Badge fontSize="10px" px="5px" py="1px" rounded="4px"
                    bg={issue.status === 'closed' ? '#f3f4f6' : '#dcfce7'} color={issue.status === 'closed' ? '#666' : '#16a34a'}>
                    {issue.status === 'closed' ? t('common.closed') : t('common.open')}
                  </Badge>
                  <Box as="span" cursor="pointer" color="#aaa" _hover={{ color: '#dc2626' }} onClick={function() { handleUnlinkIssue(issue.id) }}><X size={13} /></Box>
                </Flex>
              )
            })}
          </VStack>
        )}
        {(!task.issues || task.issues.length === 0) && !showIssuePicker && <Text fontSize="12px" color="#aaa">{t('common.noLinkedIssues')}</Text>}
        {showIssuePicker && (
          <Box border="1px solid" borderColor="#e2e2e2" rounded="8px" maxH="200px" overflow="auto">
            {availableIssues.filter(function(i) { return linkedIssueIds.indexOf(i.id) < 0 }).length > 0
              ? availableIssues.filter(function(i) { return linkedIssueIds.indexOf(i.id) < 0 }).map(function(issue) {
                return (
                  <Flex key={issue.id} align="center" gap="8px" px="12px" py="8px" cursor="pointer" _hover={{ bg: '#f9fafb' }}
                    onClick={function() { handleLinkIssue(issue.id) }} borderBottom="1px solid" borderColor="#f0f0f0">
                    <Text fontSize="12px" color="#888">#{issue.number}</Text>
                    <Text fontSize="12.5px" color="#333" flex={1} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{issue.title}</Text>
                    <Text fontSize="11px" color="#22c55e">+ {t('common.link')}</Text>
                  </Flex>
                )
              })
              : <Text fontSize="12px" color="#aaa" py="12px" textAlign="center">{t('common.noLinkableIssues')}</Text>}
          </Box>
        )}
      </Box>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
        <Flex justify="space-between" align="center" mb="10px">
          <HStack gap="6px"><Paperclip size={14} color="#555" /><Text fontSize="13px" fontWeight="600" color="#555">{t('task.attachments')}</Text>
            {(task.attachments && task.attachments.length > 0) && <Badge fontSize="11px" px="6px" py="1px" rounded="8px" bg="#fef3c7" color="#d97706">{task.attachments.length}</Badge>}
          </HStack>
          <Button h="22px" px="8px" fontSize="11px" leftIcon={<Upload size={11} />} variant="outline" borderColor="#d1d5db" color="#666"
            onClick={function() { fileInputRef.current && fileInputRef.current.click() }} isLoading={uploading}>{t('task.uploadAttachment')}</Button>
        </Flex>
        <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" style={{ display: 'none' }} onChange={handleFileUpload} />
        {task.attachments && task.attachments.length > 0 && (
          <VStack spacing="4px" align="stretch">
            {task.attachments.map(function(a) {
              return (
                <Flex key={a.id} align="center" gap="8px" fontSize="13px" py="6px" px="8px" rounded="6px" _hover={{ bg: '#f9fafb' }}>
                  {getFileIcon(a.file_type)}
                  <Text color="#16a34a" cursor="pointer" _hover={{ textDecoration: 'underline' }} flex={1}>{a.file_name}</Text>
                  <Text color="#aaa" fontSize="12px">{formatFileSize(a.file_size)}</Text>
                  <Box as="span" cursor="pointer" color="#aaa" _hover={{ color: '#dc2626' }} onClick={function() { setDeleteTarget(a) }}><Trash2 size={13} /></Box>
                </Flex>
              )
            })}
          </VStack>
        )}
        {(!task.attachments || task.attachments.length === 0) && <Text fontSize="12px" color="#aaa">{t('task.noAttachments')}</Text>}
      </Box>

      <HStack gap="6px" mb="10px"><MessageSquare size={14} color="#333" /><Text fontSize="13px" fontWeight="600" color="#333">{t('task.comments')} ({comments.length})</Text></HStack>
      <VStack spacing="10px" align="stretch" mb="16px">
        {comments.map(function(c) {
          return (
            <Box key={c.id} bg="white" border="1px solid" borderColor="#e2e2e2" rounded="8px" p="16px">
              <Flex align="center" gap="8px" mb="8px">
                <Text fontSize="13px" fontWeight="600" color="#333">{c.author || t('common.unknown')}</Text>
                <Text fontSize="12px" color="#aaa">{timeAgo(c.created_at)}</Text>
              </Flex>
              <SimpleRenderer source={c.body} fontSize="13.5px" owner={owner} repo={repo} />
            </Box>
          )
        })}
      </VStack>
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="8px" p="16px">
        <SimpleEditor value={commentText} onChange={setCommentText} placeholder={t('issue.writeComment')} height={160} owner={owner} repo={repo} />
        <Flex justify="flex-end" mt="10px">
          <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleComment} isLoading={submitting}
            isDisabled={!commentText.trim() || isGuest}>{t('issue.submitComment')}</Button>
        </Flex>
      </Box>

      <AlertDialog isOpen={!!deleteTarget} leastDestructiveRef={cancelRef} onClose={function() { setDeleteTarget(null) }}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="15px" fontWeight="600">{t('task.confirmDelete')}</AlertDialogHeader>
            <AlertDialogBody fontSize="14px">{t('task.confirmDeleteAttachment', { name: deleteTarget && deleteTarget.file_name })}</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={function() { setDeleteTarget(null) }} h="32px" fontSize="13px">{t('common.cancel')}</Button>
              <Button colorScheme="red" onClick={handleDeleteAttachment} h="32px" fontSize="13px" ml={3}>{t('common.delete')}</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  )
}

// ─── exports ───────────────────────────────────────────────────



// ─── ProjectSettings ───

function formatIntervalLabel(seconds) {
  if (!seconds || seconds === 0) return t('common.manual')
  var h = Math.floor(seconds / 3600)
  var m = Math.floor((seconds % 3600) / 60)
  if (h > 0 && m > 0) return h + ' ' + t('common.hour') + ' ' + m + ' ' + t('common.minute')
  if (h > 0) return h + ' ' + t('common.hour')
  if (m > 0) return m + ' ' + t('common.minute')
  return seconds + ' ' + t('common.second')
}

function secondsToHM(seconds) {
  var s = seconds || 0
  return { hours: Math.floor(s / 3600), minutes: Math.floor((s % 3600) / 60) }
}

function hmToSeconds(hours, minutes) {
  return (hours || 0) * 3600 + (minutes || 0) * 60
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  try {
    var d = new Date(dateStr)
    if (d.getFullYear() < 2) return '-'
    return d.toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  } catch (e) {
    return dateStr
  }
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '-'
  if (ms < 1000) return ms + ' ms'
  return (ms / 1000).toFixed(1) + ' ' + t('common.second')
}

const ProjectSettings = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { isGuest, isAdmin, isUser, user } = useAuth()
  const [repoInfo, setRepoInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState({ pull: false, issues: false, push: false })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTarget, setTransferTarget] = useState('')
  const [transferring, setTransferring] = useState(false)
  const cancelRef = useRef()
  const transferCancelRef = useRef()
  const [form, setForm] = useState({ name: '', description: '', homepage: '', project_type: 'local', default_branch: '' })

  const [syncConfig, setSyncConfig] = useState(null)
  const [syncSaving, setSyncSaving] = useState(false)
  const [syncLogs, setSyncLogs] = useState([])
  const [remoteUrl, setRemoteUrl] = useState('')

  useEffect(() => {
    reposAPI.get(owner, repo).then(function(data) {
      setRepoInfo(data)
      setRemoteUrl(data.mirror_url || '')
      setForm({
        name: data.name || '',
        description: data.description || '',
        homepage: data.homepage || '',
        project_type: data.project_type || 'local',
        default_branch: data.default_branch || 'main',
      })
    }).catch(function() { setRepoInfo(null) }).finally(function() { setLoading(false) })
  }, [owner, repo])

  useEffect(function() {
    reposAPI.getSyncConfig(owner, repo).then(function(data) {
      setSyncConfig(data)
    }).catch(function() { setSyncConfig(null) })
    reposAPI.getSyncLogs(owner, repo).then(function(data) {
      setSyncLogs(data.logs || [])
    }).catch(function() { setSyncLogs([]) })
  }, [owner, repo])

  function updateField(key) {
    return function(e) {
      var val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm(function(prev) { return Object.assign({}, prev, { [key]: val }) })
    }
  }

  function handleSave() {
    setSaving(true)
    var payload = Object.assign({}, form, { mirror_url: remoteUrl })
    reposAPI.update(owner, repo, payload).then(function() {
      toast({ title: t('projectSettings.settingsSaved'), status: 'success', duration: 3000 })
      if (form.name !== repo) {
        navigate('/' + owner + '/' + form.name + '/settings')
      }
    }).catch(function(err) {
      toast({ title: err.message || t('projectSettings.saveFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSaving(false) })
  }

  function handleSyncPull() {
    setSyncing(function(p) { return Object.assign({}, p, { pull: true }) })
    reposAPI.syncPull(owner, repo).then(function() {
      toast({ title: t('projectSettings.pullCodeStarted'), status: 'success', duration: 3000 })
    }).catch(function(err) {
      toast({ title: err.message || t('projectSettings.syncFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSyncing(function(p) { return Object.assign({}, p, { pull: false }) }) })
  }

  function handleSyncIssues() {
    setSyncing(function(p) { return Object.assign({}, p, { issues: true }) })
    var beforeLogID = 0
    reposAPI.getSyncLogs(owner, repo).then(function(data) {
      var logs = data.logs || []
      if (logs.length > 0) {
        beforeLogID = logs[0].id || 0
      }
    }).catch(function() {}).then(function() {
      return reposAPI.syncIssues(owner, repo)
    }).then(function() {
      toast({ title: t('projectSettings.syncStarted'), status: 'info', duration: 3000 })
      var pollCount = 0
      var pollTimer = setInterval(function() {
        pollCount++
        if (pollCount > 100) {
          clearInterval(pollTimer)
          setSyncing(function(p) { return Object.assign({}, p, { issues: false }) })
          return
        }
        reposAPI.getSyncLogs(owner, repo).then(function(data) {
          var logs = data.logs || []
          setSyncLogs(logs)
          for (var i = 0; i < logs.length; i++) {
            var log = logs[i]
            if (log.id <= beforeLogID) break
            if (log.status === 'success') {
              clearInterval(pollTimer)
              setSyncing(function(p) { return Object.assign({}, p, { issues: false }) })
              var count = log.items_synced || 0
              if (count > 0) {
                toast({ title: t('projectSettings.issuesSyncResult', { count: count }), status: 'success', duration: 3000 })
              } else {
                toast({ title: t('projectSettings.issuesSyncStarted'), status: 'success', duration: 3000 })
              }
              return
            } else if (log.status === 'failure') {
              clearInterval(pollTimer)
              setSyncing(function(p) { return Object.assign({}, p, { issues: false }) })
              toast({ title: t('projectSettings.syncFailed'), status: 'error', duration: 3000 })
              return
            }
          }
        }).catch(function() {})
      }, 3000)
    }).catch(function(err) {
      toast({ title: err.message || t('projectSettings.syncFailed'), status: 'error', duration: 3000 })
      setSyncing(function(p) { return Object.assign({}, p, { issues: false }) })
    })
  }

  function handleSyncPush() {
    var pushUrl = remoteUrl || (repoInfo && repoInfo.mirror_url) || ''
    if (!pushUrl) {
      toast({ title: t('projectSettings.remoteUrlRequired'), status: 'warning', duration: 3000 })
      return
    }
    setSyncing(function(p) { return Object.assign({}, p, { push: true }) })
    reposAPI.syncPush(owner, repo, pushUrl).then(function() {
      toast({ title: t('projectSettings.pushSyncStarted'), status: 'success', duration: 3000 })
    }).catch(function(err) {
      toast({ title: err.message || t('projectSettings.syncFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSyncing(function(p) { return Object.assign({}, p, { push: false }) }) })
  }

  function handleDelete() {
    setDeleting(true)
    reposAPI.del(owner, repo).then(function() {
      setDeleteOpen(false)
      navigate('/projects')
    }).catch(function(err) {
      toast({ title: err.message || t('projectSettings.deleteRepoFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setDeleting(false) })
  }

  function handleTransfer() {
    if (!transferTarget.trim()) return
    setTransferring(true)
    reposAPI.transfer(owner, repo, transferTarget.trim()).then(function() {
      setTransferOpen(false)
      setTransferTarget('')
      toast({ title: t('projectSettings.transferSuccess'), status: 'success', duration: 3000 })
      navigate('/projects')
    }).catch(function(err) {
      toast({ title: err.message || t('projectSettings.transferFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setTransferring(false) })
  }

  function handleSyncConfigSave() {
    setSyncSaving(true)
    reposAPI.updateSyncConfig(owner, repo, {
      sync_interval: syncConfig.sync_interval,
      is_paused: syncConfig.is_paused,
    }).then(function(data) {
      setSyncConfig(data)
      toast({ title: t('projectSettings.syncConfigSaved'), status: 'success', duration: 3000 })
    }).catch(function(err) {
      toast({ title: err.message || t('projectSettings.saveFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSyncSaving(false) })
  }

  function handleRefreshLogs() {
    reposAPI.getSyncLogs(owner, repo).then(function(data) {
      setSyncLogs(data.logs || [])
    }).catch(function() {})
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  var isMirror = repoInfo && repoInfo.project_type === 'mirror'
  var isPublic = repoInfo && repoInfo.project_type === 'public'
  var isPrivate = repoInfo && repoInfo.project_type === 'private'
  var isLocal = repoInfo && repoInfo.project_type === 'local'
  var isRemote = isMirror || isPublic || isPrivate
  var canPushRemote = isPublic || isPrivate
  var isRepoOwner = repoInfo && user && repoInfo.owner_id === user.id
  var canManage = isLocal ? !isGuest : (isAdmin || isUser || isRepoOwner)

  return (
    <Box>
      <HStack gap="8px" mb="20px">
        <Settings size={18} color="#333" />
        <Text fontSize="18px" fontWeight="700" color="#333">{t('projectSettings.title')}</Text>
      </HStack>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
        <Text fontSize="15px" fontWeight="600" color="#333" mb="16px">{t('projectSettings.generalSettings')}</Text>

        <Box mb="14px">
          <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('projectSettings.projectName')}</Text>
          <Input value={form.name} onChange={updateField('name')}
            h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="14px">
          <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('projectSettings.description')}</Text>
          <Textarea value={form.description} onChange={updateField('description')}
            fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={3}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="14px">
          <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('projectSettings.homepage')}</Text>
          <Input value={form.homepage} onChange={updateField('homepage')}
            h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            placeholder="https://example.com"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="14px">
          <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('projectSettings.defaultBranch')}</Text>
          <Input value={form.default_branch} onChange={updateField('default_branch')}
            h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Flex align="center" justify="space-between" mb="16px" py="10px" borderBottom="1px solid" borderColor="#f0f0f0">
          <Box>
            <Text fontSize="13px" fontWeight="500" color="#555">{t('projectSettings.projectType')}</Text>
            <Text fontSize="12px" color="#888">
              {isMirror ? t('projectSettings.mirrorProjectDesc')
                : isPublic ? t('projectSettings.publicProjectDesc')
                : isPrivate ? t('projectSettings.privateProjectDesc')
                : t('projectSettings.localProjectDesc')}
            </Text>
          </Box>
          <HStack gap="6px">
            {(function() {
              var currentType = repoInfo.project_type || 'local'
              var allowedTypes
              if (currentType === 'local') {
                allowedTypes = ['local']
              } else if (currentType === 'mirror') {
                allowedTypes = ['mirror', 'public', 'private']
              } else {
                allowedTypes = ['public', 'private']
              }
              return allowedTypes.map(function(pt) {
                var labelMap = { mirror: 'project.mirror', public: 'project.public', private: 'project.private', local: 'common.local' }
                var colorMap = { mirror: '#2563eb', public: '#16a34a', private: '#ea580c', local: '#6b7280' }
                var selected = form.project_type === pt
                return (
                  <Box key={pt} as="button" px="10px" py="4px" fontSize="12px" fontWeight="500" rounded="6px"
                    border="1px solid" cursor="pointer" transition="all 0.15s"
                    borderColor={selected ? colorMap[pt] : '#d1d5db'}
                    bg={selected ? (pt === 'mirror' ? '#eff6ff' : pt === 'public' ? '#f0fdf4' : pt === 'private' ? '#fff7ed' : '#f3f4f6') : 'white'}
                    color={selected ? colorMap[pt] : '#888'}
                    _hover={{ borderColor: colorMap[pt] }}
                    onClick={function() { setForm(function(p) { return Object.assign({}, p, { project_type: pt }) }) }}
                  >
                    {t(labelMap[pt])}
                  </Box>
                )
              })
            })()}
          </HStack>
        </Flex>

        <Button h="36px" px="20px" fontSize="14px" rounded="6px" bg="#22c55e" color="white"
          _hover={{ bg: '#16a34a' }} onClick={handleSave} isLoading={saving} isDisabled={isGuest}>
          {t('projectSettings.saveChanges')}
        </Button>
      </Box>

      {isRemote && (<>
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
        <Text fontSize="15px" fontWeight="600" color="#333" mb="12px">{t('projectSettings.scheduledSync')}</Text>
        <Text fontSize="13px" color="#666" mb="16px">
          {t('projectSettings.scheduledSyncMirrorDesc')}
        </Text>

        {syncConfig ? (
          <>
            <Box mb="14px">
              <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('projectSettings.syncInterval')}</Text>
              <HStack gap="8px">
                <Input type="number" value={secondsToHM(syncConfig.sync_interval).hours}
                  h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db" w="80px"
                  min={0} max={999}
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }}
                  onChange={function(e) {
                    var val = parseInt(e.target.value) || 0
                    if (val < 0) val = 0
                    if (val > 999) val = 999
                    var m = secondsToHM(syncConfig.sync_interval).minutes
                    setSyncConfig(Object.assign({}, syncConfig, { sync_interval: hmToSeconds(val, m) }))
                  }} />
                <Text fontSize="14px" color="#555">{t('common.hour')}</Text>
                <Input type="number" value={secondsToHM(syncConfig.sync_interval).minutes}
                  h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db" w="80px"
                  min={0} max={59}
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }}
                  onChange={function(e) {
                    var val = parseInt(e.target.value) || 0
                    if (val < 0) val = 0
                    if (val > 59) val = 59
                    var h = secondsToHM(syncConfig.sync_interval).hours
                    setSyncConfig(Object.assign({}, syncConfig, { sync_interval: hmToSeconds(h, val) }))
                  }} />
                <Text fontSize="14px" color="#555">{t('common.minute')}</Text>
              </HStack>
              <Text fontSize="12px" color="#999" mt="4px">{t('projectSettings.syncIntervalHint')}</Text>
            </Box>

            {syncConfig.sync_interval > 0 && (
              <Flex align="center" justify="space-between" py="10px" borderBottom="1px solid" borderColor="#f0f0f0" mb="14px">
                <Box>
                  <Text fontSize="13px" fontWeight="500" color="#555">{t('projectSettings.enableScheduledSync')}</Text>
                  <Text fontSize="12px" color="#888">{syncConfig.is_paused ? t('projectSettings.currentlyPaused') : t('projectSettings.currentlyRunning')}</Text>
                </Box>
                <Switch colorScheme="green" isChecked={!syncConfig.is_paused}
                  onChange={function(e) {
                    setSyncConfig(Object.assign({}, syncConfig, { is_paused: !e.target.checked }))
                  }} />
              </Flex>
            )}

            <Box mb="16px" fontSize="12px" color="#888">
              <Flex align="center" gap="6px" mb="6px">
                <Clock size={13} />
                <Text>{t('projectSettings.lastSync')}: {syncConfig.last_sync_at ? timeAgo(syncConfig.last_sync_at) : t('projectSettings.never')}</Text>
              </Flex>
              {syncConfig.sync_interval > 0 && !syncConfig.is_paused && syncConfig.next_sync_at && (
                <Flex align="center" gap="6px" mb="6px">
                  <RefreshCw size={13} />
                  <Text>{t('projectSettings.nextSync')}: {timeAgo(syncConfig.next_sync_at)}</Text>
                </Flex>
              )}
              {syncConfig.last_error && (
                <Flex align="center" gap="6px" color="#dc2626">
                  <XCircle size={13} />
                  <Text>{t('projectSettings.recentError')}: {syncConfig.last_error}</Text>
                </Flex>
              )}
            </Box>

            <Button h="36px" px="20px" fontSize="14px" rounded="6px" bg="#22c55e" color="white"
              _hover={{ bg: '#16a34a' }} onClick={handleSyncConfigSave} isLoading={syncSaving} isDisabled={isGuest}>
              {t('projectSettings.saveSyncConfig')}
            </Button>
          </>
        ) : (
          <Text fontSize="13px" color="#aaa">{t('projectSettings.loadingSyncConfig')}</Text>
        )}
      </Box>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
        <Flex align="center" justify="space-between" mb="12px">
          <Text fontSize="15px" fontWeight="600" color="#333">{t('projectSettings.syncLogs')}</Text>
          <Button h="26px" px="10px" fontSize="12px" rounded="4px" variant="ghost"
            color="#888" _hover={{ color: '#16a34a' }}
            onClick={handleRefreshLogs}>
            <RefreshCw size={13} />
          </Button>
        </Flex>

        {syncLogs.length === 0 ? (
          <Text fontSize="13px" color="#aaa">{t('projectSettings.noSyncLogs')}</Text>
        ) : (
          <VStack spacing="0" align="stretch">
            {syncLogs.map(function(log, idx) {
              var isSuccess = log.status === 'success'
              var isRunning = log.status === 'running'
              var statusIcon = isSuccess
                ? <CheckCircle size={14} color="#16a34a" />
                : isRunning
                  ? <Spinner size="xs" color="#3b82f6" />
                  : <XCircle size={14} color="#dc2626" />
              var statusText = isSuccess
                ? t('projectSettings.success')
                : isRunning
                  ? t('projectSettings.currentlyRunning')
                  : t('projectSettings.failed')
              return (
                <Flex key={log.id || idx} align="center" justify="space-between"
                  py="10px" borderBottom={idx < syncLogs.length - 1 ? '1px solid' : 'none'}
                  borderColor="#f0f0f0">
                  <Flex align="center" gap="8px">
                    {statusIcon}
                    <Box>
                      <Text fontSize="13px" color="#333" fontWeight="500">
                        {log.sync_type === 'mirror' ? t('projectSettings.mirrorSync') : t('projectSettings.statsRefresh')}
                        {' '}{statusText}
                      </Text>
                      {log.message && (
                        <Text fontSize="12px" color="#888" noOfLines={1}>{log.message}</Text>
                      )}
                    </Box>
                  </Flex>
                  <Flex align="center" gap="12px" fontSize="12px" color="#888">
                    <Text>{formatDuration(log.duration)}</Text>
                    <Text>{formatDateTime(log.created_at)}</Text>
                  </Flex>
                </Flex>
              )
            })}
          </VStack>
        )}
      </Box>
      </>)}

      {isRemote && (
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
        <Text fontSize="15px" fontWeight="600" color="#333" mb="12px">{t('projectSettings.codeSync')}</Text>
        <Text fontSize="13px" color="#666" mb="14px">
          {t('projectSettings.codeSyncDesc')}
        </Text>
        <Box mb="14px">
          <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('projectSettings.remoteUrlLabel')}</Text>
          <Input value={remoteUrl} onChange={function(e) { setRemoteUrl(e.target.value) }}
            placeholder={t('projectSettings.remoteUrlPlaceholder')}
            h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        <HStack gap="10px" flexWrap="wrap">
          {isRemote && (
            <Button h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline"
              borderColor="#22c55e" color="#16a34a" _hover={{ bg: '#f0fdf4' }}
              onClick={handleSyncPull} isLoading={syncing.pull} isDisabled={isGuest}>
              {t('projectSettings.pullCode')}
            </Button>
          )}
          {isRemote && (
            <Button h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline"
              borderColor="#3b82f6" color="#2563eb" _hover={{ bg: '#eff6ff' }}
              onClick={handleSyncIssues} isLoading={syncing.issues} isDisabled={isGuest}>
              {t('projectSettings.pullIssues')}
            </Button>
          )}
          {canPushRemote && (
            <Button h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline"
              borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
              onClick={handleSyncPush} isLoading={syncing.push} isDisabled={isGuest}>
              {t('projectSettings.pushToRemote')}
            </Button>
          )}
        </HStack>
      </Box>
      )}

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px" mb="20px">
        <Text fontSize="15px" fontWeight="600" color="#333" mb="12px">{t('projectSettings.statsRefreshSection')}</Text>
        <Text fontSize="13px" color="#666" mb="14px">{t('projectSettings.statsRefreshDesc')}</Text>
        <Button h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline"
          borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
          onClick={function() {
            reposAPI.refreshStats(owner, repo).then(function() {
              toast({ title: t('projectSettings.statsRefreshed'), status: 'success', duration: 3000 })
            }).catch(function(err) {
              toast({ title: err.message || t('projectSettings.refreshFailed'), status: 'error', duration: 3000 })
            })
          }} isDisabled={isGuest}>
          {t('projectSettings.refreshStats')}
        </Button>
      </Box>

      <Box bg="white" border="1px solid" borderColor="#fecaca" rounded="10px" p="24px">
        <Text fontSize="15px" fontWeight="600" color="#dc2626" mb="8px">{t('projectSettings.dangerZone')}</Text>
        <Text fontSize="13px" color="#666" mb="14px">{t('projectSettings.dangerZoneDesc')}</Text>

        {isRemote && (
          <Flex align="center" justify="space-between" mb="14px" py="10px" borderBottom="1px solid" borderColor="#fecaca">
            <Box>
              <Text fontSize="13px" fontWeight="500" color="#555">{t('projectSettings.transferOwnership')}</Text>
              <Text fontSize="12px" color="#888">{t('projectSettings.transferDesc')}</Text>
            </Box>
            <Button h="30px" px="14px" fontSize="13px" rounded="6px" variant="outline"
              borderColor="#f59e0b" color="#d97706" _hover={{ bg: '#fffbeb' }}
              onClick={function() { setTransferTarget(''); setTransferOpen(true) }} isDisabled={!canManage}>
              {t('projectSettings.transferProject')}
            </Button>
          </Flex>
        )}

        <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#dc2626" color="white"
          _hover={{ bg: '#b91c1c' }} onClick={function() { setDeleteConfirm(''); setDeleteOpen(true) }} isDisabled={!canManage}>
          {t('projectSettings.deleteProject')}
        </Button>
      </Box>

      <AlertDialog isOpen={transferOpen} leastDestructiveRef={transferCancelRef} onClose={function() { setTransferOpen(false) }}>
        <AlertDialogOverlay>
          <AlertDialogContent rounded="12px" maxW="420px">
            <AlertDialogHeader fontSize="16px" fontWeight="700" pb="0">
              <Flex align="center" gap="8px" color="#d97706">
                <AlertTriangle size={20} />
                <Text>{t('projectSettings.confirmTransfer')}</Text>
              </Flex>
            </AlertDialogHeader>
            <AlertDialogCloseButton top="14px" right="14px" />
            <AlertDialogBody py="16px">
              <Text fontSize="13px" color="#666" mb="12px">
                {t('projectSettings.transferWarning')}
              </Text>
              <Text fontSize="13px" color="#666" mb="12px">{t('projectSettings.typeNewOwner')}</Text>
              <Input
                value={transferTarget}
                onChange={function(e) { setTransferTarget(e.target.value) }}
                placeholder={t('projectSettings.newOwnerPlaceholder')}
                size="sm"
                rounded="6px"
                borderColor="#d1d5db"
                _focus={{ borderColor: '#f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,0.1)' }}
              />
            </AlertDialogBody>
            <AlertDialogFooter pt="0">
              <Button ref={transferCancelRef} onClick={function() { setTransferOpen(false) }}
                h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline" borderColor="#d1d5db">
                {t('common.cancel')}
              </Button>
              <Button colorScheme="orange" onClick={handleTransfer} isLoading={transferring}
                isDisabled={!transferTarget.trim()}
                h="32px" px="16px" fontSize="13px" rounded="6px" ml="10px">
                {t('projectSettings.confirmTransfer')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <AlertDialog isOpen={deleteOpen} leastDestructiveRef={cancelRef} onClose={function() { setDeleteOpen(false) }}>
        <AlertDialogOverlay>
          <AlertDialogContent rounded="12px" maxW="420px">
            <AlertDialogHeader fontSize="16px" fontWeight="700" pb="0">
              <Flex align="center" gap="8px" color="#dc2626">
                <AlertTriangle size={20} />
                <Text>{t('projectSettings.confirmDeleteRepo')}</Text>
              </Flex>
            </AlertDialogHeader>
            <AlertDialogCloseButton top="14px" right="14px" />
            <AlertDialogBody py="16px">
              <Text fontSize="13px" color="#666" mb="12px">
                {t('projectSettings.deleteWarning')}
              </Text>
              <Text fontSize="13px" color="#666" mb="12px">{t('projectSettings.typeRepoName', { repo })}</Text>
              <Input
                value={deleteConfirm}
                onChange={function(e) { setDeleteConfirm(e.target.value) }}
                placeholder={repo}
                size="sm"
                rounded="6px"
                borderColor="#d1d5db"
                _focus={{ borderColor: '#dc2626', boxShadow: '0 0 0 3px rgba(220,38,38,0.1)' }}
              />
            </AlertDialogBody>
            <AlertDialogFooter pt="0">
              <Button ref={cancelRef} onClick={function() { setDeleteOpen(false) }}
                h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline" borderColor="#d1d5db">
                {t('common.cancel')}
              </Button>
              <Button colorScheme="red" onClick={handleDelete} isLoading={deleting}
                isDisabled={deleteConfirm !== repo}
                h="32px" px="16px" fontSize="13px" rounded="6px" ml="10px">
                {t('projectSettings.confirmDelete')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  )
}



export { highlightLine, FileViewer, ProjectTree, ProjectIssues, ProjectPRs, ProjectCommits, ProjectBranches, ProjectTags, ProjectStats, ProjectReleases, ProjectTasks, NewIssue, NewPR, NewTask, CommitDetail, IssueDetail, PRDetail, TaskDetail, ProjectSettings }
