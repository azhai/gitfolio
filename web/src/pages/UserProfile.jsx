import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, HStack, Badge, Spinner, SimpleGrid } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { usersAPI } from '../api/index'
import { timeAgo, t } from '../i18n'
import { LuUser as User, LuMapPin as MapPin, LuLink2 as Link2, LuStar as Star, LuGitFork as GitFork, LuMail as Mail } from 'react-icons/lu'

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
          <User size={40} color="#ccc" mb="8px" />
          <Text fontSize="15px">{t('user.notFound')}</Text>
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
              {user.role === 'admin' && (
                <Badge fontSize="11px" px="6px" py="1px" rounded="4px" bg="#ede9fe" color="#7c3aed">{t('common.administrator')}</Badge>
              )}
            </HStack>
            {user.bio && <Text fontSize="14px" color="#666" mb="8px">{user.bio}</Text>}
            <HStack gap="16px" fontSize="13px" color="#888">
              {user.email && <HStack gap="4px"><Mail size={13} /><Text>{user.email}</Text></HStack>}
              {user.location && <HStack gap="4px"><MapPin size={13} /><Text>{user.location}</Text></HStack>}
              {user.website && <HStack gap="4px"><Link2 size={13} /><Text>{user.website}</Text></HStack>}
            </HStack>
          </Box>
        </Flex>
      </Box>

      <Text fontSize="16px" fontWeight="600" color="#333" mb="14px">{t('user.projects')} ({repos.length})</Text>

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
                  bg={repo.project_type === 'mirror' ? '#eff6ff' : '#f3f4f6'}
                  color={repo.project_type === 'mirror' ? '#2563eb' : '#6b7280'}>
                  {repo.project_type === 'mirror' ? t('project.mirror') : t('common.local')}
                </Badge>
              </HStack>
              <Text fontSize="13px" color="#666" mb="10px" noOfLines={2}>{repo.description || t('project.noDescription')}</Text>
              {repo.mirror_url && (
                <Text fontSize="12px" color="#2563eb" mb="8px" noOfLines={1}
                  as="a" href={repo.mirror_url} target="_blank" rel="noopener noreferrer"
                  _hover={{ textDecoration: 'underline' }}>
                  {repo.mirror_url.replace(/\.git$/, '')}
                </Text>
              )}
              <HStack gap="16px" fontSize="12px" color="#aaa">
                <HStack gap="3px"><Star size={13} /><Text>{repo.stars_count || 0}</Text></HStack>
                <HStack gap="3px"><GitFork size={13} /><Text>{repo.forks_count || 0}</Text></HStack>
                <Text>{t('project.updatedAt', { time: timeAgo(repo.updated_at) })}</Text>
              </HStack>
            </Box>
          )
        })}
      </SimpleGrid>

      {repos.length === 0 && (
        <Box textAlign="center" py="40px" color="#aaa">
          <Text fontSize="14px">{t('user.noPublicProjects')}</Text>
        </Box>
      )}
    </Box>
  )
}

export default UserProfile
