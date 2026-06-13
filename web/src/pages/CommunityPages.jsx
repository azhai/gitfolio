// Merged community pages

import React, { useEffect, useState } from 'react'
import { Alert, AlertIcon, Badge, Box, Button, Flex, HStack, Input, Link, SimpleGrid, Spinner, Text, Textarea, VStack, useToast } from '@chakra-ui/react'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { groupsAPI, statsAPI } from '../api/index'
import { LuLink2 as Link2, LuMapPin as MapPin, LuRocket as Rocket, LuUser as User, LuUsers as Users } from 'react-icons/lu'
import { t, timeAgo } from '../i18n'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { IconMap } from '../components/Icons'

// ─── LoginPage ───

const LoginPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/home'
  const { login, isAuthenticated } = useAuth()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [siteMark, setSiteMark] = useState('')

  useEffect(function() {
    statsAPI.get().then(function(data) {
      if (data && data.site_mark) setSiteMark(data.site_mark)
    }).catch(function() {})
  }, [])

  if (isAuthenticated) {
    navigate(redirect)
    return null
  }

  function updateField(key) {
    return function(e) {
      setForm(function(prev) { var o = {}; Object.assign(o, prev); o[key] = e.target.value; return o })
      setError('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.username.trim()) { setError(t('auth.enterUsername')); return }
    if (!form.password) { setError(t('auth.enterPassword')); return }

    setLoading(true)
    try {
      await login(form.username.trim(), form.password)
      navigate(redirect)
    } catch (err) {
      setError(err.message || t('auth.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      minH="100vh"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      bg="#f5f5f5"
      px={4}
    >
      <Box w="100%" maxW="420px">
        <Box textAlign="center" mb="36px">
          <Flex justify="space-between" align="flex-end" mb={2}>
            <Link href="/" fontSize="13px" color="#888" _hover={{ color: '#16a34a' }}>
              ← {t('nav.home')}
            </Link>
            <LanguageSwitcher width="110px" height="34px" />
          </Flex>
          <HStack gap="8px" justifyContent="center">
            <Rocket size={32} color="#16a34a" />
            <Text fontSize="32px" fontWeight="bold" color="#16a34a">GitFolio</Text>
          </HStack>
          <Text fontSize="14px" color="#888" mt={2}>
            {t('auth.signInToContinue')}
          </Text>
        </Box>

        <Box bg="white" rounded="12px" p="28px" boxShadow="0 2px 12px rgba(0,0,0,0.06)" border="1px solid #e8e8e8">
          <form onSubmit={handleSubmit}>
            <Box mb="16px">
              <Text fontSize="13.5px" fontWeight="600" color="#333" mb="6px">{t('auth.username')}</Text>
              <Input
                value={form.username}
                onChange={updateField('username')}
                placeholder={t('auth.placeholderUsername')}
                h="40px" fontSize="14px"
                borderRadius="8px" borderColor="#d1d5db"
                _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }}
              />
            </Box>

            <Box mb="18px">
              <Text fontSize="13.5px" fontWeight="600" color="#333" mb="6px">{t('auth.password')}</Text>
              <Input
                type="password"
                value={form.password}
                onChange={updateField('password')}
                placeholder={t('auth.placeholderPassword')}
                h="40px" fontSize="14px"
                borderRadius="8px" borderColor="#d1d5db"
                _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }}
              />
            </Box>

            {error && (
              <Alert status="error" borderRadius="8px" mb="16px" fontSize="13px">
                <AlertIcon />
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              w="100%"
              h="40px"
              bg="#22c55e"
              color="white"
              fontSize="15px"
              fontWeight="600"
              borderRadius="8px"
              _hover={{ bg: '#16a34a' }}
              _active={{ bg: '#15803d' }}
              isLoading={loading}
              loadingText={t('auth.signingIn')}
              spinner={<Spinner size="sm" color="white" />}
            >
              {t('auth.signIn')}
            </Button>

            <Text fontSize="12.5px" color="#888" textAlign="center" mt="14px">
              {t('auth.forgotPasswordContactAdmin')}
            </Text>
          </form>
        </Box>
      </Box>
      <Box as="footer" py="16px">
        {siteMark && (
          <Text fontSize="12px" color="gray.400">
            <Link href="https://beian.miit.gov.cn/" target="_blank" rel="noopener" _hover={{ color: 'gray.600' }}>
              {siteMark}
            </Link>
          </Text>
        )}
      </Box>
    </Box>
  )
}



// ─── GroupPages ───

// ─── Groups ────────────────────────────────────────────────────

const Groups = () => {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    groupsAPI.list().then(function(data) {
      setGroups(Array.isArray(data) ? data : [])
    }).catch(function() { setGroups([]) }).finally(function() { setLoading(false) })
  }, [])

  var UsersIcon = IconMap.users

  if (loading) {
    return <Box display="flex" justifyContent="center" py="80px"><Spinner size="xl" color="#22c55e" /></Box>
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb="20px">
        <Flex align="center" gap="8px">
          <UsersIcon size={22} color="#333" />
          <Text fontSize="22px" fontWeight="700" color="#333">{t('groups.title')}</Text>
        </Flex>
        <Button h="32px" px="16px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
          _hover={{ bg: '#16a34a' }} as={RouterLink} to="/groups/new">
          {t('groups.newGroup')}
        </Button>
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing="16px">
        {groups.map(function(g) {
          return (
            <RouterLink key={g.id || g.name} to={'/groups/' + g.name}>
              <Box bg="white" border="1px solid" borderColor="#e2e2e2"
                rounded="12px" p="24px" cursor="pointer" transition="all 0.15s" h="full"
                _hover={{ borderColor: '#22c55e', boxShadow: '0 4px 12px rgba(34,197,94,0.1)', transform: 'translateY(-2px)' }}>
                <Flex align="center" gap="14px" mb="16px">
                  <Box w="52px" h="52px" rounded="12px" bg="#f0fdf4" display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
                    <UsersIcon size={26} color="#16a34a" />
                  </Box>
                  <Box flex={1} minW={0}>
                    <Text fontSize="17px" fontWeight="600" color="#333" noOfLines={1}>{g.display_name || g.name}</Text>
                    <Text fontSize="13px" color="#888">{t('groups.createdAt')} {timeAgo(g.created_at)}</Text>
                  </Box>
                </Flex>
                <Text fontSize="13.5px" color="#666" mb="16px" minH="42px" noOfLines={2}>{g.description || t('dashboard.noDescription')}</Text>
                <HStack gap="16px" pt="14px" borderTop="1px solid #f0f0f0" fontSize="13px" color="#888">
                  <HStack gap="5px"><IconMap.user size={14} /><Text>{t('groups.membersCount', { count: g.members_count || 0 })}</Text></HStack>
                  <Text>@{g.name}</Text>
                </HStack>
              </Box>
            </RouterLink>
          )
        })}
      </SimpleGrid>

      {!loading && groups.length === 0 && (
        <Box textAlign="center" py="60px" color="#aaa">
          <UsersIcon size={40} />
          <Text fontSize="15px" mt="8px">{t('groups.notFound')}</Text>
        </Box>
      )}
    </Box>
  )
}

// ─── NewGroup ──────────────────────────────────────────────────

const NewGroup = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', display_name: '', description: '', website: '', location: '' })

  function updateField(key) {
    return function(e) {
      setForm(function(prev) { return Object.assign({}, prev, { [key]: e.target.value }) })
    }
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: t('group.groupNameRequired'), status: 'error', duration: 3000 })
      return
    }
    setSubmitting(true)
    groupsAPI.create(form).then(function(data) {
      navigate('/groups/' + data.name)
    }).catch(function(err) {
      toast({ title: err.message || t('group.createFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  return (
    <Box maxW="720px">
      <Text fontSize="22px" fontWeight="700" color="#333" mb="24px">{t('group.newGroup')}</Text>
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="28px">
        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('group.groupName')} *</Text>
          <Input value={form.name} onChange={updateField('name')} placeholder={t('group.groupNamePlaceholder')} h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('group.displayName')}</Text>
          <Input value={form.display_name} onChange={updateField('display_name')} placeholder={t('group.displayNamePlaceholder')} h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('group.description')}</Text>
          <Textarea value={form.description} onChange={updateField('description')} placeholder={t('group.descriptionPlaceholder')} fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={3}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('group.website')}</Text>
          <Input value={form.website} onChange={updateField('website')} placeholder="https://example.com" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        <Box mb="24px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('group.location')}</Text>
          <Input value={form.location} onChange={updateField('location')} placeholder={t('group.locationPlaceholder')} h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        <Flex justify="flex-end" gap="10px">
          <Button h="36px" px="16px" fontSize="13px" rounded="6px" variant="outline" borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>{t('common.cancel')}</Button>
          <Button h="36px" px="24px" fontSize="14px" rounded="6px" bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>{t('group.createGroup')}</Button>
        </Flex>
      </Box>
    </Box>
  )
}

// ─── exports ───────────────────────────────────────────────────



// ─── GroupDetail ───

const GroupDetail = () => {
  const { name } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { isGuest } = useAuth()
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
              <select value={memberForm.role} onChange={function(e) { setMemberForm(function(p) { return Object.assign({}, p, { role: e.target.value }) }) }}
                style={{ height: '36px', fontSize: '14px', borderRadius: '8px', borderColor: '#d1d5db', width: '100%', paddingLeft: '8px', borderWidth: '1px' }}>
                <option value="member">{t('group.member')}</option>
                <option value="leader">{t('group.leader')}</option>
              </select>
            </Box>
            <Button h="36px" px="16px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
              _hover={{ bg: '#16a34a' }} onClick={handleAddMember} isLoading={addingMember} isDisabled={isGuest}>
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
          var roleLabel = role === 'leader' ? t('group.leader') : t('group.member')
          var roleBg = role === 'leader' ? '#dbeafe' : '#f3f4f6'
          var roleColor = role === 'leader' ? '#2563eb' : '#666'
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
                {role !== 'leader' && !isGuest && (
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



export { LoginPage, Groups, NewGroup, GroupDetail }
