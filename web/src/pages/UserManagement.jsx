import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Button, Spinner, Input, useToast } from '@chakra-ui/react'
import { usersAPI } from '../api/index'
import { timeAgo } from '../i18n/zh'

const UserManagement = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const toast = useToast()

  useEffect(() => {
    usersAPI.list().then(function(data) {
      setUsers(Array.isArray(data) ? data : [])
    }).catch(function() { setUsers([]) }).finally(function() { setLoading(false) })
  }, [])

  var filtered = users.filter(function(u) {
    var q = search.toLowerCase()
    return ((u.username || '') + ' ' + (u.full_name || '') + ' ' + (u.email || '')).toLowerCase().indexOf(q) >= 0
  })

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
        <Text fontSize="22px" fontWeight="700" color="#333">👤 用户管理</Text>
      </Flex>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="16px" mb="20px">
        <Input placeholder="搜索用户..." value={search} onChange={function(e) { setSearch(e.target.value) }}
          h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
          _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
      </Box>

      <VStack spacing="12px" align="stretch">
        {filtered.map(function(user) {
          return (
            <Box key={user.id || user.username}
              bg="white" border="1px solid" borderColor="#e2e2e2"
              rounded="10px" p="20px"
              transition="all 0.15s"
              _hover={{ borderColor: '#d1d5db', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Flex align="center" gap="14px">
                <Box w="44px" h="44px" rounded="full" bg="#f0fdf4" display="flex" alignItems="center" justifyContent="center" fontSize="18px" fontWeight="700" color="#16a34a" flexShrink={0}>
                  {(user.username || '?')[0].toUpperCase()}
                </Box>
                <Box flex={1}>
                  <HStack gap="8px" mb="4px">
                    <Text fontSize="15px" fontWeight="600" color="#333">{user.full_name || user.username}</Text>
                    <Text fontSize="13px" color="#888">@{user.username}</Text>
                    {user.is_admin && (
                      <Badge fontSize="11px" px="6px" py="1px" rounded="4px" bg="#ede9fe" color="#7c3aed">管理员</Badge>
                    )}
                  </HStack>
                  <Text fontSize="13px" color="#666">{user.email || ''}</Text>
                  <HStack gap="14px" mt="6px" fontSize="12px" color="#888">
                    <Text>注册于 {timeAgo(user.created_at)}</Text>
                    {user.last_login && <Text>最后登录 {timeAgo(user.last_login)}</Text>}
                  </HStack>
                </Box>
              </Flex>
            </Box>
          )
        })}
      </VStack>

      {!loading && filtered.length === 0 && (
        <Box textAlign="center" py="60px" color="#aaa">
          <Text fontSize="40px" mb="8px">👤</Text>
          <Text fontSize="15px">暂无用户</Text>
        </Box>
      )}
    </Box>
  )
}

export default UserManagement
