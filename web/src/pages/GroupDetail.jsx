import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Button, Spinner, Input, useToast } from '@chakra-ui/react'
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom'
import { groupsAPI } from '../api/index'
import { t, timeAgo } from '../i18n/index'
import { LuUsers as Users, LuUser as User, LuLink2 as Link2, LuMapPin as MapPin } from 'react-icons/lu'

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
      toast({ title: err.message || t('group.addFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setAddingMember(false) })
  }

  function handleRemoveMember(username) {
    if (!window.confirm(t('group.confirmRemove', { username }))) return
    groupsAPI.removeMember(name, username).then(function() {
      setMembers(function(prev) { return prev.filter(function(m) { return m.user && m.user.username !== username }) })
    }).catch(function(err) {
      toast({ title: err.message || t('group.removeFailed'), status: 'error', duration: 3000 })
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
        <Users size={40} color="#ccc" mb="8px" />
        <Text fontSize="15px">{t('group.notFound')}</Text>
      </Box>
    )
  }

  return (
    <Box>
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="28px" mb="24px">
        <Flex align="center" gap="20px">
          <Box w="72px" h="72px" rounded="12px" bg="#f0fdf4" display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
            <Users size={32} color="#16a34a" />
          </Box>
          <Box flex={1}>
            <Text fontSize="22px" fontWeight="700" color="#333" mb="4px">{group.display_name || group.name}</Text>
            <Text fontSize="14px" color="#666" mb="8px">{group.description || t('group.noDescription')}</Text>
            <HStack gap="16px" fontSize="13px" color="#888">
              <HStack gap="4px"><User size={13} /><Text>{t('group.membersCount', { count: members.length })}</Text></HStack>
              {group.website && <HStack gap="4px"><Link2 size={13} /><Text>{group.website}</Text></HStack>}
              {group.location && <HStack gap="4px"><MapPin size={13} /><Text>{group.location}</Text></HStack>}
              <Text>{t('group.createdAt')} {timeAgo(group.created_at)}</Text>
            </HStack>
          </Box>
        </Flex>
      </Box>

      <Flex justify="space-between" align="center" mb="14px">
        <Text fontSize="16px" fontWeight="600" color="#333">{t('group.members')} ({members.length})</Text>
        <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
          _hover={{ bg: '#16a34a' }} onClick={function() { setShowAddMember(!showAddMember) }}>
          {t('group.addMember')}
        </Button>
      </Flex>

      {showAddMember && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
          <Flex gap="12px" align="flex-end">
            <Box flex={1}>
              <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('group.username')}</Text>
              <Input value={memberForm.username} onChange={function(e) { setMemberForm(function(p) { return Object.assign({}, p, { username: e.target.value }) }) }}
                placeholder={t('group.username')} h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db" />
            </Box>
            <Box w="140px">
              <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('group.role')}</Text>
              <Input value={memberForm.role} onChange={function(e) { setMemberForm(function(p) { return Object.assign({}, p, { role: e.target.value }) }) }}
                placeholder="member" h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db" />
            </Box>
            <Button h="36px" px="16px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
              _hover={{ bg: '#16a34a' }} onClick={handleAddMember} isLoading={addingMember}>
              {t('group.add')}
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
          var roleLabel = role === 'owner' ? t('group.owner') : (role === 'admin' ? t('group.admin') : t('group.member'))
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
                    {t('group.remove')}
                  </Button>
                )}
              </Flex>
            </Box>
          )
        })}
      </VStack>

      {members.length === 0 && (
        <Box textAlign="center" py="40px" color="#aaa">
          <Text fontSize="14px">{t('group.noMembers')}</Text>
        </Box>
      )}
    </Box>
  )
}

export default GroupDetail
