import React, { useState, useEffect } from 'react'
import { useParams, Outlet } from 'react-router-dom'
import { Box, Text, Spinner, Breadcrumb, BreadcrumbItem, BreadcrumbLink, HStack, Tabs, TabList, Tab, Badge } from '@chakra-ui/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { reposAPI } from '../api/index'
import { timeAgo } from '../i18n/zh'

const TABS = [
  { key: 'tree', label: '📂 文件' },
  { key: 'issues', label: '⚠️ 议题' },
  { key: 'pull_requests', label: '🔀 合并请求' },
  { key: 'commits', label: '📝 提交' },
  { key: 'tasks', label: '📋 任务' },
  { key: 'settings', label: '⚙️ 设置' },
]

const ProjectDetail = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [repoInfo, setRepoInfo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reposAPI.get(owner, repo)
      .then(setRepoInfo)
      .catch(() => setRepoInfo(null))
      .finally(() => setLoading(false))
  }, [owner, repo])

  var basePath = '/' + owner + '/' + repo
  var path = location.pathname

  function getActiveTab() {
    if (path === basePath || path.startsWith(basePath + '/tree')) return 0
    if (path.startsWith(basePath + '/issues')) return 1
    if (path.startsWith(basePath + '/pull_requests')) return 2
    if (path.startsWith(basePath + '/commits')) return 3
    if (path.startsWith(basePath + '/tasks')) return 4
    if (path.startsWith(basePath + '/settings')) return 5
    return 0
  }

  function onTabChange(idx) {
    var tab = TABS[idx]
    if (tab.key === 'tree') navigate(basePath)
    else navigate(basePath + '/' + tab.key)
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="80px">
        <Spinner size="xl" color="#22c55e" />
      </Box>
    )
  }

  var info = repoInfo || {}
  return (
    <Box>
      <Breadcrumb fontSize="13px" color="#888" mb="12px" separator="/">
        <BreadcrumbItem><BreadcrumbLink href="/">GitFolio</BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <Text color="#333">{owner} / <Text as="span" fontWeight="600">{repo}</Text></Text>
        </BreadcrumbItem>
      </Breadcrumb>

      <HStack gap="10px" mb="16px" align="center" flexWrap="wrap">
        <Text fontSize="20px" fontWeight="700" color="#333">{info.name || repo}</Text>
        <Text fontSize="13px" color="#666">{info.description || ''}</Text>
        {info.is_private && (
          <Badge fontSize="11px" px="8px" py="1px" rounded="4px"
            bg="#fef2f2" color="#dc2626" fontWeight="500">私有</Badge>
        )}
        {info.is_mirror && (
          <Box as="a" href={info.mirror_url || '#'} target="_blank" rel="noopener noreferrer"
            fontSize="11px" px="8px" py="2px" bg="#eff6ff" color="#2563eb" fontWeight="600"
            border="1px solid #bfdbfe" rounded="4px" cursor="pointer"
            _hover={{ bg: '#dbeafe', borderColor: '#93c5fd', textDecoration: 'none' }}
            transition="all 0.15s">
            镜像
          </Box>
        )}
        {info.default_branch && (
          <Badge fontSize="11px" px="8px" py="1px" rounded="4px"
            bg="#f3f4f6" color="#666" fontWeight="500">🌿 {info.default_branch}</Badge>
        )}
      </HStack>

      <HStack gap="16px" mb="16px" fontSize="12.5px" color="#888">
        <Text>⭐ {info.stars_count || 0}</Text>
        <Text>🔀 {info.forks_count || 0}</Text>
        <Text>👁 {info.watch_count || 0}</Text>
        <Text>📝 {info.commits_count || 0} 次提交</Text>
        <Text>🌿 {info.branches_count || 0} 个分支</Text>
        <Text>🏷️ {info.tags_count || 0} 个标签</Text>
      </HStack>

      <Tabs index={getActiveTab()} onChange={onTabChange} colorScheme="green" mb="20px">
        <TabList borderColor="#e5e7eb" pb={0}>
          {TABS.map(function(tab) {
            return (
              <Tab
                key={tab.key}
                fontSize="13px"
                fontWeight="500"
                _selected={{ color: '#16a34a', borderColor: '#16a34a' }}
              >
                {tab.label}
              </Tab>
            )
          })}
        </TabList>
      </Tabs>

      <Outlet key={location.pathname} />
    </Box>
  )
}

export default ProjectDetail
