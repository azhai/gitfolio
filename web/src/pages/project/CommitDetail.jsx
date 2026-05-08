import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Spinner } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { reposAPI } from '../../api/index'
import { t, timeAgo } from '../../i18n/index'
import { LuFileDiff as FileDiff, LuUser as User } from 'react-icons/lu'

const CommitDetail = () => {
  const { owner, repo, sha } = useParams()
  const navigate = useNavigate()
  const [commit, setCommit] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reposAPI.commitDetail(owner, repo, sha).then(function(data) {
      setCommit(data)
    }).catch(function() { setCommit(null) }).finally(function() { setLoading(false) })
  }, [owner, repo, sha])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  if (!commit) {
    return (
      <Box textAlign="center" py="50px" color="#aaa">
        <FileDiff size={36} color="#ccc" mb="6px" />
        <Text fontSize="14px">{t('commitDetail.notFound')}</Text>
      </Box>
    )
  }

  var hash = commit.hash || commit.sha || ''
  var message = commit.message || ''
  var author = commit.author || commit.author_name || ''
  var authorEmail = commit.author_email || ''
  var date = commit.date || commit.time || commit.created_at || ''
  var parents = commit.parents || []
  var files = commit.files || []

  return (
    <Box>
      <Flex align="center" gap="10px" mb="6px">
        <Text fontSize="18px" fontWeight="700" color="#333">{t('commitDetail.title')}</Text>
        <Badge fontSize="13px" px="10px" py="2px" rounded="6px" bg="#f0fdf4" color="#16a34a" fontFamily="monospace">
          {hash.substring(0, 12)}
        </Badge>
      </Flex>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
        <Text fontSize="14px" fontWeight="600" color="#333" mb="10px" whiteSpace="pre-wrap">{message.split('\n')[0]}</Text>
        {message.split('\n').length > 1 && (
          <Text fontSize="13px" color="#666" mb="10px" whiteSpace="pre-wrap">
            {message.split('\n').slice(1).join('\n').trim()}
          </Text>
        )}
        <HStack gap="16px" fontSize="13px" color="#888">
          <HStack gap="4px"><User size={13} /><Text>{author}</Text></HStack>
          {authorEmail && <Text>{authorEmail}</Text>}
          <Text>{timeAgo(date)}</Text>
        </HStack>
        {parents.length > 0 && (
          <HStack gap="8px" mt="8px" fontSize="12.5px" color="#888">
            <Text>{t('commitDetail.parentCommit')}</Text>
            {parents.map(function(p, idx) {
              var parentHash = typeof p === 'string' ? p : (p.hash || p.sha || '')
              return (
                <Badge key={idx} fontSize="11px" px="6px" py="1px" rounded="4px" bg="#f3f4f6" color="#666"
                  fontFamily="monospace" cursor="pointer"
                  _hover={{ bg: '#e5e7eb' }}
                  onClick={function() { navigate('/' + owner + '/' + repo + '/commits/' + parentHash) }}>
                  {parentHash.substring(0, 7)}
                </Badge>
              )
            })}
          </HStack>
        )}
      </Box>

      {files.length > 0 && (
        <Box>
          <Text fontSize="13px" fontWeight="600" color="#333" mb="10px">
            {t('commitDetail.changedFiles')} ({files.length})
          </Text>
          <VStack spacing="0" align="stretch" border="1px solid" borderColor="#e2e2e2" rounded="8px" overflow="hidden">
            {files.map(function(f, idx) {
              var name = f.filename || f.name || f.path || ''
              var additions = f.additions || f.added || 0
              var deletions = f.deletions || f.deleted || 0
              var status = f.status || f.type || ''
              return (
                <Flex key={name || idx} align="center" px="14px" py="8px"
                  borderBottom={idx < files.length - 1 ? '1px solid' : 'none'} borderColor="#f0f0f0"
                  _hover={{ bg: '#f9fafb' }}>
                  <Text fontSize="12px" color="#888" w="50px">
                    {status === 'added' ? t('commitDetail.added') : status === 'deleted' ? t('commitDetail.deleted') : status === 'renamed' ? t('commitDetail.renamed') : t('commitDetail.modified')}
                  </Text>
                  <Text fontSize="13px" color="#333" flex={1} fontFamily="monospace" noOfLines={1}>{name}</Text>
                  <HStack gap="8px" fontSize="12px">
                    {additions > 0 && <Text color="#16a34a">+{additions}</Text>}
                    {deletions > 0 && <Text color="#dc2626">-{deletions}</Text>}
                  </HStack>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}
    </Box>
  )
}

export default CommitDetail
