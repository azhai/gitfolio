import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Outlet } from 'react-router-dom'
import { Box, Text, Spinner, HStack, Tabs, TabList, Tab, Badge, Flex, Button } from '@chakra-ui/react'
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom'
import { reposAPI } from '../api/index'
import { t, timeAgo } from '../i18n/index'
import { ProjectTabIcons, IconMap } from '../components/Icons'
import { MigrateProgress } from './HomePages'

const TABS = [
  { key: 'tree', labelKey: 'project.files', icon: 'code' },
  { key: 'commits', labelKey: 'project.commits', icon: 'commits' },
  { key: 'pull_requests', labelKey: 'project.mergeRequests', icon: 'pull_requests' },
  { key: 'issues', labelKey: 'project.issues', icon: 'issues' },
  { key: 'tasks', labelKey: 'project.tasks', icon: 'tasks' },
  { key: 'settings', labelKey: 'project.settings', icon: 'settings' },
]

function TabIcon({ name, size = 14 }) {
  var Comp = ProjectTabIcons[name]
  if (!Comp) return null
  return <Comp size={size} strokeWidth={2} />
}

const ProjectDetail = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [repoInfo, setRepoInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isStarred, setIsStarred] = useState(false)
  const [isWatched, setIsWatched] = useState(false)
  const [starCount, setStarCount] = useState(0)
  const [watchCount, setWatchCount] = useState(0)
  const [actionLoading, setActionLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  var fetchRepo = useCallback(function() {
    reposAPI.get(owner, repo)
      .then(function(info) {
        setRepoInfo(info)
        setIsStarred(!!info.is_starred)
        setIsWatched(!!info.is_watched)
        setStarCount(info.stars_count || 0)
        setWatchCount(info.watch_count || 0)
      })
      .catch(function() { setRepoInfo(null) })
      .finally(function() { setLoading(false) })
    reposAPI.refreshStats(owner, repo).then(function() {
      setTimeout(function() {
        reposAPI.get(owner, repo).then(function(info) {
          setRepoInfo(info)
          setStarCount(info.stars_count || 0)
          setWatchCount(info.watch_count || 0)
        }).catch(function() {})
      }, 2000)
    }).catch(function() {})
  }, [owner, repo])

  useEffect(function() {
    setLoading(true)
    fetchRepo()
  }, [fetchRepo])

  function handleStar() {
    if (actionLoading) return
    setActionLoading(true)
    var api = isStarred ? reposAPI.unstar(owner, repo) : reposAPI.star(owner, repo)
    api.then(function() {
      setIsStarred(!isStarred)
      setStarCount(function(prev) { return isStarred ? Math.max(0, prev - 1) : prev + 1 })
    })
    .catch(function() {})
    .finally(function() { setActionLoading(false) })
  }

  function handleWatch() {
    if (actionLoading) return
    setActionLoading(true)
    var api = isWatched ? reposAPI.unwatch(owner, repo) : reposAPI.watch(owner, repo)
    api.then(function() {
      setIsWatched(!isWatched)
      setWatchCount(function(prev) { return isWatched ? Math.max(0, prev - 1) : prev + 1 })
    })
    .catch(function() {})
    .finally(function() { setActionLoading(false) })
  }

  var basePath = '/' + owner + '/' + repo
  var path = location.pathname

  function getActiveTab() {
    if (path === basePath || path.startsWith(basePath + '/tree')) return 0
    if (path.startsWith(basePath + '/commits')) return 1
    if (path.startsWith(basePath + '/pull_requests')) return 2
    if (path.startsWith(basePath + '/issues')) return 3
    if (path.startsWith(basePath + '/tasks')) return 4
    if (path.startsWith(basePath + '/settings')) return 5
    return 0
  }

  function onTabChange(idx) {
    var tab = TABS[idx]
    var targetPath = tab.key === 'tree' ? basePath : basePath + '/' + tab.key
    if (location.pathname === targetPath) {
      setRefreshKey(function(k) { return k + 1 })
    } else {
      navigate(targetPath)
    }
  }

  var StarIcon = IconMap.star
  var ForkIcon = IconMap.pr
  var EyeIcon = IconMap.eye
  var CommitIcon = IconMap.commit
  var BranchIcon = IconMap.branch
  var TagIcon = IconMap.tag

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="80px">
        <Spinner size="xl" color="#22c55e" />
      </Box>
    )
  }

  var info = repoInfo || {}

  if (info.migrate_status === 'cloning' || info.migrate_status === 'failed') {
    return <MigrateProgress repoInfo={repoInfo} onStatusChange={setRepoInfo} />
  }

  return (
    <Box>
      <HStack gap="10px" mb="16px" align="center" flexWrap="wrap">
        <Text fontSize="20px" fontWeight="700" color="#333">{info.name || repo}</Text>
        {info.project_type === 'mirror' && info.mirror_url && (
            <Box as="a" href={info.mirror_url} target="_blank" rel="noopener noreferrer"
              fontSize="11px" px="8px" py="2px" bg="#eff6ff" color="#2563eb" fontWeight="600"
              border="1px solid #bfdbfe" rounded="4px" cursor="pointer"
              _hover={{ bg: '#dbeafe', borderColor: '#93c5fd', textDecoration: 'none' }}
              transition="all 0.15s">
              {t('project.mirror')}
            </Box>
        )}
        {info.project_type === 'mirror' && !info.mirror_url && (
          <Badge fontSize="11px" px="8px" py="1px" rounded="4px"
            bg="#eff6ff" color="#2563eb" fontWeight="500">{t('project.mirror')}</Badge>
        )}
        {info.project_type === 'public' && (
          <Badge fontSize="11px" px="8px" py="1px" rounded="4px"
            bg="#f0fdf4" color="#16a34a" fontWeight="500">{t('project.public')}</Badge>
        )}
        {info.project_type === 'private' && (
          <Badge fontSize="11px" px="8px" py="1px" rounded="4px"
            bg="#fff7ed" color="#ea580c" fontWeight="500">{t('project.private')}</Badge>
        )}
        {info.project_type === 'local' && (
          <Badge fontSize="11px" px="8px" py="1px" rounded="4px"
            bg="#f3f4f6" color="#6b7280" fontWeight="500">{t('common.local')}</Badge>
        )}
        <Text fontSize="13px" color="#666">{info.description || ''}</Text>
      </HStack>

      <HStack gap="8px" mb="16px" fontSize="12.5px" flexWrap="wrap">
        <RouterLink to={basePath + '/branches'}>
          <HStack gap="3px" color="#888" _hover={{ color: '#16a34a' }} transition="color 0.15s">
            <BranchIcon size={13} /><Text>{t('project.branchesCount', { count: info.branches_count || 0 })}</Text>
          </HStack>
        </RouterLink>
        <RouterLink to={basePath + '/tags'}>
          <HStack gap="3px" color="#888" _hover={{ color: '#16a34a' }} transition="color 0.15s">
            <TagIcon size={13} /><Text>{t('project.tagsCount', { count: info.tags_count || 0 })}</Text>
          </HStack>
        </RouterLink>
        <RouterLink to={basePath + '/commits'}>
          <HStack gap="3px" color="#888" _hover={{ color: '#16a34a' }} transition="color 0.15s">
            <CommitIcon size={13} /><Text>{t('project.commitsCount', { count: info.commits_count || 0 })}</Text>
          </HStack>
        </RouterLink>
        <Button size="xs" h="24px" px="8px" fontSize="12px" rounded="4px" ml="8px"
          bg={isStarred ? '#fff7ed' : '#f6f8fa'} border="1px solid" borderColor={isStarred ? '#fdba74' : '#d1d5db'}
          color={isStarred ? '#ea580c' : '#555'}
          _hover={{ bg: isStarred ? '#ffedd5' : '#eff2f5' }}
          _active={{ bg: isStarred ? '#ffedd5' : '#eff2f5' }}
          leftIcon={<StarIcon size={12} color={isStarred ? '#ea580c' : '#888'} />}
          onClick={handleStar} isLoading={actionLoading}>
          {isStarred ? t('project.starred') : t('project.star')} {starCount}
        </Button>
        <Button size="xs" h="24px" px="8px" fontSize="12px" rounded="4px"
          bg="#f6f8fa" border="1px solid" borderColor="#d1d5db" color="#555"
          _hover={{ bg: '#eff2f5' }} _active={{ bg: '#eff2f5' }}
          leftIcon={<ForkIcon size={12} color="#888" />}>
          {t('project.fork')} {info.forks_count || 0}
        </Button>
        <Button size="xs" h="24px" px="8px" fontSize="12px" rounded="4px"
          bg={isWatched ? '#f0fdf4' : '#f6f8fa'} border="1px solid" borderColor={isWatched ? '#86efac' : '#d1d5db'}
          color={isWatched ? '#16a34a' : '#555'}
          _hover={{ bg: isWatched ? '#dcfce7' : '#eff2f5' }}
          _active={{ bg: isWatched ? '#dcfce7' : '#eff2f5' }}
          leftIcon={<EyeIcon size={12} color={isWatched ? '#16a34a' : '#888'} />}
          onClick={handleWatch} isLoading={actionLoading}>
          {isWatched ? t('project.watched') : t('project.watch')} {watchCount}
        </Button>
      </HStack>

      <Box borderBottom="1px solid" borderColor="#e5e7eb" mb="20px">
        <Tabs index={getActiveTab()} onChange={onTabChange} isManual colorScheme="green">
          <TabList borderColor="transparent" pb={0}>
            {TABS.map(function(tab, idx) {
              return (
                <Tab key={tab.key} fontSize="13.5px" fontWeight="500" px="18px" pb="10px"
                  _selected={{ color: '#16a34a', borderColor: '#16a34a' }}
                  onClick={function() { onTabChange(idx) }}>
                  <HStack gap="5px"><TabIcon name={tab.icon} /><Text>{t(tab.labelKey)}</Text></HStack>
                </Tab>
              )
            })}
          </TabList>
        </Tabs>
      </Box>

      <Outlet key={location.pathname + '-' + refreshKey} />
    </Box>
  )
}

export default ProjectDetail
