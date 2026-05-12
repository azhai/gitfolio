import React, { useState, useEffect } from 'react'
import { Box, Text, SimpleGrid, Spinner, Flex, VStack, HStack, Badge } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { statsAPI, reposAPI } from '../api/index'
import { timeAgo, t } from '../i18n'
import { LuRocket as Rocket } from 'react-icons/lu'

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

export default Dashboard
