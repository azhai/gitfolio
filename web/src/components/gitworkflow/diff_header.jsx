import React from 'react'
import { Flex, Text, HStack, Button } from '@chakra-ui/react'
import { t } from '../../i18n/index'

var DiffHeader = function(_ref) {
  var filePath = _ref.filePath
  var diffMode = _ref.diffMode
  var onModeChange = _ref.onModeChange
  var onFullscreen = _ref.onFullscreen

  return (
    <Flex bg="#f9fafb" border="1px solid" borderColor="#e5e7eb" rounded="6px" px="12px" py="6px" mb="0" justify="space-between" align="center">
      <HStack gap="8px">
        <Text fontSize="12px" fontWeight="600" color="#374151" fontFamily="monospace">{filePath}</Text>
      </HStack>
      <HStack gap="6px">
        <Button h="22px" px="8px" fontSize="10px" rounded="4px"
          variant="outline" borderColor={diffMode === 'working' ? '#22c55e' : '#d1d5db'}
          color={diffMode === 'working' ? '#16a34a' : '#6b7280'}
          bg={diffMode === 'working' ? '#f0fdf4' : 'transparent'}
          onClick={function() { onModeChange('working') }}>
          {t('gitWorkflow.unstagedDiff')}
        </Button>
        <Button h="22px" px="8px" fontSize="10px" rounded="4px"
          variant="outline" borderColor={diffMode === 'staged' ? '#22c55e' : '#d1d5db'}
          color={diffMode === 'staged' ? '#16a34a' : '#6b7280'}
          bg={diffMode === 'staged' ? '#f0fdf4' : 'transparent'}
          onClick={function() { onModeChange('staged') }}>
          {t('gitWorkflow.stagedDiff')}
        </Button>
        {onFullscreen && (
          <Button h="22px" px="8px" fontSize="10px" rounded="4px"
            variant="outline" borderColor="#d1d5db" color="#6b7280"
            onClick={onFullscreen}>
            ⛶
          </Button>
        )}
      </HStack>
    </Flex>
  )
}

export default DiffHeader