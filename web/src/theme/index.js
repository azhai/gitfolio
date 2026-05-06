import { extendTheme } from '@chakra-ui/react'

const colors = {
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
