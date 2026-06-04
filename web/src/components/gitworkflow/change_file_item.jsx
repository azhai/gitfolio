import React from 'react'
import { Flex, Text, HStack, Button, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter } from '@chakra-ui/react'
import { t } from '../../i18n/index'
import { reposAPI } from '../../api/index'
import { useGitWorkflow } from '../../contexts/GitWorkflowContext'
import { useToast } from '@chakra-ui/react'

var STATUS_MARKS = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: '?',
}

var STATUS_COLORS = {
  modified: '#f59e0b',
  added: '#16a34a',
  deleted: '#dc2626',
  renamed: '#8b5cf6',
  untracked: '#6b7280',
}

var ChangeFileItem = function(_ref) {
  var file = _ref.file
  var onStage = _ref.onStage
  var onUnstage = _ref.onUnstage
  var onDiscard = _ref.onDiscard
  var onSelect = _ref.onSelect
  var isSelected = _ref.isSelected
  var isGuest = _ref.isGuest

  var toast = useToast()
  var confirmDialog = useDisclosure()
  var cancelRef = React.useRef()

  var mark = STATUS_MARKS[file.status] || '?'
  var markColor = STATUS_COLORS[file.status] || '#6b7280'
  var isStaged = file.group === 'staged'
  var isUntracked = file.group === 'untracked'

  var handleDiscard = function() {
    confirmDialog.onClose()
    onDiscard(file.path, isUntracked)
  }

  return (
    <Flex px="8px" py="4px" align="center" fontSize="12px"
      bg={isSelected ? '#f0fdf4' : 'transparent'}
      _hover={{ bg: isSelected ? '#f0fdf4' : '#f9fafb' }}
      cursor="pointer"
      onClick={function() { onSelect(file.path) }}>
      <Text w="18px" textAlign="center" color={markColor} fontWeight="700" flexShrink={0}>{mark}</Text>
      <Text flex={1} color="#374151" fontFamily="monospace" noOfLines={1} ml="6px">{file.path}</Text>
      {!isGuest && (
        <HStack gap="4px" ml="8px" flexShrink={0}>
          {isStaged ? (
            <Button h="20px" px="6px" fontSize="9px" rounded="3px"
              variant="outline" borderColor="#f59e0b" color="#d97706"
              _hover={{ bg: '#fef3c7' }}
              onClick={function(e) { e.stopPropagation(); onUnstage(file.path) }}>
              {t('gitWorkflow.unstage')}
            </Button>
          ) : (
            <Button h="20px" px="6px" fontSize="9px" rounded="3px"
              variant="outline" borderColor="#22c55e" color="#16a34a"
              _hover={{ bg: '#f0fdf4' }}
              onClick={function(e) { e.stopPropagation(); onStage(file.path) }}>
              {t('gitWorkflow.stage')}
            </Button>
          )}
          {!isStaged && (
            <Button h="20px" px="6px" fontSize="9px" rounded="3px"
              variant="outline" borderColor="#dc2626" color="#dc2626"
              _hover={{ bg: '#fef2f2' }}
              onClick={function(e) { e.stopPropagation(); confirmDialog.onOpen() }}>
              {t('gitWorkflow.discard')}
            </Button>
          )}
        </HStack>
      )}
      <AlertDialog isOpen={confirmDialog.isOpen} leastDestructiveRef={cancelRef} onClose={confirmDialog.onClose}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader fontSize="14px">{t('gitWorkflow.confirmDiscardTitle')}</AlertDialogHeader>
          <AlertDialogBody fontSize="13px">
            {t('gitWorkflow.confirmDiscardBody', { path: file.path })}
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={confirmDialog.onClose} h="28px" fontSize="12px">{t('common.cancel')}</Button>
            <Button colorScheme="red" onClick={handleDiscard} h="28px" fontSize="12px" ml="8px">{t('gitWorkflow.discard')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Flex>
  )
}

export default ChangeFileItem