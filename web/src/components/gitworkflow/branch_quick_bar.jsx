import React, { useState, useEffect } from 'react'
import { Flex, Text, Select, Button, HStack, Input, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, useDisclosure, useToast, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, Tooltip } from '@chakra-ui/react'
import { t } from '../../i18n/index'
import { reposAPI } from '../../api/index'
import { useAuth } from '../../contexts/AuthContext'

var BranchQuickBar = function(_ref) {
  var owner = _ref.owner
  var repo = _ref.repo
  var currentBranch = _ref.currentBranch
  var branches = _ref.branches
  var onBranchChange = _ref.onBranchChange

  var isGuest = useAuth().isGuest
  var toast = useToast()
  var createModal = useDisclosure()
  var mergeModal = useDisclosure()
  var deleteConfirm = useDisclosure()
  var cancelRef = React.useRef()

  var _useState = useState('')
  var newBranch = _useState[0]
  var setNewBranch = _useState[1]

  var _useState2 = useState('')
  var mergeSource = _useState2[0]
  var setMergeSource = _useState2[1]

  var _useState3 = useState('')
  var deleteTarget = _useState3[0]
  var setDeleteTarget = _useState3[1]

  var handleCheckout = function(e) {
    var branch = e.target.value
    if (branch === currentBranch) return
    reposAPI.checkout(owner, repo, branch).then(function() {
      toast({ title: t('gitWorkflow.switchSuccess', { branch: branch }), status: 'success', duration: 3000 })
      if (onBranchChange) onBranchChange(branch)
    }).catch(function(err) {
      toast({ title: err.message || t('gitWorkflow.switchFailed'), status: 'error', duration: 5000 })
    })
  }

  var handleCreate = function() {
    if (!newBranch.trim()) return
    reposAPI.createBranch(owner, repo, newBranch.trim(), currentBranch || 'HEAD').then(function() {
      toast({ title: t('gitWorkflow.createBranchSuccess'), status: 'success', duration: 3000 })
      setNewBranch('')
      createModal.onClose()
      if (onBranchChange) onBranchChange(newBranch.trim())
    }).catch(function(err) {
      toast({ title: err.message || t('gitWorkflow.createBranchFailed'), status: 'error', duration: 3000 })
    })
  }

  var handleMerge = function() {
    if (!mergeSource) return
    reposAPI.mergeBranch(owner, repo, mergeSource, currentBranch).then(function() {
      toast({ title: t('gitWorkflow.mergeSuccess'), status: 'success', duration: 3000 })
      mergeModal.onClose()
      if (onBranchChange) onBranchChange(currentBranch)
    }).catch(function(err) {
      toast({ title: err.message || t('gitWorkflow.mergeFailed'), status: 'error', duration: 5000 })
    })
  }

  var handleDelete = function() {
    if (!deleteTarget) return
    reposAPI.deleteBranch(owner, repo, deleteTarget).then(function() {
      toast({ title: t('gitWorkflow.deleteBranchSuccess'), status: 'success', duration: 3000 })
      setDeleteTarget('')
      deleteConfirm.onClose()
    }).catch(function(err) {
      toast({ title: err.message || t('gitWorkflow.deleteBranchFailed'), status: 'error', duration: 3000 })
    })
  }

  return (
    <Flex gap="8px" align="center" flexWrap="wrap" mb="8px">
      <Tooltip label={t('gitWorkflow.switchBranchHint')} placement="top" hasArrow>
        <Select h="28px" fontSize="12px" w="160px" borderRadius="6px"
          value={currentBranch || ''}
          onChange={handleCheckout}
          isDisabled={isGuest}>
          {branches.map(function(b) {
            var name = typeof b === 'string' ? b : (b.name || '')
            return <option key={name} value={name}>{name}</option>
          })}
        </Select>
      </Tooltip>

      {!isGuest && (
        <HStack gap="6px">
          <Tooltip label={t('gitWorkflow.createBranchHint')} placement="top" hasArrow>
            <Button h="26px" px="10px" fontSize="11px" rounded="6px"
              variant="outline" borderColor="#22c55e" color="#16a34a"
              _hover={{ bg: '#f0fdf4' }}
              onClick={createModal.onOpen}>
              + {t('gitWorkflow.createBranch')}
            </Button>
          </Tooltip>
          <Tooltip label={t('gitWorkflow.mergeBranchHint')} placement="top" hasArrow>
            <Button h="26px" px="10px" fontSize="11px" rounded="6px"
              variant="outline" borderColor="#8b5cf6" color="#7c3aed"
              _hover={{ bg: '#f5f3ff' }}
              onClick={mergeModal.onOpen}>
              ⊕ {t('gitWorkflow.mergeBranch')}
            </Button>
          </Tooltip>
          <Tooltip label={t('gitWorkflow.deleteBranchHint')} placement="top" hasArrow>
            <Button h="26px" px="10px" fontSize="11px" rounded="6px"
              variant="outline" borderColor="#dc2626" color="#dc2626"
              _hover={{ bg: '#fef2f2' }}
              onClick={function() { setDeleteTarget(currentBranch); deleteConfirm.onOpen() }}
              isDisabled={!currentBranch}>
              ✕ {t('gitWorkflow.deleteBranch')}
            </Button>
          </Tooltip>
        </HStack>
      )}

      <Modal isOpen={createModal.isOpen} onClose={createModal.onClose} size="sm">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="14px">{t('gitWorkflow.createBranch')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb="16px">
            <Input h="28px" fontSize="12px" placeholder={t('gitWorkflow.branchNamePlaceholder')} value={newBranch} onChange={function(e) { setNewBranch(e.target.value) }} />
            <Flex justify="flex-end" mt="12px">
              <Button h="28px" px="12px" fontSize="12px" rounded="6px" bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }} onClick={handleCreate} isDisabled={!newBranch.trim()}>{t('common.create')}</Button>
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={mergeModal.isOpen} onClose={mergeModal.onClose} size="sm">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="14px">{t('gitWorkflow.mergeBranch')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb="16px">
            <Select h="28px" fontSize="12px" value={mergeSource} onChange={function(e) { setMergeSource(e.target.value) }}>
              <option value="">{t('gitWorkflow.selectSourceBranch')}</option>
              {branches.filter(function(b) { var n = typeof b === 'string' ? b : b.name; return n !== currentBranch }).map(function(b) { var n = typeof b === 'string' ? b : b.name; return <option key={n} value={n}>{n}</option> })}
            </Select>
            <Flex justify="flex-end" mt="12px">
              <Button h="28px" px="12px" fontSize="12px" rounded="6px" bg="#8b5cf6" color="white" _hover={{ bg: '#7c3aed' }} onClick={handleMerge} isDisabled={!mergeSource}>{t('gitWorkflow.mergeBranch')}</Button>
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={deleteConfirm.isOpen} leastDestructiveRef={cancelRef} onClose={deleteConfirm.onClose}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader fontSize="14px">{t('gitWorkflow.confirmDeleteBranchTitle')}</AlertDialogHeader>
          <AlertDialogBody fontSize="13px">{t('gitWorkflow.confirmDeleteBranchBody', { branch: deleteTarget })}</AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={deleteConfirm.onClose} h="28px" fontSize="12px">{t('common.cancel')}</Button>
            <Button colorScheme="red" onClick={handleDelete} h="28px" fontSize="12px" ml="8px">{t('common.delete')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Flex>
  )
}

export default BranchQuickBar