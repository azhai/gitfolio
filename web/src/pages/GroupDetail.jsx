import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Button, Spinner, Input, Textarea, useToast } from '@chakra-ui/react'
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom'
import { groupsAPI } from '../api/index'
import { timeAgo } from '../i18n/zh'

const GroupDetail = () => {
  const { name } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberForm, setMemberForm] = useState({ username: '', role: 'member' })
  const [addingMember, setAddingMember] = useState(false)

  useEffect(() => {
    Promise.all([
      groupsAPI.get(name),
      groupsAPI.members(name),
    ]).then(function([groupData, membersData]) {
      setGroup(groupData)
      setMembers(Array.isArray(membersData) ? membersData : [])
    }).catch(function() { setGroup(null) }).finally(function() { setLoading(false) })
  }, [name])

  function handleAddMember() {
    if (!memberForm.username.trim()) return
    setAddingMember(true)
    groupsAPI.addMember(name, memberForm).then(function() {
      return groupsAPI.members(name)
    }).then(function(data) {
      setMembers(Array.isArray(data) ? data : [])
      setMemberForm({ username: '', role: 'member' })
      setShowAddMember(false)
    }).catch(function(err) {
      toast({ title: err.message || '添加成员失败', status: 'error', duration: 3000 })
    }).finally(function() { setAddingMember(false) })
  }

  function handleRemoveMember(username) {
    if (!window.confirm('确定要移除成员 ' + username + ' 吗？')) return
    groupsAPI.removeMember(name, username).then(function() {
      setMembers(function(prev) { return prev.filter(function(m) { return m.user && m.user.username !== username }) })
    }).catch(function(err) {
      toast({ title: err.message || '移除成员失败', status: 'error', duration: 3000 })
    })
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="80px">
        <Spinner size="xl" color="#22c55e" />
      </Box>
    )
  }

  if (!group) {
    return (
      <Box textAlign="center" py="60px" color="#aaa">
        <Text fontSize="40px" mb="8px">👥</Text>
        <Text fontSize="15px">未找到该团队</Text>
      </Box>
    )
  }

  return (
    <Box>
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="28px" mb="24px">
        <Flex align="center" gap="20px">
          <Box w="72px" h="72px" rounded="12px" bg="#f0fdf4" display="flex" alignItems="center" justifyContent="center" fontSize="32px" flexShrink={0}>
            {group.avatar || '👥'}
          </Box>
          <Box flex={1}>
            <Text fontSize="22px" fontWeight="700" color="#333" mb="4px">{group.display_name || group.name}</Text>
            <Text fontSize="14px" color="#666" mb="8px">{group.description || '暂无描述'}</Text>
            <HStack gap="16px" fontSize="13px" color="#888">
              <Text>👤 {members.length} 名成员</Text>
              {group.website && <Text>🔗 {group.website}</Text>}
              {group.location && <Text>📍 {group.location}</Text>}
              <Text>创建于 {timeAgo(group.created_at)}</Text>
            </HStack>
          </Box>
        </Flex>
      </Box>

      <Flex justify="space-between" align="center" mb="14px">
        <Text fontSize="16px" fontWeight="600" color="#333">成员 ({members.length})</Text>
        <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
          _hover={{ bg: '#16a34a' }} onClick={function() { setShowAddMember(!showAddMember) }}>
          + 添加成员
        </Button>
      </Flex>

      {showAddMember && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
          <Flex gap="12px" align="flex-end">
            <Box flex={1}>
              <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">用户名</Text>
              <Input value={memberForm.username} onChange={function(e) { setMemberForm(function(p) { return Object.assign({}, p, { username: e.target.value }) }) }}
                placeholder="输入用户名" h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db" />
            </Box>
            <Box w="140px">
              <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">角色</Text>
              <Input value={memberForm.role} onChange={function(e) { setMemberForm(function(p) { return Object.assign({}, p, { role: e.target.value }) }) }}
                placeholder="member" h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db" />
            </Box>
            <Button h="36px" px="16px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
              _hover={{ bg: '#16a34a' }} onClick={handleAddMember} isLoading={addingMember}>
              添加
            </Button>
          </Flex>
        </Box>
      )}

      <VStack spacing="10px" align="stretch">
        {members.map(function(m) {
          var username = m.user ? m.user.username : (m.username || '')
          var fullName = m.user ? m.user.full_name : ''
          var email = m.user ? m.user.email : ''
          var role = m.role || 'member'
          var roleLabel = role === 'owner' ? '所有者' : (role === 'admin' ? '管理员' : '成员')
          var roleBg = role === 'owner' ? '#fef3c7' : (role === 'admin' ? '#ede9fe' : '#f3f4f6')
          var roleColor = role === 'owner' ? '#d97706' : (role === 'admin' ? '#7c3aed' : '#666')
          return (
            <Box key={username} bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="16px 20px">
              <Flex align="center" gap="14px">
                <Box w="40px" h="40px" rounded="full" bg="#f0fdf4" display="flex" alignItems="center" justifyContent="center" fontSize="16px" fontWeight="700" color="#16a34a" flexShrink={0}>
                  {username[0].toUpperCase()}
                </Box>
                <Box flex={1}>
                  <HStack gap="8px" mb="2px">
                    <Text fontSize="14px" fontWeight="600" color="#333">{fullName || username}</Text>
                    <Text fontSize="13px" color="#888">@{username}</Text>
                    <Badge fontSize="11px" px="6px" py="1px" rounded="4px" bg={roleBg} color={roleColor}>{roleLabel}</Badge>
                  </HStack>
                  {email && <Text fontSize="12px" color="#888">{email}</Text>}
                </Box>
                {role !== 'owner' && (
                  <Button h="26px" px="10px" fontSize="12px" rounded="4px" variant="outline"
                    borderColor="#fecaca" color="#dc2626" _hover={{ bg: '#fef2f2' }}
                    onClick={function() { handleRemoveMember(username) }}>
                    移除
                  </Button>
                )}
              </Flex>
            </Box>
          )
        })}
      </VStack>

      {members.length === 0 && (
        <Box textAlign="center" py="40px" color="#aaa">
          <Text fontSize="14px">暂无成员</Text>
        </Box>
      )}
    </Box>
  )
}

export default GroupDetail
