import React from 'react'
import { Box, Text, Flex } from '@chakra-ui/react'
import { getLanguage, setLanguage } from '../i18n'

function LanguageSwitcher({ width = '100px', height = '32px' }) {
  var current = getLanguage()

  function handleToggle(lang) {
    if (lang !== current) {
      setLanguage(lang)
      window.location.reload()
    }
  }

  return (
    <Box
      position="relative"
      bg="#f3f4f6"
      rounded="full"
      p="3px"
      cursor="pointer"
      w={width}
      h={height}
      display="flex"
      alignItems="center"
    >
      <Box
        position="absolute"
        top="3px"
        left={current === 'zh' ? '3px' : `calc(50% - 1.5px)`}
        w="calc(50% - 3px)"
        h={`calc(${height} - 6px)`}
        bg="#22c55e"
        rounded="full"
        boxShadow="0 1px 3px rgba(34,197,94,0.3)"
        transition="all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
        zIndex={0}
      />
      <Flex w="full" position="relative" zIndex={1}>
        <Box
          flex={1}
          h="full"
          display="flex"
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          onClick={function() { handleToggle('zh') }}
          transition="color 0.2s"
          color={current === 'zh' ? 'white' : '#666'}
          _hover={{ color: current === 'zh' ? 'white' : '#333' }}
        >
          <Text fontSize="12px" fontWeight="600" userSelect="none">中文</Text>
        </Box>
        <Box
          flex={1}
          h="full"
          display="flex"
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          onClick={function() { handleToggle('en') }}
          transition="color 0.2s"
          color={current === 'en' ? 'white' : '#666'}
          _hover={{ color: current === 'en' ? 'white' : '#333' }}
        >
          <Text fontSize="12px" fontWeight="600" userSelect="none">EN</Text>
        </Box>
      </Flex>
    </Box>
  )
}

export default LanguageSwitcher
