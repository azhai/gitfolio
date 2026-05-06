import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Button, Spinner, Input } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { prsAPI } from '../../api/index'
import { timeAgo } from '../../i18n/zh'

var STATUS_MAP = {
  open: { label: '开启中', bg: '#dcfce7', color: '#16a34a' },
  merged: { label: '已合并', bg: '#ede9fe', color: '#7c3aed' },
  closed: { label: '已关闭', bg: '#fef2f2', color: '#dc2626' },
}

var STATUS_TABS = [
  { key: 'open', label: '🟢 开启中' },
  { key: 'merged', label: '🔀 已合并' },
  { key: 'closed', label: '✅ 已关闭' },
  { key: 'all', label: '📋 全部' },
]

const ProjectMRs = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const [prs, setPrs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')

  useEffect(() => {
    prsAPI.list(owner, repo).then(function(data) {
      setPrs(Array.isArray(data) ? data : [])
    }).catch(function() { setPrs([]) }).finally(function() { setLoading(false) })
  }, [owner, repo])

  var openCount = prs.filter(function(pr) { return !pr.is_closed && !pr.is_merged }).length
  var mergedCount = prs.filter(function(pr) { return pr.is_merged }).length
  var closedCount = prs.filter(function(pr) { return pr.is_closed && !pr.is_merged }).length

  var filtered = prs.filter(function(pr) {
    var matchSearch = pr.title.toLowerCase().indexOf(search.toLowerCase()) >= 0
    if (!matchSearch) return false
    if (statusFilter === 'open') return !pr.is_closed && !pr.is_merged
    if (statusFilter === 'merged') return pr.is_merged
    if (statusFilter === 'closed') return pr.is_closed && !pr.is_merged
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
            var count = tab.key === 'open' ? openCount : (tab.key === 'merged' ? mergedCount : (tab.key === 'closed' ? closedCount : prs.length))
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
          onClick={function() { navigate('/' + owner + '/' + repo + '/pull_requests/new') }}>
          新建合并请求
        </Button>
      </Flex>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="16px" mb="16px">
        <Input placeholder="搜索合并请求..." value={search} onChange={function(e) { setSearch(e.target.value) }}
          h="34px" fontSize="13.5px" borderRadius="8px" borderColor="#d1d5db"
          _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
      </Box>

      <VStack spacing="10px" align="stretch">
        {filtered.map(function(pr) {
          var status = pr.is_merged ? 'merged' : (pr.is_closed ? 'closed' : 'open')
          var cfg = STATUS_MAP[status] || STATUS_MAP.open
          return (
            <Box key={pr.id} bg="white" border="1px solid" borderColor="#e2e2e2"
              rounded="8px" p="16px 20px" transition="all 0.15s"
              _hover={{ borderColor: '#d1d5db', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              cursor="pointer"
              onClick={function() { navigate('/' + owner + '/' + repo + '/pull_requests/' + pr.number) }}>
              <Flex justify="space-between" align="start">
                <Box flex={1}>
                  <HStack gap="8px" mb="4px" align="center">
                    <Badge fontSize="11px" px="7px" py="1px" rounded="4px" bg={cfg.bg} color={cfg.color}>
                      {cfg.label}
                    </Badge>
                    <Text fontSize="13.5px" fontWeight="600" color="#333">{pr.title}</Text>
                  </HStack>
                  <Text fontSize="12.5px" color="#888" noOfLines={1}>
                    #{pr.number} 由 {pr.author || '未知'}
                    {' '}<Text as="span" color="#16a34a">{pr.source_branch}</Text> → <Text as="span" color="#dc2626">{pr.target_branch}</Text>
                    {' · '}{timeAgo(pr.updated_at)}
                    {pr.comments_count > 0 && ' · 💬 ' + pr.comments_count}
                  </Text>
                </Box>
              </Flex>
            </Box>
          )
        })}
      </VStack>

      {!loading && filtered.length === 0 && (
        <Box textAlign="center" py="50px" color="#aaa">
          <Text fontSize="36px" mb="6px">🔀</Text>
          <Text fontSize="14px">暂无合并请求</Text>
        </Box>
      )}
    </Box>
  )
}

export default ProjectMRs
