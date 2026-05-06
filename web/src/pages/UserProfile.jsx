import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, HStack, Badge, Spinner, SimpleGrid } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { usersAPI } from '../api/index'
import { timeAgo } from '../i18n/zh'

const UserProfile = () => {
  const { username } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      usersAPI.get(username),
      usersAPI.repos(username),
    ]).then(function([userData, reposData]) {
      setUser(userData)
      setRepos(Array.isArray(reposData) ? reposData : [])
    }).catch(function() { setUser(null) }).finally(function() { setLoading(false) })
  }, [username])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="80px">
        <Spinner size="xl" color="#22c55e" />
      </Box>
    )
  }

  if (!user) {
    return (
      <Box textAlign="center" py="60px" color="#aaa">
        <Text fontSize="40px" mb="8px">👤</Text>
        <Text fontSize="15px">未找到该用户</Text>
      </Box>
    )
  }

  return (
    <Box>
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="28px" mb="24px">
        <Flex align="center" gap="20px">
          <Box w="72px" h="72px" rounded="full" bg="#f0fdf4" display="flex" alignItems="center" justifyContent="center" fontSize="32px" fontWeight="700" color="#16a34a" flexShrink={0}>
            {(user.username || '?')[0].toUpperCase()}
          </Box>
          <Box flex={1}>
            <HStack gap="10px" mb="4px">
              <Text fontSize="22px" fontWeight="700" color="#333">{user.full_name || user.username}</Text>
              <Text fontSize="15px" color="#888">@{user.username}</Text>
              {user.is_admin && (
                <Badge fontSize="11px" px="6px" py="1px" rounded="4px" bg="#ede9fe" color="#7c3aed">管理员</Badge>
              )}
            </HStack>
            {user.bio && <Text fontSize="14px" color="#666" mb="8px">{user.bio}</Text>}
            <HStack gap="16px" fontSize="13px" color="#888">
              {user.email && <Text>📧 {user.email}</Text>}
              {user.location && <Text>📍 {user.location}</Text>}
              {user.website && <Text>🔗 {user.website}</Text>}
            </HStack>
          </Box>
        </Flex>
      </Box>

      <Text fontSize="16px" fontWeight="600" color="#333" mb="14px">项目 ({repos.length})</Text>

      <SimpleGrid columns={2} spacing="14px">
        {repos.map(function(repo) {
          var owner = repo.owner || username
          var name = repo.name || ''
          return (
            <Box key={repo.id || name}
              bg="white" border="1px solid" borderColor="#e2e2e2"
              rounded="10px" p="20px"
              cursor="pointer" transition="all 0.15s"
              _hover={{ borderColor: '#22c55e', boxShadow: '0 2px 8px rgba(34,197,94,0.08)' }}
              onClick={function() { navigate('/' + owner + '/' + name) }}>
              <HStack gap="8px" mb="6px">
                <Text fontSize="15px" fontWeight="600" color="#16a34a">{owner}/{name}</Text>
                <Badge fontSize="10px" px="6px" py="1px" rounded="4px"
                  bg={repo.is_private ? '#fef2f2' : '#dcfce7'}
                  color={repo.is_private ? '#dc2626' : '#16a34a'}>
                  {repo.is_private ? '私有' : '公开'}
                </Badge>
              </HStack>
              <Text fontSize="13px" color="#666" mb="10px" noOfLines={2}>{repo.description || '暂无描述'}</Text>
              <HStack gap="16px" fontSize="12px" color="#aaa">
                <Text>⭐ {repo.stars_count || 0}</Text>
                <Text>🔀 {repo.forks_count || 0}</Text>
                <Text>更新于 {timeAgo(repo.updated_at)}</Text>
              </HStack>
            </Box>
          )
        })}
      </SimpleGrid>

      {repos.length === 0 && (
        <Box textAlign="center" py="40px" color="#aaa">
          <Text fontSize="14px">暂无公开项目</Text>
        </Box>
      )}
    </Box>
  )
}

export default UserProfile
