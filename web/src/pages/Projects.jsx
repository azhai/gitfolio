import React, { useState, useEffect } from 'react'
import { Box, Text, Input, Flex, HStack, Badge, Button, Spinner, SimpleGrid } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { reposAPI } from '../api/index'
import { IconMap, NavIcons } from '../components/Icons'
import { timeAgo, t } from '../i18n'

var LANG_COLORS = {
  Go: '#00ADD8', JavaScript: '#F7DF1E', TypeScript: '#3178C6',
  Python: '#3572A5', Ruby: '#701516', Java: '#b07219',
  Rust: '#dea584', PHP: '#4F5D95', 'C++': '#f34b7d',
  C: '#555555', Shell: '#89e051', HTML: '#e34c26',
  CSS: '#563d7c', SQL: '#4479A1', Markdown: '#083FA1',
  YAML: '#CB171E', JSON: '#292929', Dockerfile: '#384d54',
}

var TABS = [
  { key: 'all', labelKey: 'projects.tabAll' },
  { key: 'my', labelKey: 'projects.tabMy' },
  { key: 'starred', labelKey: 'projects.tabStarred' },
]

const Projects = () => {
  const [repos, setRepos] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(1)
  var PAGE_SIZE = 6

  useEffect(() => {
    reposAPI.list().then(function(data) {
      setRepos(Array.isArray(data) ? data : [])
    }).catch(function() { setRepos([]) }).finally(function() { setLoading(false) })
  }, [])

  useEffect(function() {
    setPage(1)
  }, [search, tab])

  var filtered = repos.filter(function(p) {
    var q = search.toLowerCase()
    var matchSearch = ((p.owner || '') + '/' + (p.name || '') + ' ' + (p.description || '')).toLowerCase().indexOf(q) >= 0
    if (!matchSearch) return false
    if (tab === 'my') return p.is_owner || p.owner === (repos._currentUser || '')
    if (tab === 'starred') return p.is_starred || p.starred
    return true
  })

  var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  var paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
        <Flex align="center" gap="8px">
          <NavIcons.project size={22} color="#333" />
          <Text fontSize="22px" fontWeight="700" color="#333">{t('projects.title')}</Text>
        </Flex>
        <HStack gap="8px">
          <Button h="32px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
            as={RouterLink} to="/projects/migrate">
            {t('projects.migrateProject')}
          </Button>
          <Button h="32px" px="16px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} as={RouterLink} to="/projects/new">
            {t('projects.newProject')}
          </Button>
        </HStack>
      </Flex>

      <Flex gap="16px" mb="16px">
        {TABS.map(function(item) {
          var isActive = tab === item.key
          return (
            <Button key={item.key} h="30px" px="14px" fontSize="13px" rounded="6px"
              bg={isActive ? '#22c55e' : '#f3f4f6'} color={isActive ? 'white' : '#666'}
              _hover={{ bg: isActive ? '#16a34a' : '#e5e7eb' }}
              onClick={function() { setTab(item.key) }}>
              {t(item.labelKey)}
            </Button>
          )
        })}
      </Flex>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="24px">
        <Input placeholder={t('projects.searchPlaceholder')} value={search} onChange={function(e) { setSearch(e.target.value) }}
          h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
          _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
      </Box>

      <SimpleGrid columns={2} spacing="14px">
        {paged.map(function(p) {
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
                    <HStack gap="6px" flexWrap="wrap">
                      <Badge fontSize="11px" px="8px" py="1px" rounded="4px"
                        bg={p.project_type === 'mirror' ? '#eff6ff' : '#f3f4f6'}
                        color={p.project_type === 'mirror' ? '#2563eb' : '#6b7280'}
                        fontWeight="500">
                        {p.project_type === 'mirror' ? t('project.mirror') : t('common.local')}
                      </Badge>
                    </HStack>
                  </HStack>
                  <Text fontSize="13.5px" color="#666" mb="12px" noOfLines={2}>{p.description || t('dashboard.noDescription')}</Text>
                  {p.mirror_url && (
                    <Text fontSize="12px" color="#2563eb" mb="10px" noOfLines={1}
                      as="a" href={p.mirror_url} target="_blank" rel="noopener noreferrer"
                      _hover={{ textDecoration: 'underline' }}>
                      {p.mirror_url.replace(/\.git$/, '')}
                    </Text>
                  )}
                </Box>
                <HStack gap="18px" fontSize="12.5px" color="#888">
                  <HStack gap="4px"><IconMap.star size={13} /><Text>{p.stars_count || 0}</Text></HStack>
                  <HStack gap="4px"><IconMap.pr size={13} /><Text>{p.forks_count || 0}</Text></HStack>
                  {p.language && (
                    <HStack gap="5px">
                      <Box w="12px" h="12px" rounded="full" bg={LANG_COLORS[p.language] || '#888'} />
                      <Text>{p.language}</Text>
                    </HStack>
                  )}
                </HStack>
                <Text fontSize="12px" color="#aaa" mt="8px">{t('projects.updatedAt')} {timeAgo(p.updated_at || p.last_commit_at)}</Text>
              </Box>
            </RouterLink>
          )
        })}
      </SimpleGrid>

      {totalPages > 1 && (
        <Flex justify="center" align="center" gap="8px" mt="20px">
          <Button h="32px" px="14px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666"
            _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
            _disabled={{ opacity: 0.4, cursor: 'not-allowed' }}
            isDisabled={page <= 1}
            onClick={function() { setPage(function(p) { return Math.max(1, p - 1) }) }}>
            {t('projects.prevPage')}
          </Button>
          <HStack gap="4px">
            {Array.from({ length: totalPages }, function(_, i) {
              var pageNum = i + 1
              return (
                <Button key={pageNum} h="30px" w="34px" minW="34px" px="0" fontSize="13px" rounded="6px"
                  bg={page === pageNum ? '#22c55e' : 'transparent'} color={page === pageNum ? 'white' : '#666'}
                  border="1px solid" borderColor={page === pageNum ? '#22c55e' : '#d1d5db'}
                  _hover={{ bg: page === pageNum ? '#16a34a' : '#f3f4f6', borderColor: page === pageNum ? '#16a34a' : '#c4c4c4' }}
                  onClick={function() { setPage(pageNum) }}>
                  {pageNum}
                </Button>
              )
            })}
          </HStack>
          <Button h="32px" px="14px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666"
            _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
            _disabled={{ opacity: 0.4, cursor: 'not-allowed' }}
            isDisabled={page >= totalPages}
            onClick={function() { setPage(function(p) { return Math.min(totalPages, p + 1) }) }}>
            {t('projects.nextPage')}
          </Button>
        </Flex>
      )}

      {!loading && filtered.length === 0 && (
        <Box textAlign="center" py="60px" color="#aaa">
          <IconMap.search size={40} />
          <Text fontSize="15px">{t('projects.notFound')}</Text>
        </Box>
      )}
    </Box>
  )
}

export default Projects
