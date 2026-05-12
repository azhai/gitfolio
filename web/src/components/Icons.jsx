import {
  LuHouse as House, LuUsers as Users, LuActivity as Activity, LuSquareCode as SquareCode, LuFileCode as FileCode, LuFolderOpen as FolderOpen,
  LuTriangleAlert as TriangleAlert, LuGitPullRequest as GitPullRequest, LuFileDiff as FileDiff, LuClipboardList as ClipboardList, LuSettings as Settings,
  LuGitBranch as GitBranch, LuTag as Tag, LuRocket as Rocket, LuChartBar as ChartBar, LuSearch as Search, LuBell as Bell, LuLogOut as LogOut,
  LuCamera as Camera, LuUser as User, LuStar as Star, LuEye as Eye, LuGitCommitVertical as GitCommit, LuLock as Lock, LuGlobe as Globe,
  LuChevronDown as ChevronDown, LuChevronRight as ChevronRight, LuCheck as Check, LuX as X, LuPlus as Plus, LuTrash2 as Trash2,
  LuPencil as Edit, LuExternalLink as ExternalLink, LuClock as Clock, LuCalendar as Calendar, LuMapPin as MapPin, LuLink2 as Link2,
  LuUpload as Upload, LuDownload as Download, LuRefreshCw as RefreshCw, LuHeart as Heart, LuMessageSquare as MessageSquare,
  LuPackage as Package, LuShield as Shield, LuServer as Server, LuZap as Zap, LuTrendingUp as TrendingUp, LuInfo as Info,
  LuCircleDot as CircleDot, LuCircleCheckBig as CheckCircle2, LuGitMerge as GitMerge, LuPencil as FileEdit, LuLoader as Loader2,
  LuGitFork as GitFork, LuFileText as FileText, LuFileCode2 as FileCode2, LuBraces as Braces, LuPalette as Palette, LuDatabase as Database,
  LuTerminal as Terminal, LuContainer as Container, LuLayers as Layers, LuImages as Image, LuFileX as FileX, LuSettings2 as Settings2,
  LuWrench as Wrench, LuCircleCheck as CheckCircle, LuFolder as Folder, LuMail as Mail, LuLockKeyhole as Key, LuFilePen as FilePen
} from 'react-icons/lu'
import { ReactNode } from 'react'

var ICON_SIZE = 16
var ICON_COLOR = '#6b7280'
var ICON_COLOR_GREEN = '#16a34a'

export var Icon = function(props) {
  var { name, size = ICON_SIZE, color = ICON_COLOR, ...rest } = props
  var Comp = IconMap[name]
  if (!Comp) return null
  return <Comp size={size} color={color} {...rest} />
}

export var IconMap = {
  home: House,
  users: Users,
  activity: Activity,
  code: SquareCode,
  fileCode: FileCode,
  folder: FolderOpen,
  folderOpen: FolderOpen,
  issue: TriangleAlert,
  pr: GitPullRequest,
  commit: FileDiff,
  task: ClipboardList,
  settings: Settings,
  branch: GitBranch,
  tag: Tag,
  release: Rocket,
  stats: ChartBar,
  search: Search,
  bell: Bell,
  logout: LogOut,
  camera: Camera,
  user: User,
  star: Star,
  eye: Eye,
  gitCommit: GitCommit,
  lock: Lock,
  globe: Globe,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  check: Check,
  close: X,
  plus: Plus,
  trash: Trash2,
  edit: Edit,
  externalLink: ExternalLink,
  clock: Clock,
  calendar: Calendar,
  location: MapPin,
  link: Link2,
  upload: Upload,
  download: Download,
  refresh: RefreshCw,
  heart: Heart,
  comment: MessageSquare,
  package: Package,
  shield: Shield,
  server: Server,
  zap: Zap,
  trendingUp: TrendingUp,
  info: Info,
}

export var NavIcons = {
  home: House,
  project: FolderOpen,
  group: Users,
  activity: Activity,
  snippet: FileCode,
}

export var ProjectTabIcons = {
  code: FileCode,
  issues: TriangleAlert,
  pull_requests: GitPullRequest,
  commits: FileDiff,
  tasks: ClipboardList,
  settings: Settings,
}

export var SidebarIcons = {
  code: FileCode,
  issues: TriangleAlert,
  pull_requests: GitPullRequest,
  commits: FileDiff,
  tasks: ClipboardList,
  settings: Settings,
  branches: GitBranch,
  tags: Tag,
  releases: Rocket,
  stats: ChartBar,
}

export var StatusIcons = {
  open: { icon: CircleDot, color: '#22c55e', label: '开启' },
  closed: { icon: CheckCircle2, color: '#6b7280', label: '已关闭' },
  draft: { icon: FileEdit, color: '#9ca3af', label: '草稿' },
  progress: { icon: Loader2, color: '#f59e0b', label: '进行中' },
  review: { icon: Eye, color: '#3b82f6', label: '评审中' },
  completed: { icon: CheckCircle2, color: '#22c55e', label: '已完成' },
  public: { icon: Globe, color: '#22c55e', label: '公开' },
  private: { icon: Lock, color: '#dc2626', label: '私有' },
}

export var ActivityIcons = {
  push: { icon: Upload, color: '#22c55e', bg: '#f0fdf4', label: '推送' },
  mr: { icon: GitPullRequest, color: '#8b5cf6', bg: '#faf5ff', label: '合并请求' },
  issue: { icon: TriangleAlert, color: '#f59e0b', bg: '#fffbeb', label: '议题' },
  comment: { icon: MessageSquare, color: '#3b82f6', bg: '#eff6ff', label: '评论' },
  star: { icon: Star, color: '#ec4899', bg: '#fdf2f8', label: '星标' },
  fork: { icon: GitFork, color: '#f97316', bg: '#fff7ed', label: '复刻' },
  release: { icon: Rocket, color: '#f97316', bg: '#fff7ed', label: '发布' },
}

export var FileIcons = [
  { exts: [''], isDir: true, icon: Folder, color: '#54aeff', name: 'folder' },
  { exts: ['makefile', 'gnumakefile'], icon: Wrench, color: '#6d8086', name: 'makefile' },
  { exts: ['.gitignore'], icon: FileX, color: '#f54d27', name: 'gitignore' },
  { exts: ['.md'], icon: FileText, color: '#083fa1', name: 'markdown' },
  { exts: ['.go'], icon: FileCode2, color: '#00ADD8', name: 'go' },
  { exts: ['.js', '.jsx', '.mjs'], icon: Braces, color: '#f7df1e', name: 'javascript' },
  { exts: ['.ts', '.tsx'], icon: FileCode2, color: '#3178C6', name: 'typescript' },
  { exts: ['.py'], icon: FileCode2, color: '#3572A5', name: 'python' },
  { exts: ['.rs'], icon: FileCode2, color: '#dea584', name: 'rust' },
  { exts: ['.java'], icon: FileCode2, color: '#b07219', name: 'java' },
  { exts: ['.php'], icon: FileCode2, color: '#4F5D95', name: 'php' },
  { exts: ['.c', '.cpp', '.cc', '.h', '.hpp'], icon: FileCode2, color: '#f34b7d', name: 'c' },
  { exts: ['.rb'], icon: FileCode2, color: '#701516', name: 'ruby' },
  { exts: ['.css', '.scss', '.sass', '.less'], icon: Palette, color: '#563d7c', name: 'css' },
  { exts: ['.html', '.htm'], icon: Globe, color: '#e34c26', name: 'html' },
  { exts: ['.json'], icon: Braces, color: '#292929', name: 'json' },
  { exts: ['.yaml', '.yml'], icon: Settings2, color: '#cb171e', name: 'yaml' },
  { exts: ['.sql'], icon: Database, color: '#e38c00', name: 'sql' },
  { exts: ['.sh', '.bash', '.zsh'], icon: Terminal, color: '#89e051', name: 'shell' },
  { exts: ['.dockerfile'], icon: Container, color: '#2496ed', name: 'docker' },
  { exts: ['.vue'], icon: Layers, color: '#41b883', name: 'vue' },
  { exts: ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico'], icon: Image, color: '#a074c4', name: 'image' },
  { exts: ['.lock'], icon: Lock, color: '#9ca3af', name: 'lock' },
  { exts: ['.mod'], icon: Package, color: '#00ADD8', name: 'gomod' },
  { exts: ['.sum'], icon: CheckCircle, color: '#9ca3af', name: 'gosum' },
  { exts: ['.txt', '.log', '.csv'], icon: FileText, color: '#888', name: 'text' },
]
