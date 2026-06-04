import { extendTheme } from '@chakra-ui/react'

const colors = {
  git: {
    staged: '#f0fdf4',
    staged_border: '#86efac',
    unstaged: '#fef3c7',
    unstaged_border: '#fcd34d',
    untracked: '#f3f4f6',
    untracked_border: '#d1d5db',
    added: '#16a34a',
    deleted: '#dc2626',
    conflict: '#ea580c',
    conflict_bg: '#fff7ed',
  },
  diff: {
    added_bg: '#f0fdf4',
    added_line: '#bbf7d0',
    deleted_bg: '#fef2f2',
    deleted_line: '#fecaca',
    hunk_bg: '#f8fafc',
  },
  brand: {
    50: '#E6F7FF',
    100: '#BAE7FF',
    200: '#91D5FF',
    300: '#69C0FF',
    400: '#40A9FF',
    500: '#1890FF',
    600: '#096DD9',
    700: '#0050B3',
    800: '#003A8C',
    900: '#002766',
  },
  lake: {
    50: '#F0F9FF',
    100: '#E0F2FE',
    200: '#BAE6FD',
    300: '#7DD3FC',
    400: '#38BDF8',
    500: '#0EA5E9',
    600: '#0284C7',
    700: '#0369A1',
    800: '#075985',
    900: '#0C4A6E',
  },
}

const config = {
  initialColorMode: 'light',
  useSystemColorMode: false,
}

const styles = {
  global: {
    body: {
      bg: 'lake.50',
      color: 'gray.800',
    },
  },
}

const components = {
  Button: {
    baseStyle: {
      fontWeight: 'semibold',
      borderRadius: 'lg',
      _active: {
        transform: 'scale(0.98)',
      },
    },
    variants: {
      primary: {
        bg: 'lake.500',
        color: 'white',
        _hover: {
          bg: 'lake.600',
        },
        _active: {
          bg: 'lake.700',
        },
      },
      ghost: {
        bg: 'transparent',
        color: 'lake.700',
        _hover: {
          bg: 'lake.50',
        },
      },
    },
  },
  Card: {
    baseStyle: {
      container: {
        borderRadius: 'xl',
        boxShadow: 'md',
        _hover: {
          boxShadow: 'lg',
          transform: 'translateY(-2px)',
          transition: 'all 0.2s ease-in-out',
        },
      },
    },
  },
}

const theme = extendTheme({
  colors,
  config,
  styles,
  components,
  fonts: {
    heading: `-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif`,
    body: `-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif`,
  },
})

export default theme
