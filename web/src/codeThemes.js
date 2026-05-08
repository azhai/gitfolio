import { oneDark, oneLight, duotoneLight, gruvboxLight, materialLight, solarizedlight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { dracula, nord, materialDark, vs } from 'react-syntax-highlighter/dist/esm/styles/prism'

var currentTheme = localStorage.getItem('gitfolio_code_theme') || 'oneDark'

var THEMES = {
  oneDark: {
    name: 'One Dark',
    style: oneDark,
    type: 'dark',
    description: 'VSCode 默认深色主题'
  },
  oneLight: {
    name: 'One Light ✨',
    style: oneLight,
    type: 'light',
    description: 'VSCode 默认浅色主题，清新明亮（推荐）'
  },
  duotoneLight: {
    name: 'Duotone Light',
    style: duotoneLight,
    type: 'light',
    description: '双色调浅色主题，简洁优雅'
  },
  gruvboxLight: {
    name: 'Gruvbox Light',
    style: gruvboxLight,
    type: 'light',
    description: '复古暖色调浅色主题'
  },
  materialLight: {
    name: 'Material Light',
    style: materialLight,
    type: 'light',
    description: 'Material Design 浅色版'
  },
  dracula: {
    name: 'Dracula',
    style: dracula,
    type: 'dark',
    description: '流行的紫色调深色主题'
  },
  nord: {
    name: 'Nord',
    style: nord,
    type: 'dark',
    description: '北极色系，柔和护眼'
  },
  materialDark: {
    name: 'Material Dark',
    style: materialDark,
    type: 'dark',
    description: 'Material Design 深色版'
  },
  vs: {
    name: 'VS Code',
    style: vs,
    type: 'dark',
    description: 'Visual Studio 经典风格'
  },
  solarizedlight: {
    name: 'Solarized Light',
    style: solarizedlight,
    type: 'light',
    description: 'Solarized 精心设计的亮色版'
  }
}

export function setCodeTheme(themeKey) {
  if (THEMES[themeKey]) {
    currentTheme = themeKey
    localStorage.setItem('gitfolio_code_theme', themeKey)
  }
}

export function getCodeTheme() {
  return currentTheme
}

export function getThemeStyle() {
  var theme = THEMES[currentTheme]
  return theme ? theme.style : oneDark
}

export function getThemeInfo() {
  return THEMES[currentTheme] || THEMES.oneDark
}

export function getAllThemes() {
  return THEMES
}

export default { setCodeTheme, getCodeTheme, getThemeStyle, getThemeInfo, getAllThemes }
