import React from 'react'
import { Box, VStack, Text, Flex, Divider } from '@chakra-ui/react'
import { Link as RouterLink, useParams, useLocation } from 'react-router-dom'
import { SidebarIcons } from './Icons'
import { t } from '../i18n'

var SECTIONS = [
  {
    titleKey: 'sidebar.navigate',
    items: [
      { icon: 'code', labelKey: 'sidebar.files', path: '' },
      { icon: 'commits', labelKey: 'sidebar.commits', path: 'commits' },
      { icon: 'pull_requests', labelKey: 'sidebar.mergeRequests', path: 'pull_requests' },
      { icon: 'issues', labelKey: 'sidebar.issues', path: 'issues' },
      { icon: 'tasks', labelKey: 'sidebar.tasks', path: 'tasks' },
      { icon: 'settings', labelKey: 'sidebar.settings', path: 'settings' },
    ],
  },
  {
    titleKey: 'sidebar.repository',
    items: [
      { icon: 'branches', labelKey: 'sidebar.branches', path: 'branches' },
      { icon: 'tags', labelKey: 'sidebar.tags', path: 'tags' },
      { icon: 'releases', labelKey: 'sidebar.releases', path: 'releases' },
      { icon: 'stats', labelKey: 'sidebar.statistics', path: 'stats' },
    ],
  },
]

function SideIcon({ name, size = 16 }) {
  var Comp = SidebarIcons[name]
  if (!Comp) return null
  return <Comp size={size} strokeWidth={2} />
}

const ProjectSidebar = () => {
  var params = useParams()
  var location = useLocation()

  if (!params.owner || !params.repo) return null

  var basePath = '/' + params.owner + '/' + params.repo

  function isActive(itemPath) {
    var currentPath = location.pathname
    if (itemPath === '') return currentPath === basePath || currentPath === basePath + '/' || currentPath.startsWith(basePath + '/tree')
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
            <Box key={section.titleKey} py={3}>
              <Text fontSize="11px" fontWeight="600" color="#aaa" px={4} mb="6px">{t(section.titleKey)}</Text>
              <VStack spacing={1} align="stretch">
                {section.items.map(function(item) {
                  var active = isActive(item.path)
                  var itemPath = basePath + (item.path ? '/' + item.path : '')
                  return (
                    <RouterLink key={item.labelKey} to={itemPath}>
                      <Flex align="center" gap="12px" px={4} py={2}
                        fontSize="13.5px"
                        color={active ? '#16a34a' : '#666'}
                        bg={active ? '#f0fdf4' : 'transparent'}
                        borderLeft={active ? '3px solid' : '3px solid transparent'} borderColor="#22c55e"
                        borderRight={active ? '3px solid' : 'none'}
                        _hover={{ bg: active ? '#f0fdf4' : '#f9fafb', color: active ? '#16a34a' : '#333' }}
                        transition="all 0.15s"
                        fontWeight={active ? '600' : 'normal'}>
                        <SideIcon name={item.icon} />
                        <Text>{t(item.labelKey)}</Text>
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
