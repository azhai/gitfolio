import React, { useState, useEffect } from 'react'
import { Box, Text, SimpleGrid, Spinner, Flex, VStack, HStack, Badge } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { statsAPI, reposAPI, issuesAPI, prsAPI } from '../api/index'
import { timeAgo, t } from '../i18n'
import { LuRocket as Rocket } from 'react-icons/lu'

const Dashboard = () => {
  const [stats, setStats] = useState(null)
  const [repos, setRepos] = useState([])
  const [recentIssues, setRecentIssues] = useState([])
  const [recentPRs, setRecentPRs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      statsAPI.get().catch(function() { return null }),
      reposAPI.list({ per_page: 5 }).catch(function() { return [] }),
    ]).then(function([s, r]) {
      setStats(s)
      setRepos(Array.isArray(r) ? r : [])

      var repoList = Array.isArray(r) ? r : []
      if (repoList.length > 0) {
        var firstRepo = repoList[0]
        var owner = firstRepo.owner || ''
        var name = firstRepo.name || ''
        if (owner && name) {
          Promise.all([
            issuesAPI.list(owner, name, { per_page: 5 }).catch(function() { return [] }),
            prsAPI.list(owner, name, { per_page: 5 }).catch(function() { return [] }),
          ]).then(function([issues, prs]) {
            setRecentIssues(Array.isArray(issues) ? issues : [])
            setRecentPRs(Array.isArray(prs) ? prs : [])
          })
        }
      }
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
          { label: t('pr.mergeRequest'), value: s.open_prs || 0, sub: (s.merged_prs || 0) + ' ' + t('dashboard.mergedPRs') },
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
                      bg={repo.project_type === 'private' ? '#fef2f2' : repo.project_type === 'public' ? '#dcfce7' : '#f3f4f6'}
                      color={repo.project_type === 'private' ? '#dc2626' : repo.project_type === 'public' ? '#16a34a' : '#6b7280'}
                      fontWeight="500">
                      {repo.project_type === 'private' ? t('common.private') : repo.project_type === 'public' ? t('common.public') : t('common.local')}
                    </Badge>
                    {repo.is_mirror && (
                      <Badge fontSize="10px" px="5px" py="1px" rounded="3px" bg="#eff6ff" color="#2563eb" fontWeight="500">
                        {t('project.mirror')}
                      </Badge>
                    )}
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
              var owner = issue.owner || (repos[0] && repos[0].owner) || ''
              var repoName = issue.repo || (repos[0] && repos[0].name) || ''
              return (
                <Box key={issue.id || issue.number} as={RouterLink}
                  to={'/' + owner + '/' + repoName + '/issues/' + issue.number}
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
                  <Text fontSize="12px" color="#888">#{issue.number} · {timeAgo(issue.created_at)}</Text>
                </Box>
              )
            })}
            {recentIssues.length === 0 && <Text fontSize="13px" color="#aaa" textAlign="center" py="16px">{t('dashboard.noIssues')}</Text>}
          </VStack>
        </Box>

        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px">
          <Text fontSize="15px" fontWeight="600" color="#333" mb="14px">{t('dashboard.recentMRs')}</Text>
          <VStack spacing="10px" align="stretch">
            {recentPRs.slice(0, 5).map(function(pr) {
              var owner = pr.owner || (repos[0] && repos[0].owner) || ''
              var repoName = pr.repo || (repos[0] && repos[0].name) || ''
              return (
                <Box key={pr.id || pr.number} as={RouterLink}
                  to={'/' + owner + '/' + repoName + '/pull_requests/' + pr.number}
                  p="10px 12px" rounded="8px" transition="all 0.15s"
                  _hover={{ bg: '#f9fafb' }}>
                  <Flex align="center" gap="6px" mb="4px">
                    {pr.is_merged ? (
                      <Badge fontSize="10px" px="5px" py="1px" rounded="3px" bg="#ede9fe" color="#7c3aed">{t('common.merged')}</Badge>
                    ) : pr.is_closed ? (
                      <Badge fontSize="10px" px="5px" py="1px" rounded="3px" bg="#fef2f2" color="#dc2626">{t('common.closed')}</Badge>
                    ) : (
                      <Badge fontSize="10px" px="5px" py="1px" rounded="3px" bg="#dbeafe" color="#2563eb">{t('common.inReview')}</Badge>
                    )}
                    <Text fontSize="13px" fontWeight="500" color="#333" noOfLines={1}>{pr.title}</Text>
                  </Flex>
                  <Text fontSize="12px" color="#888">#{pr.number} · {timeAgo(pr.created_at)}</Text>
                </Box>
              )
            })}
            {recentPRs.length === 0 && <Text fontSize="13px" color="#aaa" textAlign="center" py="16px">{t('dashboard.noMRs')}</Text>}
          </VStack>
        </Box>
      </SimpleGrid>
    </Box>
  )
}

export default Dashboard
