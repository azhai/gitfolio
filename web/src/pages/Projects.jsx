import React, { useState, useEffect } from 'react'
import { Box, Text, Input, Flex, HStack, Badge, Button, Spinner, SimpleGrid } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { reposAPI } from '../api/index'
import { timeAgo } from '../i18n/zh'

var LANG_COLORS = {
  Go: '#00ADD8', JavaScript: '#F7DF1E', TypeScript: '#3178C6',
  Python: '#3572A5', Ruby: '#701516', Java: '#b07219',
  Rust: '#dea584', PHP: '#4F5D95', 'C++': '#f34b7d',
  C: '#555555', Shell: '#89e051', HTML: '#e34c26',
  CSS: '#563d7c', SQL: '#4479A1', Markdown: '#083FA1',
  YAML: '#CB171E', JSON: '#292929', Dockerfile: '#384d54',
}

var TABS = [
  { key: 'all', label: '全部' },
  { key: 'my', label: '我的' },
  { key: 'starred', label: '星标' },
]

const Projects = () => {
  const [repos, setRepos] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')

  useEffect(() => {
    reposAPI.list().then(function(data) {
      setRepos(Array.isArray(data) ? data : [])
    }).catch(function() { setRepos([]) }).finally(function() { setLoading(false) })
  }, [])

  var filtered = repos.filter(function(p) {
    var q = search.toLowerCase()
    var matchSearch = ((p.owner || '') + '/' + (p.name || '') + ' ' + (p.description || '')).toLowerCase().indexOf(q) >= 0
    if (!matchSearch) return false
    if (tab === 'my') return p.is_owner || p.owner === (repos._currentUser || '')
    if (tab === 'starred') return p.is_starred || p.starred
    return true
  })

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="80px">
        <Spinner size="xl" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb="20px">
        <Text fontSize="22px" fontWeight="700" color="#333">📂 项目</Text>
        <HStack gap="8px">
          <Button h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
            as={RouterLink} to="/projects/migrate">
            迁移项目
          </Button>
          <Button h="32px" px="16px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} as={RouterLink} to="/projects/new">
            + 新建项目
          </Button>
        </HStack>
      </Flex>

      <Flex gap="16px" mb="16px">
        {TABS.map(function(t) {
          var isActive = tab === t.key
          return (
            <Button key={t.key} h="30px" px="14px" fontSize="13px" rounded="6px"
              bg={isActive ? '#22c55e' : '#f3f4f6'} color={isActive ? 'white' : '#666'}
              _hover={{ bg: isActive ? '#16a34a' : '#e5e7eb' }}
              onClick={function() { setTab(t.key) }}>
              {t.label}
            </Button>
          )
        })}
      </Flex>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="24px">
        <Input placeholder="搜索项目..." value={search} onChange={function(e) { setSearch(e.target.value) }}
          h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
          _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
      </Box>

      <SimpleGrid columns={2} spacing="14px">
        {filtered.map(function(p) {
          return (
            <RouterLink key={p.id || p.name} to={'/' + p.owner + '/' + p.name}>
              <Box bg="white" border="1px solid" borderColor="#e2e2e2"
                rounded="10px" p="20px" cursor="pointer" transition="all 0.15s" h="full"
                _hover={{ borderColor: '#22c55e', boxShadow: '0 2px 8px rgba(34,197,94,0.08)' }}>
                <Box mb="8px">
                  <HStack gap="10px" mb="6px" flexWrap="wrap">
                    <Text fontSize="15px" fontWeight="600" color="#333">
                      {p.owner}/<Text as="span" color="#16a34a">{p.name}</Text>
                    </Text>
                    <Badge fontSize="11px" px="8px" py="1px" rounded="4px"
                      colorScheme={p.is_private ? 'red' : 'green'} variant="subtle">
                      {p.is_private ? '私有' : '公开'}
                    </Badge>
                  </HStack>
                  <Text fontSize="13.5px" color="#666" mb="12px" noOfLines={2}>{p.description || '暂无描述'}</Text>
                </Box>
                <HStack gap="18px" fontSize="12.5px" color="#888">
                  <HStack gap="4px"><Text>⭐</Text><Text>{p.stars_count || 0}</Text></HStack>
                  <HStack gap="4px"><Text>🔀</Text><Text>{p.forks_count || 0}</Text></HStack>
                  {p.language && (
                    <HStack gap="5px">
                      <Box w="12px" h="12px" rounded="full" bg={LANG_COLORS[p.language] || '#888'} />
                      <Text>{p.language}</Text>
                    </HStack>
                  )}
                </HStack>
                <Text fontSize="12px" color="#aaa" mt="8px">更新于 {timeAgo(p.updated_at || p.last_commit_at)}</Text>
              </Box>
            </RouterLink>
          )
        })}
      </SimpleGrid>

      {!loading && filtered.length === 0 && (
        <Box textAlign="center" py="60px" color="#aaa">
          <Text fontSize="40px" mb="8px">🔍</Text>
          <Text fontSize="15px">未找到项目</Text>
        </Box>
      )}
    </Box>
  )
}

export default Projects
