import React, { useState } from 'react'
import { Box, Textarea, Button, Flex, Text, HStack } from '@chakra-ui/react'
import { t } from '../../i18n/index'
import { useGitWorkflow } from '../../contexts/GitWorkflowContext'
import { reposAPI } from '../../api/index'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '@chakra-ui/react'

var CommitForm = function() {
  var ctx = useGitWorkflow()
  var isGuest = useAuth().isGuest
  var toast = useToast()

  var _useState = useState('')
  var message = _useState[0]
  var setMessage = _useState[1]

  var stagedFiles = ctx.working_status.staged || []
  var hasStaged = stagedFiles.length > 0
  var canCommit = hasStaged && message.trim() && !isGuest

  var titleLine = message.split('\n')[0] || ''
  var titleTooLong = titleLine.length > 72

  var handleCommit = function() {
    if (!canCommit) return
    reposAPI.commitChanges(ctx.owner, ctx.repo, message.trim()).then(function(data) {
      toast({ title: t('gitWorkflow.commitSuccess') + (data.commit_hash ? ' ' + data.commit_hash.substring(0, 7) : ''), status: 'success', duration: 5000 })
      setMessage('')
      ctx.refreshStatus()
    }).catch(function(err) {
      toast({ title: err.message || t('gitWorkflow.commitFailed'), status: 'error', duration: 5000 })
    })
  }

  return (
    <Box mt="12px" borderTop="1px solid" borderColor="#e5e7eb" pt="12px">
      <Textarea
        value={message}
        onChange={function(e) { setMessage(e.target.value) }}
        placeholder={t('gitWorkflow.commitPlaceholder')}
        fontSize="12px"
        rows={3}
        resize="vertical"
        bg="white"
        border="1px solid" borderColor="#d1d5db"
        _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 1px #22c55e' }}
        isDisabled={isGuest}
      />
      {titleTooLong && (
        <Text fontSize="10px" color="#ea580c" mt="4px">{t('gitWorkflow.titleTooLong')}</Text>
      )}
      {!hasStaged && (
        <Text fontSize="10px" color="#9ca3af" mt="4px">{t('gitWorkflow.noStagedFiles')}</Text>
      )}
      <Flex justify="flex-end" mt="8px">
        <Button h="28px" px="16px" fontSize="12px" rounded="6px"
          bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }}
          isDisabled={!canCommit}
          onClick={handleCommit}>
          {t('gitWorkflow.commit')}
        </Button>
      </Flex>
    </Box>
  )
}

export default CommitForm