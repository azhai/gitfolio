import React from 'react'
import { Flex, Text, HStack, Button, useDisclosure, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter } from '@chakra-ui/react'
import { t } from '../../i18n/index'
import { useAuth } from '../../contexts/AuthContext'

var StashItem = function(_ref) {
  var stash = _ref.stash
  var onPop = _ref.onPop
  var onApply = _ref.onApply
  var onDrop = _ref.onDrop

  var isGuest = useAuth().isGuest
  var confirmDialog = useDisclosure()
  var cancelRef = React.useRef()

  return (
    <Flex px="8px" py="6px" align="center" fontSize="12px" borderBottom="1px solid" borderColor="#f3f4f6" _hover={{ bg: '#f9fafb' }}>
      <Text color="#6b7280" w="24px" flexShrink={0}>stash@{'{'}{stash.index}{'}'}</Text>
      <Text color="#374151" flex={1} noOfLines={1} ml="6px">{stash.message}</Text>
      {stash.date && <Text color="#9ca3af" fontSize="10px" ml="6px" flexShrink={0}>{stash.date}</Text>}
      {!isGuest && (
        <HStack gap="4px" ml="8px" flexShrink={0}>
          <Button h="20px" px="6px" fontSize="9px" rounded="3px"
            variant="outline" borderColor="#22c55e" color="#16a34a"
            _hover={{ bg: '#f0fdf4' }}
            onClick={function() { onPop(stash.index) }}>
            Pop
          </Button>
          <Button h="20px" px="6px" fontSize="9px" rounded="3px"
            variant="outline" borderColor="#f59e0b" color="#d97706"
            _hover={{ bg: '#fef3c7' }}
            onClick={function() { onApply(stash.index) }}>
            Apply
          </Button>
          <Button h="20px" px="6px" fontSize="9px" rounded="3px"
            variant="outline" borderColor="#dc2626" color="#dc2626"
            _hover={{ bg: '#fef2f2' }}
            onClick={confirmDialog.onOpen}>
            Drop
          </Button>
        </HStack>
      )}
      <AlertDialog isOpen={confirmDialog.isOpen} leastDestructiveRef={cancelRef} onClose={confirmDialog.onClose}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader fontSize="14px">{t('gitWorkflow.confirmStashDropTitle')}</AlertDialogHeader>
          <AlertDialogBody fontSize="13px">
            {t('gitWorkflow.confirmStashDropBody', { index: stash.index })}
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={confirmDialog.onClose} h="28px" fontSize="12px">{t('common.cancel')}</Button>
            <Button colorScheme="red" onClick={function() { confirmDialog.onClose(); onDrop(stash.index) }} h="28px" fontSize="12px" ml="8px">Drop</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Flex>
  )
}

export default StashItem