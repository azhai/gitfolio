import React from 'react'
import { Box, Flex, Text, Button, HStack } from '@chakra-ui/react'
import { t } from '../../i18n/index'
import { reposAPI } from '../../api/index'
import { useGitWorkflow } from '../../contexts/GitWorkflowContext'

var OP_LABELS = {
  rebase: 'Rebase',
  merge: 'Merge',
  cherry_pick: 'Cherry-pick',
  revert: 'Revert',
}

var ConflictBanner = function() {
  var ctx = useGitWorkflow()
  var conflictInfo = ctx.conflict_info
  var toast = React.useContext(React.createContext())

  if (!conflictInfo || !conflictInfo.active) return null

  var opLabel = OP_LABELS[conflictInfo.type] || conflictInfo.type
  var conflictFiles = conflictInfo.conflict_files || []

  var handleAbort = function() {
    reposAPI.abortOperation(ctx.owner, ctx.repo, conflictInfo.type).then(function() {
      ctx.refreshStatus()
    }).catch(function() {})
  }

  return (
    <Box bg="#fff7ed" border="1px solid" borderColor="#fb923c" rounded="8px" px="16px" py="10px" mb="12px">
      <Flex justify="space-between" align="center" flexWrap="wrap" gap="8px">
        <HStack gap="8px">
          <Text fontSize="13px" fontWeight="600" color="#ea580c">
            {opLabel + ' ' + t('gitWorkflow.conflict')}
          </Text>
          {conflictFiles.length > 0 && (
            <Text fontSize="12px" color="#9a3412">
              ({conflictFiles.length + ' ' + t('gitWorkflow.conflictFiles')})
            </Text>
          )}
        </HStack>
        <Button h="26px" px="10px" fontSize="11px" rounded="6px"
          bg="#ea580c" color="white" _hover={{ bg: '#c2410c' }}
          onClick={handleAbort}>
          {t('gitWorkflow.abortOp')}
        </Button>
      </Flex>
      {conflictFiles.length > 0 && (
        <Box mt="6px">
          {conflictFiles.map(function(f, i) {
            return <Text key={i} fontSize="11px" color="#9a3412" fontFamily="monospace">{f}</Text>
          })}
        </Box>
      )}
    </Box>
  )
}

export default ConflictBanner