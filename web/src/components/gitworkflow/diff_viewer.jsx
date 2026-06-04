import React, { useState } from 'react'
import { Box, Text, Spinner, useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton } from '@chakra-ui/react'
import { t } from '../../i18n/index'
import DiffHeader from './diff_header'
import DiffLine from './diff_line'
import LineStageSelector from './line_stage_selector'
import { useGitWorkflow } from '../../contexts/GitWorkflowContext'

var FOLD_THRESHOLD = 300
var FOLD_HEAD = 100
var FOLD_TAIL = 50

var DiffViewer = function(_ref) {
  var filePath = _ref.filePath
  var diffMode = _ref.diffMode
  var onModeChange = _ref.onModeChange
  var selectable = _ref.selectable

  var ctx = useGitWorkflow()
  var diff = ctx.diff
  var diffLoading = ctx.diff_loading
  var selectedLines = ctx.selected_lines
  var toggleLine = ctx.toggleLine
  var clearLineSelection = ctx.clearLineSelection

  var _useState = useState(true)
  var folded = _useState[0]
  var setFolded = _useState[1]

  var fullscreen = useDisclosure()

  var handleStageSelected = function() {
    if (!filePath || selectedLines.length === 0) return
    reposAPI.stagePatch(ctx.owner, ctx.repo, filePath, selectedLines).then(function() {
      clearLineSelection()
      ctx.refreshStatus()
    }).catch(function() {})
  }

  if (!filePath) return null

  if (diffLoading) {
    return (
      <Box display="flex" justifyContent="center" py="20px">
        <Spinner size="sm" color="#22c55e" />
      </Box>
    )
  }

  if (!diff) return null

  if (diff.is_binary) {
    return (
      <Box>
        <DiffHeader filePath={filePath} diffMode={diffMode} onModeChange={onModeChange} />
        <Box px="12px" py="16px" fontSize="12px" color="#6b7280">
          {t('gitWorkflow.binaryFileHint')}
        </Box>
      </Box>
    )
  }

  var lines = diff.lines || []
  var displayLines = lines
  if (folded && lines.length > FOLD_THRESHOLD) {
    displayLines = lines.slice(0, FOLD_HEAD).concat([{ type: 'hunk', content: '@@ ... @@ ' + t('gitWorkflow.foldHint', { count: lines.length - FOLD_HEAD - FOLD_TAIL }), old_line_no: -1, new_line_no: -1 }], lines.slice(lines.length - FOLD_TAIL))
  }

  var content = (
    <Box border="1px solid" borderColor="#e5e7eb" rounded="6px" overflow="hidden">
      <DiffHeader filePath={filePath} diffMode={diffMode} onModeChange={onModeChange} onFullscreen={fullscreen.onOpen} />
      <Box maxH={fullscreen.isOpen ? 'none' : '400px'} overflowY="auto" fontSize="12px">
        {displayLines.map(function(line, i) {
          return (
            <DiffLine key={i} line={line} index={i} selectable={selectable && diffMode === 'working'} selected={selectedLines.indexOf(i) >= 0} onToggle={toggleLine} />
          )
        })}
      </Box>
      {lines.length > FOLD_THRESHOLD && (
        <Box px="12px" py="4px" borderTop="1px solid" borderColor="#e5e7eb">
          <Text fontSize="10px" color="#6b7280" cursor="pointer" onClick={function() { setFolded(!folded) }}>
            {folded ? t('gitWorkflow.expandAll') : t('gitWorkflow.collapseDiff')}
          </Text>
        </Box>
      )}
      <LineStageSelector selectedCount={selectedLines.length} onStageSelected={handleStageSelected} visible={selectable && diffMode === 'working'} />
    </Box>
  )

  return (
    <Box>
      {content}
      <Modal isOpen={fullscreen.isOpen} onClose={fullscreen.onClose} size="full">
        <ModalOverlay />
        <ModalContent maxW="95vw" maxH="95vh">
          <ModalHeader fontSize="14px" fontFamily="monospace">{filePath}</ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto" px="0">
            <Box border="1px solid" borderColor="#e5e7eb" rounded="6px" overflow="hidden">
              {lines.map(function(line, i) {
                return <DiffLine key={i} line={line} index={i} selectable={false} />
              })}
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export default DiffViewer