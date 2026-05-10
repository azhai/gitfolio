import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Button, Spinner, Tabs, TabList, Tab, TabPanels, TabPanel } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { prsAPI } from '../../api/index'
import { t, timeAgo } from '../../i18n/index'
import { LuGitPullRequest as GitPullRequest } from 'react-icons/lu'
import { useAuth } from '../../contexts/AuthContext'

function shortHash(hash) {
  return hash ? hash.substring(0, 7) : ''
}

var STATUS_MAP = {
  open: { bg: '#dcfce7', color: '#16a34a' },
  merged: { bg: '#ede9fe', color: '#7c3aed' },
  closed: { bg: '#fef2f2', color: '#dc2626' },
}

const PRDetail = () => {
  const { owner, repo, number } = useParams()
  const navigate = useNavigate()
  const { isGuest, isAdmin, isLeader } = useAuth()
  const [pr, setPr] = useState(null)
  const [prCommits, setPrCommits] = useState([])
  const [prFiles, setPrFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    prsAPI.get(owner, repo, number).then(function(data) {
      setPr(data)
    }).catch(function() { setPr(null) }).finally(function() { setLoading(false) })
  }, [owner, repo, number])

  function loadCommits() {
    prsAPI.commits(owner, repo, number).then(function(data) {
      setPrCommits(Array.isArray(data && data.commits ? data.commits : data) ? (data.commits || data) : [])
    }).catch(function() { setPrCommits([]) })
  }

  function loadFiles() {
    prsAPI.files(owner, repo, number).then(function(data) {
      setPrFiles(Array.isArray(data && data.files ? data.files : data) ? (data.files || data) : [])
    }).catch(function() { setPrFiles([]) })
  }

  function handleAction(action) {
    if (!pr) return
    setActionLoading(true)
    var fn = action === 'merge' ? prsAPI.merge : (action === 'close' ? prsAPI.close : prsAPI.reopen)
    fn(owner, repo, number).then(function(data) {
      if (data && data.mr) setPr(data.mr)
      else return prsAPI.get(owner, repo, number)
    }).then(function(data) {
      if (data) setPr(data)
    }).catch(function() {}).finally(function() { setActionLoading(false) })
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  if (!pr) {
    return (
      <Box textAlign="center" py="50px" color="#aaa">
        <GitPullRequest size={36} color="#ccc" mb="6px" />
        <Text fontSize="14px">{t('prDetail.notFound')}</Text>
      </Box>
    )
  }

  var status = pr.is_merged ? 'merged' : (pr.is_closed ? 'closed' : 'open')
  var cfg = STATUS_MAP[status] || STATUS_MAP.open
  var statusLabel = status === 'open' ? t('common.open') : (status === 'merged' ? t('common.merged') : t('common.closed'))

  return (
    <Box>
      <Flex justify="space-between" align="start" mb="16px">
        <Box flex={1}>
          <HStack gap="10px" mb="6px" align="center">
            <Badge fontSize="12px" px="8px" py="2px" rounded="4px" bg={cfg.bg} color={cfg.color}>
              {statusLabel}
            </Badge>
            <Text fontSize="18px" fontWeight="700" color="#333">{pr.title}</Text>
          </HStack>
          <Text fontSize="13px" color="#888">
            #{pr.number} {t('prDetail.createdBy', { author: pr.author || t('common.unknown'), time: timeAgo(pr.created_at) })}
          </Text>
          <HStack gap="8px" mt="6px" fontSize="13px">
            <Text color="#16a34a" fontWeight="500">{pr.source_branch}</Text>
            <Text color="#888">→</Text>
            <Text color="#dc2626" fontWeight="500">{pr.target_branch}</Text>
          </HStack>
        </Box>
        <HStack gap="8px">
          {status === 'open' && !isGuest && (
            <>
              {(isAdmin || isLeader) && (
                <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#7c3aed" color="white"
                  _hover={{ bg: '#6d28d9' }} onClick={function() { handleAction('merge') }} isLoading={actionLoading}>
                  {t('pr.merge')}
                </Button>
              )}
              <Button h="30px" px="14px" fontSize="13px" rounded="6px" variant="outline"
                borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#dc2626', color: '#dc2626' }}
                onClick={function() { handleAction('close') }} isLoading={actionLoading}>
                {t('pr.close')}
              </Button>
            </>
          )}
          {status === 'closed' && !pr.is_merged && !isGuest && (
            <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
              _hover={{ bg: '#16a34a' }} onClick={function() { handleAction('reopen') }} isLoading={actionLoading}>
              {t('pr.reopen')}
            </Button>
          )}
        </HStack>
      </Flex>

      {pr.body && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
          <Text fontSize="13.5px" color="#333" whiteSpace="pre-wrap" lineHeight="1.7">{pr.body}</Text>
        </Box>
      )}

      <Tabs colorScheme="green" mb="20px">
        <TabList borderColor="#e5e7eb">
          <Tab fontSize="13px" fontWeight="500" _selected={{ color: '#16a34a', borderColor: '#16a34a' }}
            onClick={loadCommits}>
            {t('pr.commits')}
          </Tab>
          <Tab fontSize="13px" fontWeight="500" _selected={{ color: '#16a34a', borderColor: '#16a34a' }}
            onClick={loadFiles}>
            {t('pr.filesChanged')}
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <VStack spacing="0" align="stretch" border="1px solid" borderColor="#e2e2e2" rounded="8px" overflow="hidden">
              {prCommits.map(function(c, idx) {
                var hash = c.hash || c.sha || ''
                var message = c.message || c.subject || ''
                var author = c.author || c.author_name || ''
                return (
                  <Flex key={hash || idx} align="center" px="14px" py="10px"
                    borderBottom={idx < prCommits.length - 1 ? '1px solid' : 'none'} borderColor="#f0f0f0"
                    _hover={{ bg: '#f9fafb' }}>
                    <Badge fontSize="11px" px="6px" py="1px" rounded="4px" bg="#f0fdf4" color="#16a34a"
                      fontFamily="monospace" mr="10px">
                      {shortHash(hash)}
                    </Badge>
                    <Text fontSize="13px" color="#333" flex={1} noOfLines={1}>{message.split('\n')[0]}</Text>
                    <Text fontSize="12px" color="#888" ml="10px">{author}</Text>
                  </Flex>
                )
              })}
              {prCommits.length === 0 && (
                <Text textAlign="center" py="20px" fontSize="13px" color="#aaa">{t('prDetail.clickToLoad')}</Text>
              )}
            </VStack>
          </TabPanel>
          <TabPanel px={0}>
            <VStack spacing="0" align="stretch" border="1px solid" borderColor="#e2e2e2" rounded="8px" overflow="hidden">
              {prFiles.map(function(f, idx) {
                var name = f.filename || f.name || f.path || ''
                var additions = f.additions || f.added || 0
                var deletions = f.deletions || f.deleted || 0
                return (
                  <Flex key={name || idx} align="center" px="14px" py="10px"
                    borderBottom={idx < prFiles.length - 1 ? '1px solid' : 'none'} borderColor="#f0f0f0"
                    _hover={{ bg: '#f9fafb' }}>
                    <Text fontSize="13px" color="#333" flex={1} fontFamily="monospace" noOfLines={1}>{name}</Text>
                    <HStack gap="8px" fontSize="12px">
                      {additions > 0 && <Text color="#16a34a">+{additions}</Text>}
                      {deletions > 0 && <Text color="#dc2626">-{deletions}</Text>}
                    </HStack>
                  </Flex>
                )
              })}
              {prFiles.length === 0 && (
                <Text textAlign="center" py="20px" fontSize="13px" color="#aaa">{t('prDetail.clickToLoad')}</Text>
              )}
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}

export default PRDetail
