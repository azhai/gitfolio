import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Button, Spinner, Input } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { issuesAPI } from '../../api/index'
import { t, timeAgo } from '../../i18n/index'

var STATUS_TABS = [
  { key: 'open', label: '🟢 ' + t('issue.open') },
  { key: 'closed', label: '✅ ' + t('issue.closed') },
  { key: 'all', label: '📋 ' + t('common.all') },
]

const ProjectIssues = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')

  useEffect(() => {
    issuesAPI.list(owner, repo).then(function(data) {
      setIssues(Array.isArray(data) ? data : [])
    }).catch(function() { setIssues([]) }).finally(function() { setLoading(false) })
  }, [owner, repo])

  var openCount = issues.filter(function(i) { return !i.is_closed }).length
  var closedCount = issues.filter(function(i) { return i.is_closed }).length

  var filtered = issues.filter(function(i) {
    var matchSearch = i.title.toLowerCase().indexOf(search.toLowerCase()) >= 0
    if (!matchSearch) return false
    if (statusFilter === 'open') return !i.is_closed
    if (statusFilter === 'closed') return i.is_closed
    return true
  })

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb="16px">
        <HStack gap="4px" fontSize="13.5px" fontWeight="600">
          {STATUS_TABS.map(function(tab) {
            var isActive = statusFilter === tab.key
            var count = tab.key === 'open' ? openCount : (tab.key === 'closed' ? closedCount : issues.length)
            return (
              <Button key={tab.key} h="30px" px="12px" fontSize="13px" rounded="6px" variant="ghost"
                color={isActive ? '#16a34a' : '#888'}
                bg={isActive ? '#f0fdf4' : 'transparent'}
                _hover={{ bg: isActive ? '#f0fdf4' : '#f9fafb', color: isActive ? '#16a34a' : '#333' }}
                onClick={function() { setStatusFilter(tab.key) }}>
                {tab.label} ({count})
              </Button>
            )
          })}
        </HStack>
        <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }}
          onClick={function() { navigate('/' + owner + '/' + repo + '/issues/new') }}>
          {t('issue.newIssue')}
        </Button>
      </Flex>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="16px" mb="16px">
        <Input placeholder={t('issue.searchPlaceholder')} value={search} onChange={function(e) { setSearch(e.target.value) }}
          h="34px" fontSize="13.5px" borderRadius="8px" borderColor="#d1d5db"
          _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
      </Box>

      <VStack spacing="10px" align="stretch">
        {filtered.map(function(issue) {
          return (
            <Box key={issue.id} bg="white" border="1px solid" borderColor="#e2e2e2"
              rounded="8px" p="16px 20px" transition="all 0.15s"
              _hover={{ borderColor: '#d1d5db', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              cursor="pointer"
              onClick={function() { navigate('/' + owner + '/' + repo + '/issues/' + issue.number) }}>
              <Flex justify="space-between" align="start">
                <Box flex={1}>
                  <HStack gap="8px" mb="4px" align="center">
                    {issue.is_closed ? (
                      <Badge fontSize="11px" px="7px" py="1px" rounded="4px" bg="#fef2f2" color="#dc2626">{t('issue.closed')}</Badge>
                    ) : (
                      <Badge fontSize="11px" px="7px" py="1px" rounded="4px" bg="#dcfce7" color="#16a34a">{t('issue.open')}</Badge>
                    )}
                    <Text fontSize="13.5px" fontWeight="600" color="#333">{issue.title}</Text>
                  </HStack>
                  <Text fontSize="12.5px" color="#888" noOfLines={1}>
                    #{issue.number} {t('common.by')} {issue.author || t('common.unknown')} {t('common.createdAt')} {timeAgo(issue.created_at)}
                    {issue.comments_count > 0 && ' · 💬 ' + issue.comments_count}
                  </Text>
                </Box>
              </Flex>
            </Box>
          )
        })}
      </VStack>

      {!loading && filtered.length === 0 && (
        <Box textAlign="center" py="50px" color="#aaa">
          <Text fontSize="36px" mb="6px">⚠️</Text>
          <Text fontSize="14px">{t('issue.noIssues')}</Text>
        </Box>
      )}
    </Box>
  )
}

export default ProjectIssues
