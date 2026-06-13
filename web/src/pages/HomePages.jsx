// Merged home pages

import React, { useEffect, useRef, useState } from 'react'
import { Badge, Box, Button, Flex, HStack, Input, SimpleGrid, Spinner, Switch, Text, Textarea, VStack, useToast } from '@chakra-ui/react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { reposAPI, statsAPI } from '../api/index'
import { t, timeAgo } from '../i18n'
import { LuEye as Eye, LuGlobe as Globe, LuHardDrive as HardDrive, LuLock as Lock, LuRocket as Rocket, LuSparkles as Sparkles } from 'react-icons/lu'
import { IconMap, NavIcons } from '../components/Icons'
import { useAuth } from '../contexts/AuthContext'

// ─── Dashboard ───

const Dashboard = () => {
  const [stats, setStats] = useState(null)
  const [repos, setRepos] = useState([])
  const [recentIssues, setRecentIssues] = useState([])
  const [recentTasks, setRecentTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      statsAPI.get().catch(function() { return null }),
      reposAPI.list({ per_page: 5 }).catch(function() { return [] }),
      statsAPI.recentIssues(5).catch(function() { return [] }),
      statsAPI.recentTasks(5).catch(function() { return [] }),
    ]).then(function([s, r, issues, tasks]) {
      setStats(s)
      setRepos(Array.isArray(r) ? r : [])
      setRecentIssues(Array.isArray(issues) ? issues : [])
      setRecentTasks(Array.isArray(tasks) ? tasks : [])
    }).finally(function() { setLoading(false) })
  }, [])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="80px">
        <Spinner size="xl" color="#22c55e" />
      </Box>
    )
  }

  var s = stats || {}

  var statusMap = {
    draft: { bg: '#f3f4f6', color: '#6b7280', label: t('task.draft') },
    todo: { bg: '#dbeafe', color: '#2563eb', label: t('task.todo') },
    in_progress: { bg: '#fef3c7', color: '#d97706', label: t('task.inProgress') },
    review: { bg: '#ede9fe', color: '#7c3aed', label: t('task.review') },
    done: { bg: '#dcfce7', color: '#16a34a', label: t('task.done') },
    cancelled: { bg: '#fef2f2', color: '#dc2626', label: t('task.cancelled') },
  }

  return (
    <Box>
      <Box
        bg="linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
        rounded="12px"
        p="40px"
        color="white"
        mb="24px"
      >
        <HStack gap="10px" mb="8px">
          <Rocket size={28} color="white" />
          <Text fontSize="28px" fontWeight="bold" color="white">{t('dashboard.welcome')}</Text>
        </HStack>
        <Text fontSize="15px" opacity="0.9">{t('dashboard.subtitle')}</Text>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap="20px" mb="28px">
        {[
          { label: t('dashboard.totalRepos'), value: s.total_repos || 0, sub: (s.total_repos || 0) + ' ' + t('dashboard.totalReposUnit') },
          { label: t('issue.openIssue'), value: s.open_issues || 0, sub: (s.closed_issues || 0) + ' ' + t('dashboard.closedIssues') },
          { label: t('pr.mergeRequest'), value: s.open_prs || 0, sub: (s.closed_prs || 0) + ' ' + t('pr.closed') },
          { label: t('dashboard.totalStars'), value: s.total_stars || 0, sub: (s.total_forks || 0) + ' ' + t('dashboard.totalForks') },
        ].map(function(item) {
          return (
            <Box key={item.label} bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px">
              <Text fontSize="13px" color="#888" mb="8px">{item.label}</Text>
              <Text fontSize="32px" fontWeight="700" color="#333">{item.value}</Text>
              <Text fontSize="13px" color="#16a34a" mt="8px">{item.sub}</Text>
            </Box>
          )
        })}
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, lg: 3 }} gap="20px">
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px">
          <Text fontSize="15px" fontWeight="600" color="#333" mb="14px">{t('dashboard.recentProjects')}</Text>
          <VStack spacing="10px" align="stretch">
            {repos.slice(0, 5).map(function(repo) {
              return (
                <Box key={repo.id || repo.name} as={RouterLink} to={'/' + repo.owner + '/' + repo.name}
                  p="10px 12px" rounded="8px" transition="all 0.15s"
                  _hover={{ bg: '#f9fafb' }}>
                  <Flex align="center" gap="8px" mb="4px">
                    <Text fontSize="14px" fontWeight="600" color="#16a34a">{repo.name}</Text>
                    <Badge fontSize="10px" px="5px" py="1px" rounded="3px"
                      bg={repo.project_type === 'mirror' ? '#eff6ff' : repo.project_type === 'public' ? '#f0fdf4' : repo.project_type === 'private' ? '#fff7ed' : '#f3f4f6'}
                      color={repo.project_type === 'mirror' ? '#2563eb' : repo.project_type === 'public' ? '#16a34a' : repo.project_type === 'private' ? '#ea580c' : '#6b7280'}
                      fontWeight="500">
                      {repo.project_type === 'mirror' ? t('project.mirror') : repo.project_type === 'public' ? t('project.public') : repo.project_type === 'private' ? t('project.private') : t('common.local')}
                    </Badge>
                  </Flex>
                  <Text fontSize="12px" color="#888" noOfLines={1}>{repo.description || t('dashboard.noDescription')}</Text>
                </Box>
              )
            })}
            {repos.length === 0 && <Text fontSize="13px" color="#aaa" textAlign="center" py="16px">{t('dashboard.noProjects')}</Text>}
          </VStack>
        </Box>

        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px">
          <Text fontSize="15px" fontWeight="600" color="#333" mb="14px">{t('dashboard.recentIssues')}</Text>
          <VStack spacing="10px" align="stretch">
            {recentIssues.slice(0, 5).map(function(issue) {
              return (
                <Box key={issue.id || issue.number} as={RouterLink}
                  to={'/' + issue.owner + '/' + issue.repo + '/issues/' + issue.number}
                  p="10px 12px" rounded="8px" transition="all 0.15s"
                  _hover={{ bg: '#f9fafb' }}>
                  <Flex align="center" gap="6px" mb="4px">
                    {issue.is_closed ? (
                      <Badge fontSize="10px" px="5px" py="1px" rounded="3px" bg="#fef2f2" color="#dc2626">{t('common.closed')}</Badge>
                    ) : (
                      <Badge fontSize="10px" px="5px" py="1px" rounded="3px" bg="#dcfce7" color="#16a34a">{t('common.open')}</Badge>
                    )}
                    <Text fontSize="13px" fontWeight="500" color="#333" noOfLines={1}>{issue.title}</Text>
                  </Flex>
                  <Text fontSize="12px" color="#888">#{issue.number} · {issue.owner}/{issue.repo} · {timeAgo(issue.created_at)}</Text>
                </Box>
              )
            })}
            {recentIssues.length === 0 && <Text fontSize="13px" color="#aaa" textAlign="center" py="16px">{t('dashboard.noIssues')}</Text>}
          </VStack>
        </Box>

        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px">
          <Text fontSize="15px" fontWeight="600" color="#333" mb="14px">{t('dashboard.recentTasks')}</Text>
          <VStack spacing="10px" align="stretch">
            {recentTasks.slice(0, 5).map(function(task) {
              var st = statusMap[task.status] || statusMap.draft
              return (
                <Box key={task.id} as={RouterLink}
                  to={'/' + task.owner + '/' + task.repo + '/tasks/' + task.id}
                  p="10px 12px" rounded="8px" transition="all 0.15s"
                  _hover={{ bg: '#f9fafb' }}>
                  <Flex align="center" gap="6px" mb="4px">
                    <Badge fontSize="10px" px="5px" py="1px" rounded="3px" bg={st.bg} color={st.color}>{st.label}</Badge>
                    <Text fontSize="13px" fontWeight="500" color="#333" noOfLines={1}>{task.title}</Text>
                  </Flex>
                  <Text fontSize="12px" color="#888">{task.owner}/{task.repo} · {timeAgo(task.created_at)}</Text>
                </Box>
              )
            })}
            {recentTasks.length === 0 && <Text fontSize="13px" color="#aaa" textAlign="center" py="16px">{t('dashboard.noTasks')}</Text>}
          </VStack>
        </Box>
      </SimpleGrid>
    </Box>
  )
}



// ─── Projects ───

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
  const { isGuest } = useAuth()

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
            as={RouterLink} to="/projects/migrate" isDisabled={isGuest}>
            {t('projects.migrateProject')}
          </Button>
          <Button h="32px" px="16px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} as={RouterLink} to="/projects/new" isDisabled={isGuest}>
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
                        bg={p.project_type === 'mirror' ? '#eff6ff' : p.project_type === 'public' ? '#f0fdf4' : p.project_type === 'private' ? '#fff7ed' : '#f3f4f6'}
                        color={p.project_type === 'mirror' ? '#2563eb' : p.project_type === 'public' ? '#16a34a' : p.project_type === 'private' ? '#ea580c' : '#6b7280'}
                        fontWeight="500">
                        {p.project_type === 'mirror' ? t('project.mirror') : p.project_type === 'public' ? t('project.public') : p.project_type === 'private' ? t('project.private') : t('common.local')}
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



// ─── CreateProject ───

const CreateProject = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    homepage: '',
    project_type: 'local',
    default_branch: 'main',
    init_readme: true,
  })

  function updateField(key) {
    return function(e) {
      var val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm(function(prev) { return Object.assign({}, prev, { [key]: val }) })
    }
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: t('createProject.nameRequired'), status: 'error', duration: 3000 })
      return
    }
    setSubmitting(true)
    reposAPI.create(form).then(function(data) {
      navigate('/' + (data.owner || 'ryan') + '/' + data.name)
    }).catch(function(err) {
      toast({ title: err.message || t('createProject.createFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  return (
    <Box maxW="720px" mx="auto">
      <Text fontSize="22px" fontWeight="700" color="#333" mb="24px">{t('createProject.title')}</Text>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="28px">
        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('createProject.projectName')} *</Text>
          <Input value={form.name} onChange={updateField('name')}
            placeholder="my-project" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          <Text fontSize="12px" color="#999" mt="4px">{t('createProject.nameHint')}</Text>
        </Box>

        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('createProject.description')}</Text>
          <Textarea value={form.description} onChange={updateField('description')}
            placeholder={t('createProject.descriptionOptional')} fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={3}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('createProject.homepage')}</Text>
          <Input value={form.homepage} onChange={updateField('homepage')}
            placeholder="https://example.com" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('createProject.defaultBranch')}</Text>
          <Input value={form.default_branch} onChange={updateField('default_branch')}
            placeholder="main" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="24px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="12px">{t('createProject.projectType')}</Text>
          <Flex
            flex={1} direction="column" align="center" p="16px"
            border="2px solid" borderColor="#22c55e"
            rounded="10px" bg="#f0fdf4"
          >
            <HardDrive size={22} color="#16a34a" mb="6px" />
            <Text fontSize="13px" fontWeight="600" color="#16a34a">{t('createProject.localProject')}</Text>
            <Text fontSize="11px" color="#888" mt="4px" textAlign="center">{t('createProject.localProjectDesc')}</Text>
          </Flex>
        </Box>

        <Flex align="center" justify="space-between" mb="24px" py="10px" borderBottom="1px solid" borderColor="#f0f0f0">
          <Box>
            <Text fontSize="13.5px" fontWeight="500" color="#555">{t('createProject.initReadme')}</Text>
            <Text fontSize="12px" color="#888">{t('createProject.initReadmeDesc')}</Text>
          </Box>
          <Switch colorScheme="green" isChecked={form.init_readme} onChange={updateField('init_readme')} />
        </Flex>

        <Flex justify="flex-end" gap="10px">
          <Button h="36px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>
            {t('common.cancel')}
          </Button>
          <Button h="36px" px="24px" fontSize="14px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>
            {t('createProject.createProject')}
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}



// ─── MigratePages ───

// ─── MigrateProgress ───────────────────────────────────────────

const MigrateProgress = ({ repoInfo, onStatusChange }) => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [retrying, setRetrying] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const timerRef = useRef(null)

  useEffect(function() {
    if (!repoInfo) return
    var status = repoInfo.migrate_status
    if (status === 'completed' || status === 'failed') {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      if (status === 'completed') { toast({ title: t('migrateProject.cloneSuccess'), status: 'success', duration: 3000 }) }
      return
    }
    if (timerRef.current) return
    timerRef.current = setInterval(function() {
      reposAPI.get(owner, repo).then(function(info) {
        if (onStatusChange) onStatusChange(info)
      }).catch(function() {})
    }, 3000)
    return function() { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
  }, [owner, repo, repoInfo, onStatusChange, toast])

  function handleRetry() {
    setRetrying(true)
    reposAPI.retryMigrate(owner, repo).then(function() {
      if (onStatusChange) onStatusChange(Object.assign({}, repoInfo, { migrate_status: 'cloning', migrate_error: '' }))
      toast({ title: t('migrateProject.retryStarted'), status: 'info', duration: 2000 })
    }).catch(function(err) { toast({ title: err.message || t('migrateProject.retryFailed'), status: 'error', duration: 3000 }) })
      .finally(function() { setRetrying(false) })
  }

  function handleCancel() {
    setCancelling(true)
    reposAPI.del(owner, repo).then(function() {
      toast({ title: t('migrateProject.cancelled'), status: 'info', duration: 2000 })
      navigate('/projects', { replace: true })
    }).catch(function(err) { toast({ title: err.message || t('migrateProject.cancelFailed'), status: 'error', duration: 3000 }) })
      .finally(function() { setCancelling(false) })
  }

  var info = repoInfo || {}
  var isCloning = info.migrate_status === 'cloning'
  var isFailed = info.migrate_status === 'failed'
  var isCompleted = info.migrate_status === 'completed'

  return (
    <Box maxW="640px" mx="auto" pt="80px">
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="12px" p="40px" textAlign="center">
        {(isCloning || (!isFailed && !isCompleted)) && (
          <>
            <Spinner size="xl" color="#2563eb" mb="20px" />
            <Text fontSize="20px" fontWeight="700" color="#1e40af" mb="8px">{t('migrateProject.cloning')}</Text>
            <Text fontSize="14px" color="#6b7280" mb="6px">{t('migrateProject.cloningHint')}</Text>
            <Text fontSize="13px" color="#9ca3af" mb="28px">{info.mirror_url}</Text>
            <Flex justify="center" gap="12px">
              <Button h="36px" px="20px" fontSize="13px" rounded="6px" variant="outline" borderColor="#d1d5db" color="#666"
                _hover={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={handleCancel} isLoading={cancelling}>{t('migrateProject.cancel')}</Button>
            </Flex>
          </>
        )}
        {isFailed && (
          <>
            <Text fontSize="36px" mb="12px">⚠️</Text>
            <Text fontSize="20px" fontWeight="700" color="#dc2626" mb="8px">{t('migrateProject.cloneFailed')}</Text>
            {info.migrate_error && (
              <Box bg="#fef2f2" border="1px solid #fecaca" rounded="6px" p="12px" mb="16px" textAlign="left">
                <Text fontSize="12px" color="#991b1b" fontFamily="monospace" whiteSpace="pre-wrap" wordBreak="break-all">{info.migrate_error}</Text>
              </Box>
            )}
            <Text fontSize="13px" color="#9ca3af" mb="28px">{info.mirror_url}</Text>
            <Flex justify="center" gap="12px">
              <Button h="36px" px="20px" fontSize="13px" rounded="6px" variant="outline" borderColor="#d1d5db" color="#666"
                _hover={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={handleCancel} isLoading={cancelling}>{t('migrateProject.cancel')}</Button>
              <Button h="36px" px="24px" fontSize="13px" rounded="6px" bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }}
                onClick={handleRetry} isLoading={retrying}>{t('migrateProject.retry')}</Button>
            </Flex>
          </>
        )}
      </Box>
    </Box>
  )
}

// ─── MigrateProject ────────────────────────────────────────────

const MigrateProject = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', clone_url: '', homepage: '', project_type: 'mirror' })

  function updateField(key) {
    return function(e) {
      var val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm(function(prev) { return Object.assign({}, prev, { [key]: val }) })
    }
  }

  function handleSubmit() {
    if (!form.name.trim()) { toast({ title: t('migrateProject.nameRequired'), status: 'error', duration: 3000 }); return }
    if (!form.clone_url.trim()) { toast({ title: t('migrateProject.urlRequired'), status: 'error', duration: 3000 }); return }
    setSubmitting(true)
    reposAPI.create(Object.assign({}, form)).then(function(data) {
      if (data.migrate_status === 'cloning') { navigate('/' + (data.owner || 'ryan') + '/' + data.name + '?migrating=1') }
      else { navigate('/' + (data.owner || 'ryan') + '/' + data.name) }
    }).catch(function(err) { toast({ title: err.message || t('migrateProject.migrateFailed'), status: 'error', duration: 3000 }) })
      .finally(function() { setSubmitting(false) })
  }

  function handleDetect() {
    var url = form.clone_url.trim()
    if (!url) { toast({ title: t('migrateProject.enterUrlFirst'), status: 'warning', duration: 2500 }); return }
    setDetecting(true)
    reposAPI.detectRepo(url).then(function(data) {
      setForm(function(prev) { return Object.assign({}, prev, { name: data.name || prev.name, description: data.description || prev.description, homepage: data.homepage || prev.homepage }) })
      toast({ title: t('migrateProject.autoFilled'), description: (data.name || '') + (data.description ? ' - ' + data.description : ''), status: 'success', duration: 2500 })
    }).catch(function(err) { toast({ title: err.message || t('migrateProject.detectFailed'), status: 'error', duration: 3000 }) })
      .finally(function() { setDetecting(false) })
  }

  return (
    <Box maxW="720px" mx="auto">
      <Text fontSize="22px" fontWeight="700" color="#333" mb="24px">{t('migrateProject.title')}</Text>
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="28px">
        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('migrateProject.remoteUrl')} *</Text>
          <Flex gap="10px">
            <Input value={form.clone_url} onChange={updateField('clone_url')} placeholder="https://github.com/user/repo.git" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
              _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} flex={1} />
            <Button h="40px" px="16px" fontSize="13px" rounded="8px" bg={detecting ? '#e5e7eb' : '#8b5cf6'} color={detecting ? '#9ca3af' : 'white'}
              _hover={{ bg: detecting ? '#e5e7eb' : '#7c3aed' }} onClick={handleDetect} isLoading={detecting} loadingText={t('migrateProject.detecting')}
              leftIcon={<Sparkles size={16} />} whiteSpace="nowrap">
              {detecting ? t('migrateProject.detecting') : t('migrateProject.autoFill')}
            </Button>
          </Flex>
          <Text fontSize="12px" color="#999" mt="4px">{t('migrateProject.urlHint')}</Text>
        </Box>
        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('migrateProject.projectName')} *</Text>
          <Input value={form.name} onChange={updateField('name')} placeholder="my-project" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('migrateProject.description')}</Text>
          <Textarea value={form.description} onChange={updateField('description')} placeholder={t('migrateProject.descriptionOptional')} fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={3}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('migrateProject.homepage')}</Text>
          <Input value={form.homepage} onChange={updateField('homepage')} placeholder="https://example.com" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          <Text fontSize="12px" color="#999" mt="4px">{t('migrateProject.homepageHint')}</Text>
        </Box>
        <Box mb="24px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="12px">{t('migrateProject.projectType')}</Text>
          <HStack gap="10px" align="stretch">
            {[
              { key: 'mirror', icon: Globe, color: '#2563eb', border: '#2563eb', bg: '#eff6ff', label: t('project.mirror'), desc: t('migrateProject.mirrorDesc') },
              { key: 'public', icon: Eye, color: '#16a34a', border: '#16a34a', bg: '#f0fdf4', label: t('project.public'), desc: t('migrateProject.publicDesc') },
              { key: 'private', icon: Lock, color: '#ea580c', border: '#ea580c', bg: '#fff7ed', label: t('project.private'), desc: t('migrateProject.privateDesc') },
            ].map(function(pt) {
              var selected = form.project_type === pt.key
              var Icon = pt.icon
              return (
                <Box key={pt.key} flex={1} as="button" type="button" direction="column" align="center" p="14px"
                  border="2px solid" borderColor={selected ? pt.border : '#e2e2e2'} rounded="10px" bg={selected ? pt.bg : 'white'}
                  cursor="pointer" transition="all 0.15s" _hover={{ borderColor: pt.border }}
                  onClick={function() { setForm(function(p) { return Object.assign({}, p, { project_type: pt.key }) }) }}
                  display="flex" flexDirection="column" alignItems="center">
                  <Icon size={22} color={pt.color} />
                  <Text fontSize="13px" fontWeight="600" color={pt.color} mt="6px">{pt.label}</Text>
                  <Text fontSize="11px" color="#888" mt="4px" textAlign="center">{pt.desc}</Text>
                </Box>
              )
            })}
          </HStack>
        </Box>
        <Flex justify="flex-end" gap="10px">
          <Button h="36px" px="16px" fontSize="13px" rounded="6px" variant="outline" borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>{t('common.cancel')}</Button>
          <Button h="36px" px="24px" fontSize="14px" rounded="6px" bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>{t('migrateProject.migrateProject')}</Button>
        </Flex>
      </Box>
    </Box>
  )
}

// ─── exports ───────────────────────────────────────────────────



export { Dashboard, Projects, CreateProject, MigrateProject, MigrateProgress }
