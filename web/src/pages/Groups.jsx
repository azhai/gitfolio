import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, Button, Spinner } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { groupsAPI } from '../api/index'
import { timeAgo } from '../i18n/zh'

const Groups = () => {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    groupsAPI.list().then(function(data) {
      setGroups(Array.isArray(data) ? data : [])
    }).catch(function() { setGroups([]) }).finally(function() { setLoading(false) })
  }, [])

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
        <Text fontSize="22px" fontWeight="700" color="#333">👥 团队</Text>
        <Button h="32px" px="16px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
          _hover={{ bg: '#16a34a' }} as={RouterLink} to="/groups/new">
          + 新建团队
        </Button>
      </Flex>

      <VStack spacing="14px" align="stretch">
        {groups.map(function(g) {
          return (
            <RouterLink key={g.id || g.name} to={'/groups/' + g.name}>
              <Box bg="white" border="1px solid" borderColor="#e2e2e2"
                rounded="10px" p="20px" cursor="pointer" transition="all 0.15s"
                _hover={{ borderColor: '#22c55e', boxShadow: '0 2px 8px rgba(34,197,94,0.08)' }}>
                <Flex align="center" gap="14px">
                  <Box w="44px" h="44px" rounded="10px" bg="#f0fdf4" display="flex" alignItems="center" justifyContent="center" fontSize="20px" flexShrink={0}>
                    {g.avatar || '👥'}
                  </Box>
                  <Box flex={1} minW={0}>
                    <Text fontSize="15px" fontWeight="600" color="#333">{g.display_name || g.name}</Text>
                    <Text fontSize="13px" color="#666" noOfLines={1}>{g.description || ''}</Text>
                    <Flex gap="16px" mt="8px" fontSize="12.5px" color="#888">
                      <Text>👤 {g.members_count || 0} 名成员</Text>
                      <Text>创建于 {timeAgo(g.created_at)}</Text>
                    </Flex>
                  </Box>
                </Flex>
              </Box>
            </RouterLink>
          )
        })}
      </VStack>

      {!loading && groups.length === 0 && (
        <Box textAlign="center" py="60px" color="#aaa">
          <Text fontSize="40px" mb="8px">👥</Text>
          <Text fontSize="15px">暂无团队</Text>
        </Box>
      )}
    </Box>
  )
}

export default Groups
