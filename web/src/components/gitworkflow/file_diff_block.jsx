import React, { useState } from 'react'
import { Box, Flex, Text, HStack, Spinner } from '@chakra-ui/react'
import { t } from '../../i18n/index'
import { reposAPI } from '../../api/index'
import DiffViewer from './diff_viewer'

var FileDiffBlock = function(_ref) {
  var owner = _ref.owner
  var repo = _ref.repo
  var file = _ref.file
  var sha = _ref.sha

  var _useState = useState(false)
  var expanded = _useState[0]
  var setExpanded = _useState[1]

  var _useState2 = useState(null)
  var diffData = _useState2[0]
  var setDiffData = _useState2[1]

  var _useState3 = useState(false)
  var loading = _useState3[0]
  var setLoading = _useState3[1]

  var name = file.filename || file.name || file.path || ''
  var additions = file.additions || file.added || 0
  var deletions = file.deletions || file.deleted || 0
  var status = file.status || file.type || ''

  var handleExpand = function() {
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)
    if (!diffData && !loading) {
      setLoading(true)
      reposAPI.commitFileDiff(owner, repo, sha, name).then(function(data) {
        setDiffData(data)
      }).catch(function() {
        setDiffData(null)
      }).finally(function() {
        setLoading(false)
      })
    }
  }

  return (
    <Box border="1px solid" borderColor="#e5e7eb" rounded="6px" mb="8px" overflow="hidden">
      <Flex px="12px" py="8px" align="center" cursor="pointer" _hover={{ bg: '#f9fafb' }} onClick={handleExpand}>
        <Text fontSize="11px" color="#6b7280" w="50px" flexShrink={0}>
          {status === 'added' ? t('commitDetail.added') : status === 'deleted' ? t('commitDetail.deleted') : status === 'renamed' ? t('commitDetail.renamed') : t('commitDetail.modified')}
        </Text>
        <Text fontSize="12px" color="#374151" fontFamily="monospace" flex={1} noOfLines={1}>{name}</Text>
        <HStack gap="8px" fontSize="11px" ml="8px" flexShrink={0}>
          {additions > 0 && <Text color="#16a34a">+{additions}</Text>}
          {deletions > 0 && <Text color="#dc2626">-{deletions}</Text>}
        </HStack>
        <Text fontSize="10px" color="#9ca3af" ml="8px">{expanded ? '▾' : '▸'}</Text>
      </Flex>
      {expanded && (
        <Box borderTop="1px solid" borderColor="#e5e7eb">
          {loading ? (
            <Flex justify="center" py="12px"><Spinner size="sm" color="#22c55e" /></Flex>
          ) : diffData && diffData.lines ? (
            <Box maxH="300px" overflowY="auto" fontSize="12px" fontFamily="monospace">
              {diffData.lines.map(function(line, i) {
                var bgColor = line.type === 'added' ? '#f0fdf4' : line.type === 'deleted' ? '#fef2f2' : line.type === 'hunk' ? '#f8fafc' : 'transparent'
                var textColor = line.type === 'added' ? '#16a34a' : line.type === 'deleted' ? '#dc2626' : '#374151'
                return (
                  <Flex key={i} bg={bgColor} px="12px" py="0" minH="18px">
                    <Text w="40px" textAlign="right" pr="6px" color="#9ca3af" fontSize="11px" flexShrink={0}>{line.old_line_no >= 0 ? line.old_line_no : ''}</Text>
                    <Text w="40px" textAlign="right" pr="6px" color="#9ca3af" fontSize="11px" flexShrink={0}>{line.new_line_no >= 0 ? line.new_line_no : ''}</Text>
                    <Text flex={1} color={textColor} fontSize="11px" whiteSpace="pre">{line.content}</Text>
                  </Flex>
                )
              })}
            </Box>
          ) : (
            <Box px="12px" py="12px"><Text fontSize="11px" color="#9ca3af">{t('gitWorkflow.diffLoadFailed')}</Text></Box>
          )}
        </Box>
      )}
    </Box>
  )
}

export default FileDiffBlock