var currentTheme = localStorage.getItem('gitfolio_code_theme') || 'oneDark'

var THEME_META = {
  oneDark: { name: 'One Dark', type: 'dark', description: 'VSCode 默认深色主题' },
  oneLight: { name: 'One Light ✨', type: 'light', description: 'VSCode 默认浅色主题，清新明亮（推荐）' },
  duotoneLight: { name: 'Duotone Light', type: 'light', description: '双色调浅色主题，简洁优雅' },
  gruvboxLight: { name: 'Gruvbox Light', type: 'light', description: '复古暖色调浅色主题' },
  materialLight: { name: 'Material Light', type: 'light', description: 'Material Design 浅色版' },
  dracula: { name: 'Dracula', type: 'dark', description: '流行的紫色调深色主题' },
  nord: { name: 'Nord', type: 'dark', description: '北极色系，柔和护眼' },
  materialDark: { name: 'Material Dark', type: 'dark', description: 'Material Design 深色版' },
  vs: { name: 'VS Code', type: 'dark', description: 'Visual Studio 经典风格' },
  solarizedlight: { name: 'Solarized Light', type: 'light', description: 'Solarized 精心设计的亮色版' },
}

var styleCache = {}

async function loadStyle(key) {
  if (styleCache[key]) return styleCache[key]
  var styles = await import('react-syntax-highlighter/dist/esm/styles/prism')
  var map = {
    oneDark: styles.oneDark,
    oneLight: styles.oneLight,
    duotoneLight: styles.duotoneLight,
    gruvboxLight: styles.gruvboxLight,
    materialLight: styles.materialLight,
    dracula: styles.dracula,
    nord: styles.nord,
    materialDark: styles.materialDark,
    vs: styles.vs,
    solarizedlight: styles.solarizedlight,
  }
  styleCache[key] = map[key]
  return styleCache[key]
}

export function setCodeTheme(themeKey) {
  if (THEME_META[themeKey]) {
    currentTheme = themeKey
    localStorage.setItem('gitfolio_code_theme', themeKey)
  }
}

export function getCodeTheme() {
  return currentTheme
}

export async function getThemeStyle(key) {
  key = key || currentTheme
  var style = await loadStyle(key)
  return style
}

export function getThemeInfo() {
  var meta = THEME_META[currentTheme] || THEME_META.oneDark
  return Object.assign({}, meta, { key: currentTheme })
}

export function getAllThemes() {
  return THEME_META
}

export default { setCodeTheme, getCodeTheme, getThemeStyle, getThemeInfo, getAllThemes }
