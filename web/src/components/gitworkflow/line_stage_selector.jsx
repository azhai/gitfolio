import React from 'react'
import { Button, HStack } from '@chakra-ui/react'
import { t } from '../../i18n/index'

var LineStageSelector = function(_ref) {
  var selectedCount = _ref.selectedCount
  var onStageSelected = _ref.onStageSelected
  var visible = _ref.visible

  if (!visible || selectedCount === 0) return null

  return (
    <HStack gap="6px" px="12px" py="6px" bg="#f0fdf4" borderTop="1px solid" borderColor="#bbf7d0">
      <Button h="24px" px="10px" fontSize="11px" rounded="4px"
        bg="#16a34a" color="white" _hover={{ bg: '#15803d' }}
        onClick={onStageSelected}>
        {t('gitWorkflow.stageSelectedLines', { count: selectedCount })}
      </Button>
    </HStack>
  )
}

export default LineStageSelector