import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Button, Spinner, Input } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { issuesAPI, reposAPI } from '../../api/index'
import { t, timeAgo } from '../../i18n/index'
import { useAuth } from '../../contexts/AuthContext'

var PAGE_SIZE = 30

function PaginationBar(_ref) {
  var page = _ref.page
  var totalPages = _ref.totalPages
  var onPageChange = _ref.onPageChange

  if (totalPages <= 1) return null

  var start = Math.floor((page - 1) / 5) * 5 + 1
  var end = Math.min(start + 4, totalPages)
  var pages = []
  for (var i = start; i <= end; i++) {
    pages.push(i)
  }

  return (
    <Flex justify="center" align="center" gap="6px" mt="16px">
      <Button h="28px" px="10px" fontSize="12px" rounded="6px"
        isDisabled={page <= 1}
        onClick={function() { onPageChange(page - 1) }}
        variant="outline" borderColor="#d1d5db">
        ‹
      </Button>
      {start > 1 && (
        <Button h="28px" px="10px" fontSize="12px" rounded="6px"
          variant="outline" borderColor="#d1d5db"
          onClick={function() { onPageChange(start - 1) }}>
          ...
        </Button>
      )}
      {pages.map(function(p) {
        return (
          <Button key={p} h="28px" px="12px" fontSize="12px" rounded="6px"
            bg={p === page ? '#22c55e' : 'transparent'}
            color={p === page ? 'white' : '#666'}
            variant={p === page ? 'solid' : 'outline'}
            borderColor={p === page ? '#22c55e' : '#d1d5db'}
            _hover={p === page ? { bg: '#16a34a' } : { bg: '#f9fafb' }}
            onClick={function() { onPageChange(p) }}>
            {p}
          </Button>
        )
      })}
      {end < totalPages && (
        <Button h="28px" px="10px" fontSize="12px" rounded="6px"
          variant="outline" borderColor="#d1d5db"
          onClick={function() { onPageChange(end + 1) }}>
          ...
        </Button>
      )}
      <Button h="28px" px="10px" fontSize="12px" rounded="6px"
        isDisabled={page >= totalPages}
        onClick={function() { onPageChange(page + 1) }}
        variant="outline" borderColor="#d1d5db">
        ›
      </Button>
    </Flex>
  )
}

var STATUS_TABS = [
  { key: 'open', label: '🟢 ' + t('issue.open') },
  { key: 'closed', label: '✅ ' + t('issue.closed') },
  { key: 'all', label: '📋 ' + t('common.all') },
]

const ProjectIssues = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const { isGuest } = useAuth()
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [openCount, setOpenCount] = useState(0)
  const [closedCount, setClosedCount] = useState(0)
  const [repoInfo, setRepoInfo] = useState(null)

  useEffect(function() {
    reposAPI.get(owner, repo).then(function(data) { setRepoInfo(data) }).catch(function() {})
  }, [owner, repo])

  useEffect(function() {
    setLoading(true)
    setPage(1)
  }, [statusFilter])

  useEffect(function() {
    setLoading(true)
    var params = { page: page, per_page: PAGE_SIZE }
    if (statusFilter !== 'all') params.state = statusFilter
    issuesAPI.list(owner, repo, params).then(function(res) {
      setIssues(Array.isArray(res.data) ? res.data : [])
      setTotal(res.total || 0)
    }).catch(function() {
      setIssues([])
      setTotal(0)
    }).finally(function() { setLoading(false) })
  }, [owner, repo, page, statusFilter])

  useEffect(function() {
    issuesAPI.list(owner, repo, { page: 1, per_page: 1, state: 'open' }).then(function(res) {
      setOpenCount(res.total || 0)
    }).catch(function() {})
    issuesAPI.list(owner, repo, { page: 1, per_page: 1, state: 'closed' }).then(function(res) {
      setClosedCount(res.total || 0)
    }).catch(function() {})
  }, [owner, repo])

  var totalPages = Math.ceil(total / PAGE_SIZE) || 1

  var filtered = issues.filter(function(i) {
    var matchSearch = i.title.toLowerCase().indexOf(search.toLowerCase()) >= 0
    if (!matchSearch) return false
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
            return (
              <Button key={tab.key} h="30px" px="12px" fontSize="13px" rounded="6px" variant="ghost"
                color={isActive ? '#16a34a' : '#888'}
                bg={isActive ? '#f0fdf4' : 'transparent'}
                _hover={{ bg: isActive ? '#f0fdf4' : '#f9fafb', color: isActive ? '#16a34a' : '#333' }}
                onClick={function() { setStatusFilter(tab.key) }}>
                {tab.label} ({tab.key === 'all' ? (openCount + closedCount) : (tab.key === 'open' ? openCount : closedCount)})
              </Button>
            )
          })}
        </HStack>
        {repoInfo && repoInfo.project_type !== 'mirror' && (
        <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }}
          onClick={function() { navigate('/' + owner + '/' + repo + '/issues/new') }} isDisabled={isGuest}>
          {t('issue.newIssue')}
        </Button>
        )}
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

      <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />

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