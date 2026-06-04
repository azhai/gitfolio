import React, { useEffect } from 'react'
import { Box, Text, Spinner, Flex, Button, useDisclosure, Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody, DrawerCloseButton } from '@chakra-ui/react'
import { t } from '../../i18n/index'
import { useGitWorkflow } from '../../contexts/GitWorkflowContext'
import { reposAPI } from '../../api/index'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '@chakra-ui/react'
import ChangeGroup from './change_group'
import DiffViewer from './diff_viewer'
import CommitForm from './commit_form'

var WorkingPanel = function() {
  var ctx = useGitWorkflow()
  var isGuest = useAuth().isGuest
  var toast = useToast()
  var drawer = useDisclosure()

  var status = ctx.working_status
  var staged = status.staged || []
  var unstaged = status.unstaged || []
  var untracked = status.untracked || []
  var hasChanges = staged.length + unstaged.length + untracked.length > 0
  var selectedFile = ctx.selected_file
  var diffMode = ctx.diff_mode

  useEffect(function() {
    ctx.refreshStatus()
  }, [])

  var handleStage = function(files) {
    reposAPI.stageFiles(ctx.owner, ctx.repo, files).then(function() {
      toast({ title: t('gitWorkflow.stageSuccess'), status: 'success', duration: 3000 })
      ctx.refreshStatus()
    }).catch(function(err) {
      toast({ title: err.message || t('gitWorkflow.stageFailed'), status: 'error', duration: 3000 })
    })
  }

  var handleUnstage = function(files) {
    reposAPI.unstageFiles(ctx.owner, ctx.repo, files).then(function() {
      toast({ title: t('gitWorkflow.unstageSuccess'), status: 'success', duration: 3000 })
      ctx.refreshStatus()
    }).catch(function(err) {
      toast({ title: err.message || t('gitWorkflow.unstageFailed'), status: 'error', duration: 3000 })
    })
  }

  var handleDiscard = function(filePath, isUntracked) {
    reposAPI.discard(ctx.owner, ctx.repo, filePath, isUntracked).then(function() {
      toast({ title: t('gitWorkflow.discardSuccess'), status: 'success', duration: 3000 })
      ctx.refreshStatus()
    }).catch(function(err) {
      toast({ title: err.message || t('gitWorkflow.discardFailed'), status: 'error', duration: 3000 })
    })
  }

  var handleSelectFile = function(filePath) {
    ctx.selectFile(filePath)
  }

  var handleDiffModeChange = function(mode) {
    if (selectedFile) {
      ctx.loadDiff(selectedFile, mode)
    }
  }

  var panelContent = (
    <Box>
      <Flex justify="space-between" align="center" mb="8px">
        <Text fontSize="13px" fontWeight="600" color="#374151">{t('gitWorkflow.workingPanel')}</Text>
        <Text fontSize="11px" color="#6b7280">{status.current_branch}</Text>
      </Flex>

      {ctx.loading && (
        <Flex justify="center" py="12px"><Spinner size="sm" color="#22c55e" /></Flex>
      )}

      {ctx.error && (
        <Box bg="#fef2f2" rounded="6px" px="10px" py="6px" mb="8px">
          <Text fontSize="11px" color="#dc2626">{ctx.error}</Text>
          <Text fontSize="10px" color="#9ca3af" cursor="pointer" mt="4px" onClick={ctx.refreshStatus}>{t('common.refresh')}</Text>
        </Box>
      )}

      {!ctx.loading && !hasChanges && (
        <Box py="20px" textAlign="center">
          <Text fontSize="12px" color="#9ca3af">{t('gitWorkflow.cleanWorking')}</Text>
        </Box>
      )}

      <ChangeGroup groupKey="staged" files={staged}
        onStage={handleStage} onUnstage={handleUnstage}
        onDiscard={handleDiscard} onSelectFile={handleSelectFile}
        selectedFile={selectedFile} isGuest={isGuest} />
      <ChangeGroup groupKey="unstaged" files={unstaged}
        onStage={handleStage} onUnstage={handleUnstage}
        onDiscard={handleDiscard} onSelectFile={handleSelectFile}
        selectedFile={selectedFile} isGuest={isGuest} />
      <ChangeGroup groupKey="untracked" files={untracked}
        onStage={handleStage} onUnstage={handleUnstage}
        onDiscard={handleDiscard} onSelectFile={handleSelectFile}
        selectedFile={selectedFile} isGuest={isGuest} />

      {selectedFile && (
        <Box mt="12px">
          <DiffViewer filePath={selectedFile} diffMode={diffMode} onModeChange={handleDiffModeChange} selectable={true} />
        </Box>
      )}

      {!isGuest && <CommitForm />}
    </Box>
  )

  return (
    <Box>
      <Box display={{ base: 'none', md: 'block' }}>
        {panelContent}
      </Box>
      <Box display={{ base: 'block', md: 'none' }}>
        <Button h="28px" px="10px" fontSize="11px" rounded="6px"
          variant="outline" borderColor="#22c55e" color="#16a34a"
          onClick={drawer.onOpen}>
          {t('gitWorkflow.workingPanel')} ({staged.length + unstaged.length + untracked.length})
        </Button>
        <Drawer isOpen={drawer.isOpen} placement="bottom" onClose={drawer.onClose} size="md">
          <DrawerOverlay />
          <DrawerContent maxH="80vh">
            <DrawerCloseButton />
            <DrawerHeader fontSize="13px">{t('gitWorkflow.workingPanel')}</DrawerHeader>
            <DrawerBody overflowY="auto">
              {panelContent}
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </Box>
    </Box>
  )
}

export default WorkingPanel