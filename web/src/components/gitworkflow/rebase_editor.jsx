import React, { useState, useEffect } from 'react'
import { Box, Text, Button, Flex, HStack, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, Input, Spinner, useToast } from '@chakra-ui/react'
import { t } from '../../i18n/index'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import RebaseTodoItem from './rebase_todo_item'
import { reposAPI } from '../../api/index'
import { useAuth } from '../../contexts/AuthContext'

var RebaseEditor = function(_ref) {
  var isOpen = _ref.isOpen
  var onClose = _ref.onClose
  var owner = _ref.owner
  var repo = _ref.repo
  var commits = _ref.commits
  var onSuccess = _ref.onSuccess

  var isGuest = useAuth().isGuest
  var toast = useToast()

  var _useState = useState('')
  var base = _useState[0]
  var setBase = _useState[1]

  var _useState2 = useState([])
  var todos = _useState2[0]
  var setTodos = _useState2[1]

  var _useState3 = useState(false)
  var executing = _useState3[0]
  var setExecuting = _useState3[1]

  useEffect(function() {
    if (isOpen && commits && commits.length > 0) {
      setBase('')
      setTodos(commits.map(function(c) {
        return {
          action: 'pick',
          hash: c.hash || c.sha || '',
          message: (c.message || '').split('\n')[0],
        }
      }))
    }
  }, [isOpen, commits])

  var handleActionChange = function(index, action) {
    setTodos(function(prev) {
      var next = prev.slice()
      next[index] = Object.assign({}, next[index], { action: action })
      return next
    })
  }

  var handleDragEnd = function(event) {
    var active = event.active
    var over = event.over
    if (active && over && active.id !== over.id) {
      setTodos(function(prev) {
        var oldIdx = prev.findIndex(function(t) { return t.hash === active.id })
        var newIdx = prev.findIndex(function(t) { return t.hash === over.id })
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  var handleExecute = function() {
    if (!base.trim()) {
      toast({ title: t('gitWorkflow.baseRequired'), status: 'warning', duration: 3000 })
      return
    }
    setExecuting(true)
    reposAPI.rebaseInteractive(owner, repo, base.trim(), todos).then(function() {
      toast({ title: t('gitWorkflow.rebaseSuccess'), status: 'success', duration: 5000 })
      setExecuting(false)
      onClose()
      if (onSuccess) onSuccess()
    }).catch(function(err) {
      var msg = err.message || t('gitWorkflow.rebaseFailed')
      toast({ title: msg, status: 'error', duration: 5000 })
      setExecuting(false)
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontSize="14px">{t('gitWorkflow.rebaseEditorTitle')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb="16px">
          <HStack gap="8px" mb="12px">
            <Text fontSize="12px" color="#374151">{t('gitWorkflow.baseCommit')}</Text>
            <Input h="28px" fontSize="12px" w="200px"
              placeholder={t('gitWorkflow.basePlaceholder')}
              value={base}
              onChange={function(e) { setBase(e.target.value) }}
              isDisabled={isGuest} />
          </HStack>
          {todos.length === 0 ? (
            <Text fontSize="12px" color="#9ca3af" py="12px">{t('gitWorkflow.noCommitsForRebase')}</Text>
          ) : (
            <Box border="1px solid" borderColor="#e5e7eb" rounded="6px" overflow="hidden" maxH="400px" overflowY="auto">
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={todos.map(function(t) { return t.hash })} strategy={verticalListSortingStrategy}>
                  {todos.map(function(item, i) {
                    return <RebaseTodoItem key={item.hash} item={item} index={i} onActionChange={handleActionChange} />
                  })}
                </SortableContext>
              </DndContext>
            </Box>
          )}
          <Flex justify="flex-end" mt="12px" gap="8px">
            <Button h="28px" px="12px" fontSize="12px" rounded="6px"
              variant="outline" borderColor="#d1d5db" color="#6b7280"
              onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button h="28px" px="12px" fontSize="12px" rounded="6px"
              bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }}
              isLoading={executing}
              isDisabled={isGuest || !base.trim() || todos.length === 0}
              onClick={handleExecute}>
              {t('gitWorkflow.executeRebase')}
            </Button>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default RebaseEditor