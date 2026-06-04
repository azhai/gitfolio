import React, { useEffect, useState } from 'react'
import { Box, Text, Button, Flex, HStack, Input, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, Spinner, useDisclosure, useToast } from '@chakra-ui/react'
import { t } from '../../i18n/index'
import { reposAPI } from '../../api/index'
import { useGitWorkflow } from '../../contexts/GitWorkflowContext'
import { useAuth } from '../../contexts/AuthContext'
import StashItem from './stash_item'

var StashPanel = function(_ref) {
  var owner = _ref.owner
  var repo = _ref.repo

  var ctx = useGitWorkflow()
  var isGuest = useAuth().isGuest
  var toast = useToast()
  var saveModal = useDisclosure()
  var _useState = useState('')
  var stashMsg = _useState[0]
  var setStashMsg = _useState[1]

  var stashList = ctx.stash_list
  var stashLoading = ctx.stash_loading

  useEffect(function() {
    ctx.refreshStashList()
  }, [])

  var _useState2 = useState(true)
  var collapsed = _useState2[0]
  var setCollapsed = _useState2[1]

  var handleSave = function() {
    reposAPI.stashSave(owner, repo, stashMsg).then(function() {
      toast({ title: t('gitWorkflow.stashSaveSuccess'), status: 'success', duration: 3000 })
      setStashMsg('')
      saveModal.onClose()
      ctx.refreshStashList()
      ctx.refreshStatus()
    }).catch(function(err) {
      toast({ title: err.message || t('gitWorkflow.stashSaveFailed'), status: 'error', duration: 3000 })
    })
  }

  var handlePop = function(index) {
    reposAPI.stashPop(owner, repo, index).then(function() {
      toast({ title: t('gitWorkflow.stashPopSuccess'), status: 'success', duration: 3000 })
      ctx.refreshStashList()
      ctx.refreshStatus()
    }).catch(function(err) {
      toast({ title: err.message || t('gitWorkflow.stashPopFailed'), status: 'error', duration: 5000 })
    })
  }

  var handleApply = function(index) {
    reposAPI.stashApply(owner, repo, index).then(function() {
      toast({ title: t('gitWorkflow.stashApplySuccess'), status: 'success', duration: 3000 })
      ctx.refreshStashList()
      ctx.refreshStatus()
    }).catch(function(err) {
      toast({ title: err.message || t('gitWorkflow.stashApplyFailed'), status: 'error', duration: 5000 })
    })
  }

  var handleDrop = function(index) {
    reposAPI.stashDrop(owner, repo, index).then(function() {
      toast({ title: t('gitWorkflow.stashDropSuccess'), status: 'success', duration: 3000 })
      ctx.refreshStashList()
    }).catch(function(err) {
      toast({ title: err.message || t('gitWorkflow.stashDropFailed'), status: 'error', duration: 3000 })
    })
  }

  return (
    <Box mb="12px">
      <Flex align="center" cursor="pointer" onClick={function() { setCollapsed(!collapsed) }}>
        <Text fontSize="13px" fontWeight="600" color="#374151">
          {t('gitWorkflow.stash')} ({stashList.length})
        </Text>
        <Text fontSize="11px" color="#6b7280" ml="4px">{collapsed ? '▸' : '▾'}</Text>
        {!isGuest && (
          <Button h="22px" px="8px" fontSize="10px" rounded="4px" ml="auto"
            variant="outline" borderColor="#8b5cf6" color="#7c3aed"
            _hover={{ bg: '#f5f3ff' }}
            onClick={function(e) { e.stopPropagation(); saveModal.onOpen() }}>
            {t('gitWorkflow.stashSave')}
          </Button>
        )}
      </Flex>

      {!collapsed && (
        <Box mt="8px" border="1px solid" borderColor="#e5e7eb" rounded="6px" overflow="hidden">
          {stashLoading ? (
            <Flex justify="center" py="12px"><Spinner size="sm" color="#22c55e" /></Flex>
          ) : stashList.length === 0 ? (
            <Box py="12px" textAlign="center">
              <Text fontSize="11px" color="#9ca3af">{t('gitWorkflow.noStash')}</Text>
            </Box>
          ) : (
            stashList.map(function(s, i) {
              return <StashItem key={i} stash={s} onPop={handlePop} onApply={handleApply} onDrop={handleDrop} />
            })
          )}
        </Box>
      )}

      <Modal isOpen={saveModal.isOpen} onClose={saveModal.onClose} size="sm">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="14px">{t('gitWorkflow.stashSaveTitle')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb="16px">
            <Input h="28px" fontSize="12px"
              placeholder={t('gitWorkflow.stashMsgPlaceholder')}
              value={stashMsg}
              onChange={function(e) { setStashMsg(e.target.value) }} />
            <Flex justify="flex-end" mt="12px">
              <Button h="28px" px="12px" fontSize="12px" rounded="6px"
                bg="#8b5cf6" color="white" _hover={{ bg: '#7c3aed' }}
                onClick={handleSave}>
                {t('gitWorkflow.stashSave')}
              </Button>
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export default StashPanel