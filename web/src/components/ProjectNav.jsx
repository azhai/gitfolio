import React from 'react'
import { Box, Flex, Text, HStack } from '@chakra-ui/react'
import { Link as RouterLink, useParams, useLocation } from 'react-router-dom'

const PROJECT_TABS = [
  { label: 'Files', path: 'tree', icon: '📂' },
  { label: 'Issues', path: 'issues', icon: '⚠️' },
  { label: 'Merge Requests', path: 'pull_requests', icon: '🔀' },
  { label: 'CI/CD', path: 'ci', icon: '🚀' },
  { label: 'Wiki', path: 'wiki', icon: '📖' },
  { label: 'Settings', path: 'settings', icon: '⚙️' },
]

const ProjectNav = () => {
  const { owner, repo } = useParams()
  const location = useLocation()

  if (!owner || !repo) return null

  const basePath = `/${owner}/${repo}`

  return (
    <Box
      position="fixed"
      top="52px" left={0} right={0}
      h="48px"
      bg="#f9fafb"
      borderBottom="1px solid"
      borderColor="#e2e2e2"
      zIndex={999}
    >
      <Flex h="full" alignItems="center" px={5} maxW="1400px" mx="auto">
        <Text fontSize="13px" color="#888" mr={1}>{owner}</Text>
        <Text fontSize="13px" color="#888" mr={1}>/</Text>
        <Text fontSize="13px" fontWeight="600" color="#333" mr={8}>{repo}</Text>

        <HStack spacing="4px" flex={1}>
          {PROJECT_TABS.map((tab) => {
            const href = `${basePath}/${tab.path}`
            const isActive = location.pathname === href ||
              (tab.path === 'tree' && (location.pathname === basePath || location.pathname.startsWith(`${basePath}/tree`)))
            return (
              <RouterLink key={tab.path} to={href}>
                <Box
                  px={3} py={2.5}
                  fontSize="13px"
                  color={isActive ? '#16a34a' : '#666'}
                  fontWeight={isActive ? '600' : 'normal'}
                  bg={isActive ? 'white' : 'transparent'}
                  roundedTop={isActive ? '6px' : undefined}
                  borderBottom={isActive ? '2px solid #22c55e' : '2px solid transparent'}
                  _hover={{ bg: 'white', color: '#333' }}
                  transition="all 0.15s"
                >
                  {tab.icon} {tab.label}
                </Box>
              </RouterLink>
            )
          })}
        </HStack>
      </Flex>
    </Box>
  )
}

export default ProjectNav
