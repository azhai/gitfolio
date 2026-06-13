// Merged user pages

import React, { useEffect, useRef, useState } from 'react'
import { Avatar, Badge, Box, Button, Flex, HStack, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, SimpleGrid, Spinner, Switch, Tab, TabList, TabPanel, TabPanels, Tabs, Text, Textarea, VStack, useColorModeValue, useDisclosure, useToast } from '@chakra-ui/react'
import { useNavigate, useParams } from 'react-router-dom'
import { activitiesAPI, adminAPI, usersAPI } from '../api/index'
import { getLanguage, t, timeAgo } from '../i18n/index'
import { ActivityIcons, IconMap } from '../components/Icons'
import { LuCalendar as Calendar, LuCamera as Camera, LuCircleCheck as CheckCircle, LuCircleX as XCircle, LuClock as Clock, LuFileText as FileText, LuGitFork as GitFork, LuKey as Key, LuKeyRound as KeyRound, LuLink2 as Link2, LuMail as Mail, LuMapPin as MapPin, LuPalette as Palette, LuPause as Pause, LuPencil as Pencil, LuPlay as Play, LuPlus as Plus, LuRefreshCw as RefreshCw, LuSettings as Settings, LuShield as Shield, LuStar as Star, LuTimer as Timer, LuUser as User, LuUsers as Users } from 'react-icons/lu'
import { useAuth } from '../contexts/AuthContext'
import { getAllThemes, getCodeTheme, getThemeStyle, setCodeTheme } from '../codeThemes'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { javascript } from 'react-syntax-highlighter/dist/esm/languages/prism'

// ─── UserPages ───

// ─── Activity ──────────────────────────────────────────────────

var TYPE_CONFIG = {
  push: { icon: 'push', labelKey: 'activity.push' },
  mr: { icon: 'mr', labelKey: 'activity.mergeRequest' },
  issue: { icon: 'issue', labelKey: 'activity.issue' },
  comment: { icon: 'comment', labelKey: 'activity.comment' },
  star: { icon: 'star', labelKey: 'activity.star' },
  fork: { icon: 'fork', labelKey: 'activity.fork' },
  wiki: { icon: 'wiki', labelKey: 'activity.wiki' },
  release: { icon: 'release', labelKey: 'activity.release' },
}

function ActIcon({ name, size }) {
  var cfg = ActivityIcons[name]
  if (!cfg) return null
  var C = cfg.icon
  return <C size={size || 17} strokeWidth={2} color={cfg.color} />
}

const Activity = () => {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    activitiesAPI.list().then(function(data) {
      setActivities(Array.isArray(data) ? data : [])
    }).catch(function() { setActivities([]) }).finally(function() { setLoading(false) })
  }, [])

  var StatsIcon = IconMap.stats

  if (loading) return <Box display="flex" justifyContent="center" py="80px"><Spinner size="xl" color="#22c55e" /></Box>

  return (
    <Box>
      <Flex align="center" gap="8px" mb="20px">
        <StatsIcon size={22} color="#333" />
        <Text fontSize="22px" fontWeight="700" color="#333">{t('activity.title')}</Text>
      </Flex>
      <VStack spacing="12px" align="stretch">
        {activities.map(function(item, idx) {
          var type = item.type || 'push'
          var key = TYPE_CONFIG[type] || TYPE_CONFIG.push
          var cfg = ActivityIcons[key.icon] || ActivityIcons.push
          return (
            <Flex key={item.id || idx} gap="14px" bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px"
              p="16px 20px" transition="all 0.15s" _hover={{ borderColor: '#d1d5db', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Box w="38px" h="38px" rounded="9px" bg={cfg.bg} flexShrink={0} display="flex" alignItems="center" justifyContent="center">
                <ActIcon name={key.icon} />
              </Box>
              <Box flex={1}>
                <Text fontSize="13.5px" color="#333" lineHeight="1.6">
                  <Text as="span" fontWeight="600">{item.user || item.username || ''}</Text>{' '}
                  <Text as="span" color="#666">{item.action || ''}</Text>{' '}
                  <Text as="span" fontWeight="600" color={cfg.color}>{item.target || ''}</Text>
                  {(item.ref_name || item.ref) && (
                    <Text as="span" ml="4px" px="7px" py="1px" rounded="4px" fontSize="11.5px" bg="#f3f4f6" color="#666">{item.ref_name || item.ref}</Text>
                  )}
                </Text>
                <Text fontSize="12px" color="#aaa" mt="4px">{timeAgo(item.created_at)}</Text>
              </Box>
            </Flex>
          )
        })}
      </VStack>
      {!loading && activities.length === 0 && (
        <Box textAlign="center" py="60px" color="#aaa"><StatsIcon size={40} /><Text fontSize="15px" mt="8px">{t('activity.notFound')}</Text></Box>
      )}
    </Box>
  )
}

// ─── UserManagement ────────────────────────────────────────────

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

  if (loading) return <Box display="flex" justifyContent="center" py="80px"><Spinner size="xl" color="#22c55e" /></Box>

  return (
    <Box>
      <Flex justify="space-between" align="center" mb="20px">
        <Text fontSize="22px" fontWeight="700" color="#333">👤 {t('userMgmt.title')}</Text>
      </Flex>
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="16px" mb="20px">
        <Input placeholder={t('userMgmt.searchPlaceholder')} value={search} onChange={function(e) { setSearch(e.target.value) }}
          h="36px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
          _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
      </Box>
      <VStack spacing="12px" align="stretch">
        {filtered.map(function(user) {
          return (
            <Box key={user.id || user.username} bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px"
              transition="all 0.15s" _hover={{ borderColor: '#d1d5db', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Flex align="center" gap="14px">
                <Box w="44px" h="44px" rounded="full" bg="#f0fdf4" display="flex" alignItems="center" justifyContent="center" fontSize="18px" fontWeight="700" color="#16a34a" flexShrink={0}>
                  {(user.username || '?')[0].toUpperCase()}
                </Box>
                <Box flex={1}>
                  <HStack gap="8px" mb="4px">
                    <Text fontSize="15px" fontWeight="600" color="#333">{user.full_name || user.username}</Text>
                    <Text fontSize="13px" color="#888">@{user.username}</Text>
                    {user.role === 'admin' && <Badge fontSize="11px" px="6px" py="1px" rounded="4px" bg="#ede9fe" color="#7c3aed">{t('userMgmt.admin')}</Badge>}
                  </HStack>
                  <Text fontSize="13px" color="#666">{user.email || ''}</Text>
                  <HStack gap="14px" mt="6px" fontSize="12px" color="#888">
                    <Text>{t('common.createdAt')} {timeAgo(user.created_at)}</Text>
                    {user.last_login && <Text>{t('userMgmt.lastLogin')} {timeAgo(user.last_login)}</Text>}
                  </HStack>
                </Box>
              </Flex>
            </Box>
          )
        })}
      </VStack>
      {!loading && filtered.length === 0 && (
        <Box textAlign="center" py="60px" color="#aaa"><Text fontSize="40px" mb="8px">👤</Text><Text fontSize="15px">{t('userMgmt.noUsers')}</Text></Box>
      )}
    </Box>
  )
}

// ─── UserProfile ───────────────────────────────────────────────

const UserProfile = () => {
  const { username } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([usersAPI.get(username), usersAPI.repos(username)]).then(function([userData, reposData]) {
      setUser(userData)
      setRepos(Array.isArray(reposData) ? reposData : [])
    }).catch(function() { setUser(null) }).finally(function() { setLoading(false) })
  }, [username])

  if (loading) return <Box display="flex" justifyContent="center" py="80px"><Spinner size="xl" color="#22c55e" /></Box>
  if (!user) return <Box textAlign="center" py="60px" color="#aaa"><User size={40} color="#ccc" mb="8px" /><Text fontSize="15px">{t('user.notFound')}</Text></Box>

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
              {user.role === 'admin' && <Badge fontSize="11px" px="6px" py="1px" rounded="4px" bg="#ede9fe" color="#7c3aed">{t('common.administrator')}</Badge>}
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
            <Box key={repo.id || name} bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px"
              cursor="pointer" transition="all 0.15s" _hover={{ borderColor: '#22c55e', boxShadow: '0 2px 8px rgba(34,197,94,0.08)' }}
              onClick={function() { navigate('/' + owner + '/' + name) }}>
              <HStack gap="8px" mb="6px">
                <Text fontSize="15px" fontWeight="600" color="#16a34a">{owner}/{name}</Text>
                <Badge fontSize="10px" px="6px" py="1px" rounded="4px"
                  bg={repo.project_type === 'mirror' ? '#eff6ff' : repo.project_type === 'public' ? '#f0fdf4' : repo.project_type === 'private' ? '#fff7ed' : '#f3f4f6'}
                  color={repo.project_type === 'mirror' ? '#2563eb' : repo.project_type === 'public' ? '#16a34a' : repo.project_type === 'private' ? '#ea580c' : '#6b7280'}>
                  {repo.project_type === 'mirror' ? t('project.mirror') : repo.project_type === 'public' ? t('project.public') : repo.project_type === 'private' ? t('project.private') : t('common.local')}
                </Badge>
              </HStack>
              <Text fontSize="13px" color="#666" mb="10px" noOfLines={2}>{repo.description || t('project.noDescription')}</Text>
              {repo.mirror_url && (
                <Text fontSize="12px" color="#2563eb" mb="8px" noOfLines={1} as="a" href={repo.mirror_url} target="_blank" rel="noopener noreferrer" _hover={{ textDecoration: 'underline' }}>
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
      {repos.length === 0 && <Box textAlign="center" py="40px" color="#aaa"><Text fontSize="14px">{t('user.noPublicProjects')}</Text></Box>}
    </Box>
  )
}

// ─── exports ───────────────────────────────────────────────────



// ─── UserSettings ───

SyntaxHighlighter.registerLanguage('javascript', javascript)

const UserSettings = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const { user, isGuest } = useAuth()
  const fileInputRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [profile, setProfile] = useState({
    full_name: '',
    bio: '',
    website: '',
    location: '',
  })
  const [passwords, setPasswords] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [selectedTheme, setSelectedTheme] = useState(getCodeTheme())
  const allThemes = getAllThemes()
  const [themeStyles, setThemeStyles] = useState({})

  useEffect(function() {
    var keys = Object.keys(allThemes)
    Promise.all(keys.map(function(key) {
      return getThemeStyle(key).then(function(style) {
        return { key: key, style: style }
      })
    })).then(function(results) {
      var map = {}
      results.forEach(function(r) { map[r.key] = r.style })
      setThemeStyles(map)
    })
  }, [selectedTheme])

  useEffect(() => {
    usersAPI.getMe().then(function(data) {
      setProfile({
        full_name: data.full_name || '',
        bio: data.bio || '',
        website: data.website || '',
        location: data.location || '',
      })
      if (data.avatar_url) setAvatarUrl(data.avatar_url)
      if (data.avatar) setAvatarUrl(data.avatar)
    }).catch(function() {
      toast({ title: t('userSettings.getProfileFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setLoading(false) })
  }, [])

  function handleAvatarClick() {
    if (fileInputRef.current) fileInputRef.current.click()
  }

  function handleAvatarChange(e) {
    var file = e.target.files && e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: t('userSettings.avatarTooLarge'), status: 'error', duration: 3000 })
      return
    }
    setAvatarUploading(true)
    usersAPI.uploadAvatar(user.username, file).then(function(data) {
      if (data.avatar || data.avatar_url) {
        setAvatarUrl(data.avatar || data.avatar_url)
        toast({ title: t('userSettings.avatarUpdated'), status: 'success', duration: 3000 })
      } else {
        toast({ title: t('userSettings.avatarUploadFailed'), status: 'error', duration: 3000 })
      }
    }).catch(function() {
      toast({ title: t('userSettings.avatarUploadFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setAvatarUploading(false) })
  }

  function handleSaveProfile() {
    if (!profile.full_name.trim()) {
      toast({ title: t('userSettings.nameRequired'), status: 'error', duration: 3000 })
      return
    }
    setSaving(true)
    usersAPI.updateMe(profile).then(function() {
      toast({ title: t('userSettings.profileUpdated'), status: 'success', duration: 3000 })
    }).catch(function(err) {
      toast({ title: err.message || t('userSettings.updateFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSaving(false) })
  }

  function handleChangePassword() {
    if (!passwords.old_password) {
      toast({ title: t('userSettings.currentPasswordRequired'), status: 'error', duration: 3000 })
      return
    }
    if (!passwords.new_password || passwords.new_password.length < 6) {
      toast({ title: t('userSettings.newPasswordTooShort'), status: 'error', duration: 3000 })
      return
    }
    if (passwords.new_password !== passwords.confirm_password) {
      toast({ title: t('userSettings.passwordMismatch'), status: 'error', duration: 3000 })
      return
    }
    setSaving(true)
    usersAPI.changePassword({
      old_password: passwords.old_password,
      new_password: passwords.new_password,
    }).then(function() {
      toast({ title: t('userSettings.passwordChanged'), status: 'success', duration: 3000 })
      setPasswords({ old_password: '', new_password: '', confirm_password: '' })
    }).catch(function(err) {
      toast({ title: err.message || t('userSettings.changePasswordFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSaving(false) })
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="80px">
        <Spinner size="xl" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box maxW="720px" mx="auto">
      <HStack gap="8px" mb="24px">
        <Settings size={20} color="#333" />
        <Text fontSize="20px" fontWeight="700" color="#333">{t('userSettings.title')}</Text>
      </HStack>

      <Tabs colorScheme="green" mb="20px">
        <TabList borderColor="#e5e7eb" pb={0}>
          <Tab fontSize="13px" fontWeight="500" _selected={{ color: '#16a34a', borderColor: '#16a34a' }}>
            <HStack gap="5px"><User size={14} /><Text>{t('userSettings.profile')}</Text></HStack>
          </Tab>
          <Tab fontSize="13px" fontWeight="500" _selected={{ color: '#16a34a', borderColor: '#16a34a' }}>
            <HStack gap="5px"><Key size={14} /><Text>{t('userSettings.changePassword')}</Text></HStack>
          </Tab>
          <Tab fontSize="13px" fontWeight="500" _selected={{ color: '#16a34a', borderColor: '#16a34a' }}>
            <HStack gap="5px"><Palette size={14} /><Text>{t('userSettings.codeTheme')}</Text></HStack>
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel p={0}>
            <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px">
              <Flex align="center" gap="20px" mb="20px" pb="20px" borderBottom="1px solid" borderColor="#f0f0f0">
                <Box position="relative">
                  <Avatar size="xl" name={user?.full_name || user?.username} src={avatarUrl} bg="#22c55e" color="white" />
                  <Box position="absolute" bottom="0" right="0"
                    w="28px" h="28px" rounded="full" bg="#22c55e"
                    display="flex" alignItems="center" justifyContent="center"
                    cursor={isGuest ? "not-allowed" : "pointer"} fontSize="14px" color="white"
                    border="2px solid white" opacity={isGuest ? 0.5 : 1}
                    onClick={isGuest ? undefined : handleAvatarClick}
                    _hover={isGuest ? {} : { bg: '#16a34a' }}>
                    <Camera size={14} />
                  </Box>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                </Box>
                <Box>
                  <Text fontSize="14px" fontWeight="600" color="#333" mb="4px">{user?.full_name || user?.username}</Text>
                  <Text fontSize="13px" color="#888" mb="8px">@{user?.username}</Text>
                  <Button h="26px" px="10px" fontSize="12px" rounded="4px" variant="outline" borderColor="#d1d5db"
                    onClick={handleAvatarClick} isLoading={avatarUploading} isDisabled={isGuest}>
                    {t('userSettings.changeAvatar')}
                  </Button>
                </Box>
              </Flex>

              <Box mb="16px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('userSettings.username')}</Text>
                <Input value={user?.username || ''} isReadOnly h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db" bg="#f9fafb" color="#999" />
              </Box>

              <Box mb="16px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('userSettings.email')}</Text>
                <Input value={user?.email || ''} isReadOnly h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db" bg="#f9fafb" color="#999" />
              </Box>

              <Box mb="16px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('userSettings.name')} *</Text>
                <Input value={profile.full_name} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { full_name: e.target.value }) }) }}
                  placeholder={t('userSettings.namePlaceholder')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
                  isReadOnly={isGuest}
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Box mb="16px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('userSettings.bio')}</Text>
                <Textarea value={profile.bio} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { bio: e.target.value }) }) }}
                  placeholder={t('userSettings.bioPlaceholder')} fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={4}
                  isReadOnly={isGuest}
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Box mb="16px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('userSettings.website')}</Text>
                <Input value={profile.website} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { website: e.target.value }) }) }}
                  placeholder="https://example.com" h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
                  isReadOnly={isGuest}
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Box mb="20px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('userSettings.location')}</Text>
                <Input value={profile.location} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { location: e.target.value }) }) }}
                  placeholder={t('userSettings.locationPlaceholder')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
                  isReadOnly={isGuest}
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Flex justify="flex-end" gap="10px">
                <Button h="34px" px="16px" fontSize="13px" rounded="6px" variant="outline"
                  borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>
                  {t('common.cancel')}
                </Button>
                <Button h="34px" px="20px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
                  _hover={{ bg: '#16a34a' }} onClick={handleSaveProfile} isLoading={saving} isDisabled={isGuest}>
                  {t('userSettings.saveChanges')}
                </Button>
              </Flex>
            </Box>
          </TabPanel>

          <TabPanel p={0}>
            <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px">
              <Box mb="16px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('userSettings.currentPassword')} *</Text>
                <Input type="password" value={passwords.old_password} onChange={function(e) { setPasswords(function(p) { return Object.assign({}, p, { old_password: e.target.value }) }) }}
                  placeholder={t('userSettings.currentPasswordPlaceholder')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Box mb="16px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('userSettings.newPassword')} *</Text>
                <Input type="password" value={passwords.new_password} onChange={function(e) { setPasswords(function(p) { return Object.assign({}, p, { new_password: e.target.value }) }) }}
                  placeholder={t('userSettings.newPasswordPlaceholder')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Box mb="20px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('userSettings.confirmPassword')} *</Text>
                <Input type="password" value={passwords.confirm_password} onChange={function(e) { setPasswords(function(p) { return Object.assign({}, p, { confirm_password: e.target.value }) }) }}
                  placeholder={t('userSettings.confirmPasswordPlaceholder')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Flex justify="flex-end">
                <Button h="34px" px="20px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
                  _hover={{ bg: '#16a34a' }} onClick={handleChangePassword} isLoading={saving} isDisabled={isGuest}>
                  {t('userSettings.changePassword')}
                </Button>
              </Flex>
            </Box>
          </TabPanel>

          <TabPanel p={0}>
            <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px">
              <Text fontSize="15px" fontWeight="600" color="#333" mb="4px">{t('userSettings.codeHighlightTheme')}</Text>
              <Text fontSize="13px" color="#666" mb="20px">{t('userSettings.codeThemeDesc')}</Text>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing="14px">
                {Object.keys(allThemes).map(function(key) {
                  var theme = allThemes[key]
                  var isActive = selectedTheme === key
                  return (
                    <Box
                      key={key}
                      cursor="pointer"
                      border="2px solid"
                      borderColor={isActive ? '#22c55e' : '#e5e7eb'}
                      rounded="10px"
                      p="16px"
                      transition="all 0.2s"
                      _hover={{ borderColor: isActive ? '#22c55e' : '#d1d5db', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                      bg={isActive ? '#f0fdf4' : 'white'}
                      onClick={function() {
                        setSelectedTheme(key)
                        setCodeTheme(key)
                        toast({ title: t('userSettings.themeSwitched', { name: theme.name }), status: 'success', duration: 2000 })
                      }}
                    >
                      <Flex justify="space-between" align="start" mb="12px">
                        <Box>
                          <Text fontSize="14.5px" fontWeight="600" color="#333">{theme.name}</Text>
                          <HStack gap="6px" mt="4px">
                            <Badge fontSize="10px" px="6px" py="1px" rounded="4px"
                              bg={theme.type === 'dark' ? '#1f2937' : '#f3f4f6'}
                              color={theme.type === 'dark' ? '#d1d5db' : '#374151'}>
                              {theme.type === 'dark' ? '🌙 ' + t('userSettings.darkTheme') : '☀️ ' + t('userSettings.lightTheme')}
                            </Badge>
                            {key === 'oneLight' && (
                              <Badge fontSize="10px" px="6px" py="1px" rounded="4px"
                                bg="#dcfce7" color="#16a34a">
                                {t('userSettings.recommended')}
                              </Badge>
                            )}
                          </HStack>
                        </Box>
                        {isActive && (
                          <Box w="22px" h="22px" rounded="full" bg="#22c55e"
                            display="flex" alignItems="center" justifyContent="center">
                            <Text color="white" fontSize="14px" fontWeight="700">✓</Text>
                          </Box>
                        )}
                      </Flex>

                      <Box rounded="6px" overflow="hidden" border="1px solid" borderColor="#e5e7eb">
                        <SyntaxHighlighter
                          language="javascript"
                          style={themeStyles[key] || {}}
                          customStyle={{
                            margin: 0,
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            lineHeight: '1.5',
                          }}
                          showLineNumbers={false}
                        >
                          {t('userSettings.sampleCode')}
                        </SyntaxHighlighter>
                      </Box>

                      <Text fontSize="12px" color="#888" mt="10px">{theme.description}</Text>
                    </Box>
                  )
                })}
              </SimpleGrid>

              <Box mt="24px" p="16px" bg="#f9fafb" rounded="8px" border="1px solid" borderColor="#e5e7eb">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="8px">💡 {t('userSettings.tips')}</Text>
                <VStack gap="6px" align="start">
                  <Text fontSize="12.5px" color="#666">• {t('userSettings.tip1')}</Text>
                  <Text fontSize="12.5px" color="#666">• {t('userSettings.tip2')}</Text>
                  <Text fontSize="12.5px" color="#666">• {t('userSettings.tip3')}</Text>
                </VStack>
              </Box>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}



// ─── AdminPage ───

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  try {
    var d = new Date(dateStr)
    if (d.getFullYear() < 2) return '-'
    return d.toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  } catch (e) {
    return dateStr
  }
}

function getIntervalLabel(seconds) {
  if (!seconds || seconds === 0) return t('common.manual')
  var h = Math.floor(seconds / 3600)
  var m = Math.floor((seconds % 3600) / 60)
  if (h > 0 && m > 0) return h + ' ' + t('common.hour') + ' ' + m + ' ' + t('common.minute')
  if (h > 0) return h + ' ' + t('common.hour')
  if (m > 0) return m + ' ' + t('common.minute')
  return seconds + ' ' + t('common.second')
}

function secondsToHM(seconds) {
  var s = seconds || 0
  return { hours: Math.floor(s / 3600), minutes: Math.floor((s % 3600) / 60) }
}

function hmToSeconds(hours, minutes) {
  return (hours || 0) * 3600 + (minutes || 0) * 60
}

var UserManagementTab = function() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const toast = useToast()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [form, setForm] = useState({ username: '', email: '', password: '', full_name: '', role: 'user' })
  const [creating, setCreating] = useState(false)

  const [editUser, setEditUser] = useState(null)
  const [editRole, setEditRole] = useState('')
  const [editRoleOpen, setEditRoleOpen] = useState(false)
  const [savingRole, setSavingRole] = useState(false)

  const [pwdUser, setPwdUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [pwdOpen, setPwdOpen] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)

  function fetchUsers() {
    setLoading(true)
    usersAPI.list().then(function(data) {
      setUsers(Array.isArray(data) ? data : [])
    }).catch(function() { setUsers([]) }).finally(function() { setLoading(false) })
  }

  useEffect(fetchUsers, [])

  var filtered = users.filter(function(u) {
    var q = search.toLowerCase()
    return ((u.username || '') + ' ' + (u.full_name || '') + ' ' + (u.email || '')).toLowerCase().indexOf(q) >= 0
  })

  function handleCreate() {
    if (!form.username) { toast({ title: t('userMgmt.usernameRequired'), status: 'warning', duration: 2000 }); return }
    if (!form.email) { toast({ title: t('userMgmt.emailRequired'), status: 'warning', duration: 2000 }); return }
    if (!form.password) { toast({ title: t('userMgmt.passwordRequired'), status: 'warning', duration: 2000 }); return }
    if (form.password.length < 6) { toast({ title: t('userMgmt.passwordMinLength'), status: 'warning', duration: 2000 }); return }

    setCreating(true)
    usersAPI.create(form).then(function() {
      toast({ title: t('common.success'), status: 'success', duration: 2000 })
      setForm({ username: '', email: '', password: '', full_name: '', role: 'user' })
      onClose()
      fetchUsers()
    }).catch(function(err) {
      var msg = err.message || t('userMgmt.createFailed')
      if (msg.indexOf('username already exists') >= 0) msg = t('userMgmt.usernameExists')
      if (msg.indexOf('email already exists') >= 0) msg = t('userMgmt.emailExists')
      toast({ title: msg, status: 'error', duration: 3000 })
    }).finally(function() { setCreating(false) })
  }

  function openEditRole(user) {
    setEditUser(user)
    setEditRole(user.role || 'user')
    setEditRoleOpen(true)
  }

  function handleSaveRole() {
    if (!editUser) return
    setSavingRole(true)
    usersAPI.update(editUser.username, { role: editRole }).then(function() {
      toast({ title: t('admin.updated'), status: 'success', duration: 2000 })
      setEditRoleOpen(false)
      fetchUsers()
    }).catch(function(err) {
      toast({ title: err.message || t('admin.updateFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSavingRole(false) })
  }

  function openChangePwd(user) {
    setPwdUser(user)
    setNewPassword('')
    setPwdOpen(true)
  }

  function handleSavePwd() {
    if (!pwdUser) return
    if (!newPassword || newPassword.length < 6) {
      toast({ title: t('userMgmt.passwordMinLength'), status: 'warning', duration: 2000 })
      return
    }
    setSavingPwd(true)
    usersAPI.update(pwdUser.username, { password: newPassword }).then(function() {
      toast({ title: t('admin.updated'), status: 'success', duration: 2000 })
      setPwdOpen(false)
    }).catch(function(err) {
      toast({ title: err.message || t('admin.updateFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSavingPwd(false) })
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" my="16px">
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="12px 16px" flex={1} mr="12px">
          <Input placeholder={t('admin.searchUser')} value={search} onChange={function(e) { setSearch(e.target.value) }}
            h="32px" fontSize="13px" borderRadius="6px" borderColor="#d1d5db" autoComplete="off"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>
        <Button h="32px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
          _hover={{ bg: '#16a34a' }} leftIcon={<Plus size={14} />} onClick={onOpen}>
          {t('userMgmt.newUser')}
        </Button>
      </Flex>

      <Box overflowX="auto">
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '10px', border: '1px solid #e2e2e2' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f0f0f0', fontSize: '13px', color: '#888', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('admin.userCol')}</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('admin.emailCol')}</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('admin.roleCol')}</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('admin.registeredAt')}</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>{t('admin.actionCol')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(function(user) {
              return (
                <tr key={user.id || user.username} style={{ borderBottom: '1px solid #f0f0f0', fontSize: '14px' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <HStack gap="10px">
                      <Box w="32px" h="32px" rounded="full" bg="#f0fdf4" color="#16a34a" display="flex" alignItems="center" justifyContent="center" fontWeight={700} fontSize="13px" flexShrink={0}>
                        {(user.full_name || user.username || '?')[0].toUpperCase()}
                      </Box>
                      <Box>
                        <Text fontWeight={500} color="#333" fontSize="14px">{user.full_name || user.username}</Text>
                        <Text fontSize="12px" color="#888">@{user.username}</Text>
                      </Box>
                    </HStack>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#666' }}>
                    <HStack gap="5px">
                      <Mail size={13} />
                      <Text fontSize="13px">{user.email || '-'}</Text>
                    </HStack>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {user.role === 'admin' ? (
                      <Badge fontSize="10px" px="6px" py="1px" rounded="4px" bg="#ede9fe" color="#7c3aed">
                        <HStack gap="4px"><Shield size={10} /><Text>{t('common.administrator')}</Text></HStack>
                      </Badge>
                    ) : user.role === 'guest' ? (
                      <Badge fontSize="10px" px="6px" py="1px" rounded="4px" bg="#fef3c7" color="#d97706">{t('common.guest')}</Badge>
                    ) : (
                      <Badge fontSize="10px" px="6px" py="1px" rounded="4px" bg="#f3f4f6" color="#666">{t('common.user')}</Badge>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#888', fontSize: '13px' }}>
                    <HStack gap="5px">
                      <Calendar size={13} />
                      <Text>{timeAgo(user.created_at)}</Text>
                    </HStack>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <HStack gap="6px">
                      <Button h="26px" px="8px" fontSize="12px" rounded="4px" variant="outline" borderColor="#d1d5db" color="#666"
                        leftIcon={<Pencil size={11} />} onClick={function() { openEditRole(user) }}>
                        {t('admin.roleCol')}
                      </Button>
                      <Button h="26px" px="8px" fontSize="12px" rounded="4px" variant="outline" borderColor="#d1d5db" color="#666"
                        leftIcon={<KeyRound size={11} />} onClick={function() { openChangePwd(user) }}>
                        {t('admin.changePassword')}
                      </Button>
                    </HStack>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Box>

      {!loading && filtered.length === 0 && (
        <Box textAlign="center" py="60px" color="#aaa">
          <Users size={40} color="#ccc" />
          <Text fontSize="15px" mt="8px">{t('admin.noUsers')}</Text>
        </Box>
      )}

      <Modal isOpen={isOpen} onClose={onClose} isCentered blockScrollOnMount={false}>
        <ModalOverlay />
        <ModalContent mx="16px">
          <ModalHeader fontSize="16px" fontWeight={600}>{t('userMgmt.newUser')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb="6px">
            <VStack spacing="12px">
              <Box w="100%">
                <Text fontSize="12px" color="#888" mb="4px">{t('userMgmt.username')}</Text>
                <Input h="36px" fontSize="13px" value={form.username} placeholder={t('userMgmt.username')}
                  onChange={function(e) { setForm(Object.assign({}, form, { username: e.target.value })) }}
                  borderColor="#d1d5db" _focus={{ borderColor: '#22c55e' }} />
              </Box>
              <Box w="100%">
                <Text fontSize="12px" color="#888" mb="4px">{t('userMgmt.email')}</Text>
                <Input h="36px" fontSize="13px" type="email" value={form.email} placeholder={t('userMgmt.email')}
                  onChange={function(e) { setForm(Object.assign({}, form, { email: e.target.value })) }}
                  borderColor="#d1d5db" _focus={{ borderColor: '#22c55e' }} />
              </Box>
              <Box w="100%">
                <Text fontSize="12px" color="#888" mb="4px">{t('userMgmt.password')}</Text>
                <Input h="36px" fontSize="13px" type="password" value={form.password} placeholder={t('userMgmt.passwordMinLength')}
                  onChange={function(e) { setForm(Object.assign({}, form, { password: e.target.value })) }}
                  borderColor="#d1d5db" _focus={{ borderColor: '#22c55e' }} />
              </Box>
              <Box w="100%">
                <Text fontSize="12px" color="#888" mb="4px">{t('userMgmt.fullName')}</Text>
                <Input h="36px" fontSize="13px" value={form.full_name} placeholder={t('userMgmt.fullName')}
                  onChange={function(e) { setForm(Object.assign({}, form, { full_name: e.target.value })) }}
                  borderColor="#d1d5db" _focus={{ borderColor: '#22c55e' }} />
              </Box>
              <Box w="100%">
                <Text fontSize="12px" color="#888" mb="4px">{t('userMgmt.role')}</Text>
                <Select h="36px" fontSize="13px" value={form.role}
                  onChange={function(e) { setForm(Object.assign({}, form, { role: e.target.value })) }}
                  borderColor="#d1d5db" _focus={{ borderColor: '#22c55e' }}>
                  <option value="user">{t('common.user')}</option>
                  <option value="admin">{t('common.administrator')}</option>
                  <option value="guest">{t('common.guest')}</option>
                </Select>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter pt="8px">
            <Button h="32px" px="14px" fontSize="13px" rounded="6px" variant="outline" borderColor="#d1d5db" color="#666"
              mr="8px" onClick={onClose}>{t('common.cancel')}</Button>
            <Button h="32px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
              _hover={{ bg: '#16a34a' }} isLoading={creating} onClick={handleCreate}>{t('userMgmt.createUser')}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={editRoleOpen} onClose={function() { setEditRoleOpen(false) }} isCentered blockScrollOnMount={false}>
        <ModalOverlay />
        <ModalContent mx="16px">
          <ModalHeader fontSize="16px" fontWeight={600}>{t('admin.editRole')} - {editUser ? editUser.username : ''}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb="6px">
            <Box w="100%">
              <Text fontSize="12px" color="#888" mb="4px">{t('admin.roleCol')}</Text>
              <Select h="36px" fontSize="13px" value={editRole}
                onChange={function(e) { setEditRole(e.target.value) }}
                borderColor="#d1d5db" _focus={{ borderColor: '#22c55e' }}>
                <option value="user">{t('common.user')}</option>
                <option value="admin">{t('common.administrator')}</option>
                <option value="guest">{t('common.guest')}</option>
              </Select>
            </Box>
          </ModalBody>
          <ModalFooter pt="8px">
            <Button h="32px" px="14px" fontSize="13px" rounded="6px" variant="outline" borderColor="#d1d5db" color="#666"
              mr="8px" onClick={function() { setEditRoleOpen(false) }}>{t('common.cancel')}</Button>
            <Button h="32px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
              _hover={{ bg: '#16a34a' }} isLoading={savingRole} onClick={handleSaveRole}>{t('common.save')}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={pwdOpen} onClose={function() { setPwdOpen(false) }} isCentered blockScrollOnMount={false}>
        <ModalOverlay />
        <ModalContent mx="16px">
          <ModalHeader fontSize="16px" fontWeight={600}>{t('admin.changePassword')} - {pwdUser ? pwdUser.username : ''}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb="6px">
            <Box w="100%">
              <Text fontSize="12px" color="#888" mb="4px">{t('admin.newPassword')}</Text>
              <Input h="36px" fontSize="13px" type="password" value={newPassword} placeholder={t('userMgmt.passwordMinLength')}
                onChange={function(e) { setNewPassword(e.target.value) }}
                borderColor="#d1d5db" autoComplete="new-password" _focus={{ borderColor: '#22c55e' }} />
            </Box>
          </ModalBody>
          <ModalFooter pt="8px">
            <Button h="32px" px="14px" fontSize="13px" rounded="6px" variant="outline" borderColor="#d1d5db" color="#666"
              mr="8px" onClick={function() { setPwdOpen(false) }}>{t('common.cancel')}</Button>
            <Button h="32px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
              _hover={{ bg: '#16a34a' }} isLoading={savingPwd} onClick={handleSavePwd}>{t('common.save')}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}

var SyncManagementTab = function() {
  const toast = useToast()
  const [syncPoints, setSyncPoints] = useState([])
  const [syncLogs, setSyncLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [showLogs, setShowLogs] = useState(false)

  function fetchSyncPoints() {
    setLoading(true)
    adminAPI.listSyncPoints().then(function(data) {
      setSyncPoints(data.sync_points || [])
    }).catch(function() { setSyncPoints([]) }).finally(function() { setLoading(false) })
  }

  function fetchSyncLogs() {
    setLogsLoading(true)
    adminAPI.listSyncLogs(50).then(function(data) {
      setSyncLogs(data.logs || [])
    }).catch(function() { setSyncLogs([]) }).finally(function() { setLogsLoading(false) })
  }

  useEffect(fetchSyncPoints, [])

  useEffect(function() {
    if (showLogs) fetchSyncLogs()
  }, [showLogs])

  function startEdit(sp) {
    setEditingId(sp.id)
    setEditValues({
      sync_interval: sp.sync_interval || 0,
      is_paused: sp.is_paused || false,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues({})
  }

  function saveEdit(id) {
    adminAPI.updateSyncPoint(id, editValues).then(function() {
      toast({ title: t('admin.updated'), status: 'success', duration: 2000 })
      setEditingId(null)
      setEditValues({})
      fetchSyncPoints()
    }).catch(function(err) {
      toast({ title: err.message || t('admin.updateFailed'), status: 'error', duration: 3000 })
    })
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" my="16px">
        <Text fontSize="14px" color="#888">{t('admin.totalScheduledTasks', { count: syncPoints.length })}</Text>
        <HStack gap="8px">
          <Button h="28px" px="12px" fontSize="12px" rounded="6px"
            bg={showLogs ? '#22c55e' : 'transparent'} color={showLogs ? 'white' : '#666'}
            border="1px solid" borderColor={showLogs ? '#22c55e' : '#d1d5db'}
            _hover={{ borderColor: '#22c55e', color: showLogs ? 'white' : '#16a34a' }}
            leftIcon={<FileText size={13} />}
            onClick={function() { setShowLogs(!showLogs) }}>
            {t('admin.executionLogs')}
          </Button>
          <Button h="28px" px="12px" fontSize="12px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
            leftIcon={<RefreshCw size={13} />}
            onClick={function() { fetchSyncPoints(); if (showLogs) fetchSyncLogs() }}>
            {t('common.refresh')}
          </Button>
        </HStack>
      </Flex>

      {showLogs && (
        <Box mb="20px">
          <HStack gap="6px" mb="12px">
            <FileText size={15} color="#555" />
            <Text fontSize="14px" fontWeight={600} color="#333">{t('admin.executionLogs')}</Text>
            <Text fontSize="12px" color="#aaa">({syncLogs.length})</Text>
          </HStack>
          {logsLoading ? (
            <Box display="flex" justifyContent="center" py="30px">
              <Spinner size="md" color="#22c55e" />
            </Box>
          ) : syncLogs.length === 0 ? (
            <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="30px" textAlign="center">
              <Text fontSize="14px" color="#aaa">{t('admin.noLogs')}</Text>
            </Box>
          ) : (
            <Box overflowX="auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '10px', border: '1px solid #e2e2e2' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f0f0f0', fontSize: '12px', color: '#888', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.projectCol')}</th>
                    <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.typeCol')}</th>
                    <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.statusCol')}</th>
                    <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.durationCol')}</th>
                    <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.messageCol')}</th>
                    <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.timeCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map(function(log) {
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <Text fontWeight={500} color="#333" fontSize="13px">{log.owner_name}/{log.repo_name}</Text>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <Badge fontSize="10px" px="6px" py="1px" rounded="4px"
                            bg={log.sync_type === 'mirror' ? '#dbeafe' : '#fef3c7'}
                            color={log.sync_type === 'mirror' ? '#2563eb' : '#d97706'}>
                            {log.sync_type === 'mirror' ? t('admin.mirrorSync') : t('admin.statsRefresh')}
                          </Badge>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {log.status === 'success' ? (
                            <HStack gap="4px" color="#16a34a">
                              <CheckCircle size={14} />
                              <Text fontSize="12px" fontWeight={500}>{t('admin.success')}</Text>
                            </HStack>
                          ) : (
                            <HStack gap="4px" color="#dc2626">
                              <XCircle size={14} />
                              <Text fontSize="12px" fontWeight={500}>{t('admin.failure')}</Text>
                            </HStack>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <HStack gap="4px" color="#888">
                            <Timer size={12} />
                            <Text fontSize="12px">{log.duration > 0 ? (log.duration < 1000 ? log.duration + 'ms' : (log.duration / 1000).toFixed(1) + 's') : '-'}</Text>
                          </HStack>
                        </td>
                        <td style={{ padding: '10px 14px', maxWidth: '260px' }}>
                          <Text fontSize="12px" color={log.status === 'failure' ? '#dc2626' : '#888'} noOfLines={1}>{log.message || '-'}</Text>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#888', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {formatDateTime(log.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Box>
          )}
        </Box>
      )}

      <Box overflowX="auto">
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '10px', border: '1px solid #e2e2e2' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f0f0f0', fontSize: '12px', color: '#888', textAlign: 'left' }}>
              <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.projectCol')}</th>
              <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.typeCol')}</th>
              <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.intervalCol')}</th>
              <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.statusCol')}</th>
              <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.lastSyncCol')}</th>
              <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('admin.nextSyncCol')}</th>
              <th style={{ padding: '10px 14px', fontWeight: 500 }}>{t('common.operation')}</th>
            </tr>
          </thead>
          <tbody>
            {syncPoints.map(function(sp) {
              var isEditing = editingId === sp.id
              return (
                <tr key={sp.id} style={{ borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <Text fontWeight={500} color="#333">{sp.owner_name}/{sp.repo_name}</Text>
                    {sp.project_type && <Badge ml="6px" fontSize="9px" px="4px" rounded="3px"
                      bg={sp.project_type === 'mirror' ? '#eff6ff' : sp.project_type === 'public' ? '#f0fdf4' : sp.project_type === 'private' ? '#fff7ed' : '#f3f4f6'}
                      color={sp.project_type === 'mirror' ? '#2563eb' : sp.project_type === 'public' ? '#16a34a' : sp.project_type === 'private' ? '#ea580c' : '#6b7280'}>
                      {sp.project_type === 'mirror' ? t('project.mirror') : sp.project_type === 'public' ? t('project.public') : sp.project_type === 'private' ? t('project.private') : t('common.local')}
                    </Badge>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Badge fontSize="10px" px="6px" py="1px" rounded="4px"
                      bg={sp.sync_type === 'mirror' ? '#dbeafe' : '#fef3c7'}
                      color={sp.sync_type === 'mirror' ? '#2563eb' : '#d97706'}>
                      {sp.sync_type === 'mirror' ? t('admin.mirrorSync') : t('admin.statsRefresh')}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {isEditing ? (
                      <HStack gap="4px">
                        <Input type="number" value={secondsToHM(editValues.sync_interval).hours} size="sm" w="60px" fontSize="12px"
                          min={0} max={999}
                          onChange={function(e) {
                            var val = parseInt(e.target.value) || 0
                            if (val < 0) val = 0
                            if (val > 999) val = 999
                            var m = secondsToHM(editValues.sync_interval).minutes
                            setEditValues(Object.assign({}, editValues, { sync_interval: hmToSeconds(val, m) }))
                          }} />
                        <Text fontSize="12px" color="#888">{t('common.hour')}</Text>
                        <Input type="number" value={secondsToHM(editValues.sync_interval).minutes} size="sm" w="55px" fontSize="12px"
                          min={0} max={59}
                          onChange={function(e) {
                            var val = parseInt(e.target.value) || 0
                            if (val < 0) val = 0
                            if (val > 59) val = 59
                            var h = secondsToHM(editValues.sync_interval).hours
                            setEditValues(Object.assign({}, editValues, { sync_interval: hmToSeconds(h, val) }))
                          }} />
                        <Text fontSize="12px" color="#888">{t('common.minute')}</Text>
                      </HStack>
                    ) : (
                      <Text color="#555">{getIntervalLabel(sp.sync_interval)}</Text>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {isEditing ? (
                      <HStack gap="6px">
                        {editValues.sync_interval > 0 ? (
                          <>
                            <Switch colorScheme="green" size="sm" isChecked={!editValues.is_paused}
                              onChange={function(e) { setEditValues(Object.assign({}, editValues, { is_paused: !e.target.checked })) }} />
                            <Text fontSize="12px" color={editValues.is_paused ? '#dc2626' : '#16a34a'}>
                              {editValues.is_paused ? t('common.paused') : t('common.running')}
                            </Text>
                          </>
                        ) : (
                          <Text fontSize="12px" color="#888">{t('common.manual')}</Text>
                        )}
                      </HStack>
                    ) : sp.sync_interval === 0 ? (
                      <Text fontSize="12px" color="#888">{t('common.manual')}</Text>
                    ) : sp.is_paused ? (
                      <HStack gap="4px" color="#dc2626">
                        <Pause size={13} />
                        <Text fontSize="12px">{t('common.paused')}</Text>
                      </HStack>
                    ) : (
                      <HStack gap="4px" color="#16a34a">
                        <Play size={13} />
                        <Text fontSize="12px">{t('common.running')}</Text>
                      </HStack>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#888', fontSize: '12px' }}>
                    {sp.last_sync_at ? formatDateTime(sp.last_sync_at) : '-'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#888', fontSize: '12px' }}>
                    {!sp.is_paused && sp.next_sync_at ? formatDateTime(sp.next_sync_at) : '-'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {isEditing ? (
                      <HStack gap="6px">
                        <Button h="24px" px="10px" fontSize="11px" rounded="4px"
                          bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }}
                          onClick={function() { saveEdit(sp.id) }}>{t('common.save')}</Button>
                        <Button h="24px" px="10px" fontSize="11px" rounded="4px"
                          variant="outline" borderColor="#d1d5db" color="#666"
                          onClick={cancelEdit}>{t('common.cancel')}</Button>
                      </HStack>
                    ) : (
                      <Button h="24px" px="10px" fontSize="11px" rounded="4px"
                        variant="outline" borderColor="#d1d5db" color="#666"
                        _hover={{ borderColor: '#22c55e', color: '#16a34a' }}
                        onClick={function() { startEdit(sp) }}>{t('common.edit')}</Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Box>

      {!loading && syncPoints.length === 0 && (
        <Box textAlign="center" py="60px" color="#aaa">
          <Clock size={40} color="#ccc" />
          <Text fontSize="15px" mt="8px">{t('admin.noScheduledTasks')}</Text>
          <Text fontSize="13px" mt="4px">{t('admin.noScheduledTasksHint')}</Text>
        </Box>
      )}
    </Box>
  )
}

var AdminPage = function() {
  return (
    <Box maxW="960px" mx="auto">
      <HStack gap="8px" mb="24px">
        <Shield size={20} color="#333" />
        <Text fontSize="20px" fontWeight={700} color="#333">{t('admin.title')}</Text>
      </HStack>

      <Tabs colorScheme="green" mb="20px">
        <TabList borderColor="#e5e7eb" pb={0}>
          <Tab fontSize="13px" fontWeight={500} _selected={{ color: '#16a34a', borderColor: '#16a34a' }}>
            <HStack gap="5px"><Users size={14} /><Text>{t('admin.userManagement')}</Text></HStack>
          </Tab>
          <Tab fontSize="13px" fontWeight={500} _selected={{ color: '#16a34a', borderColor: '#16a34a' }}>
            <HStack gap="5px"><Clock size={14} /><Text>{t('admin.scheduledTasks')}</Text></HStack>
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel p={0} pb="60px">
            <UserManagementTab />
          </TabPanel>
          <TabPanel p={0} pb="60px">
            <SyncManagementTab />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}



export { Activity, UserManagement, UserProfile, UserSettings, AdminPage }
