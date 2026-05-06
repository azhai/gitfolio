import React from 'react'
import { Box, VStack, Text, Flex, Divider } from '@chakra-ui/react'
import { Link as RouterLink, useParams, useLocation } from 'react-router-dom'

var SECTIONS = [
  {
    title: '导航',
    items: [
      { icon: '📂', label: '文件', path: '' },
      { icon: '⚠️', label: '议题', path: 'issues' },
      { icon: '🔀', label: '合并请求', path: 'pull_requests' },
      { icon: '📝', label: '提交', path: 'commits' },
      { icon: '📋', label: '任务', path: 'tasks' },
      { icon: '⚙️', label: '设置', path: 'settings' },
    ],
  },
  {
    title: '仓库',
    items: [
      { icon: '🌿', label: '分支', path: 'branches' },
      { icon: '🏷️', label: '标签', path: 'tags' },
      { icon: '🚀', label: '发行版', path: 'releases' },
      { icon: '📊', label: '统计', path: 'stats' },
    ],
  },
]

const ProjectSidebar = () => {
  var params = useParams()
  var location = useLocation()

  if (!params.owner || !params.repo) return null

  var basePath = '/' + params.owner + '/' + params.repo

  function isActive(itemPath) {
    var currentPath = location.pathname
    if (itemPath === '') return currentPath === basePath || currentPath === basePath + '/'
    return currentPath === basePath + '/' + itemPath || currentPath.startsWith(basePath + '/' + itemPath + '/')
  }

  return (
    <Box as="aside" w="248px" bg="white" borderRight="1px solid" borderColor="#e2e2e2"
      position="fixed" left={0} top="52px" bottom={0} overflowY="auto" flexShrink={0} py={0}>
      <VStack spacing={0} align="stretch">
        <Box px={4} py="14px" borderBottom="1px solid" borderColor="#f0f0f0">
          <Text fontSize="12px" color="#888">{params.owner} / <Text as="span" fontWeight="700" color="#333" fontSize="13px">{params.repo}</Text></Text>
        </Box>

        {SECTIONS.map(function(section, sIdx) {
          return (
            <Box key={section.title} py={3}>
              <Text fontSize="11px" fontWeight="600" color="#aaa" px={4} mb="6px">{section.title}</Text>
              <VStack spacing={1} align="stretch">
                {section.items.map(function(item) {
                  var active = isActive(item.path)
                  var itemPath = basePath + (item.path ? '/' + item.path : '')
                  return (
                    <RouterLink key={item.label} to={itemPath}>
                      <Flex align="center" gap="12px" px={4} py={2}
                        fontSize="13.5px"
                        color={active ? '#16a34a' : '#666'}
                        bg={active ? '#f0fdf4' : 'transparent'}
                        borderLeft={active ? '3px solid' : '3px solid transparent'} borderColor="#22c55e"
                        borderRight={active ? '3px solid' : 'none'}
                        _hover={{ bg: active ? '#f0fdf4' : '#f9fafb', color: active ? '#16a34a' : '#333' }}
                        transition="all 0.15s"
                        fontWeight={active ? '600' : 'normal'}>
                        <Text>{item.icon}</Text>
                        <Text>{item.label}</Text>
                      </Flex>
                    </RouterLink>
                  )
                })}
              </VStack>
              {sIdx < SECTIONS.length - 1 && <Divider borderColor="#eee" mt={3} />}
            </Box>
          )
        })}
      </VStack>
    </Box>
  )
}

export default ProjectSidebar
