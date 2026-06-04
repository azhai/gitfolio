import React from 'react'
import { Box, Flex, Text, Button, HStack } from '@chakra-ui/react'
import { t } from '../../i18n/index'
import ChangeFileItem from './change_file_item'

var GROUP_CONFIG = {
  staged: { label: 'gitWorkflow.staged', color: '#86efac', borderColor: '#22c55e' },
  unstaged: { label: 'gitWorkflow.unstaged', color: '#fcd34d', borderColor: '#f59e0b' },
  untracked: { label: 'gitWorkflow.untracked', color: '#d1d5db', borderColor: '#9ca3af' },
}

var ChangeGroup = function(_ref) {
  var groupKey = _ref.groupKey
  var files = _ref.files
  var onStage = _ref.onStage
  var onUnstage = _ref.onUnstage
  var onDiscard = _ref.onDiscard
  var onSelectFile = _ref.onSelectFile
  var selectedFile = _ref.selectedFile
  var isGuest = _ref.isGuest

  if (!files || files.length === 0) return null

  var config = GROUP_CONFIG[groupKey] || GROUP_CONFIG.untracked
  var isStaged = groupKey === 'staged'

  return (
    <Box mb="8px">
      <Flex align="center" mb="4px" px="8px" borderLeft="3px solid" borderColor={config.borderColor}>
        <Text fontSize="12px" fontWeight="600" color="#374151" ml="6px">
          {t(config.label)}
        </Text>
        <Text fontSize="11px" color="#6b7280" ml="6px">({files.length})</Text>
        {!isGuest && files.length > 0 && (
          <Button h="20px" px="6px" fontSize="9px" rounded="3px" ml="auto"
            variant="outline" borderColor={config.borderColor} color={config.borderColor}
            _hover={{ bg: config.color + '33' }}
            onClick={function() {
              if (isStaged) {
                onUnstage(files.map(function(f) { return f.path }))
              } else {
                onStage(files.map(function(f) { return f.path }))
              }
            }}>
            {isStaged ? t('gitWorkflow.unstageAll') : t('gitWorkflow.stageAll')}
          </Button>
        )}
      </Flex>
      {files.map(function(f, i) {
        return (
          <ChangeFileItem key={f.path || i} file={f}
            onStage={function(p) { onStage([p]) }}
            onUnstage={function(p) { onUnstage([p]) }}
            onDiscard={onDiscard}
            onSelect={onSelectFile}
            isSelected={selectedFile === f.path}
            isGuest={isGuest} />
        )
      })}
    </Box>
  )
}

export default ChangeGroup