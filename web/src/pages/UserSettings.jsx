import React, { useState, useEffect, useRef } from 'react'
import { Box, Text, Input, Textarea, Button, Flex, Spinner, useToast, Tabs, TabList, Tab, TabPanels, TabPanel, Avatar, HStack, SimpleGrid, VStack, Badge, useColorModeValue } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { usersAPI } from '../api/index'
import { useAuth } from '../contexts/AuthContext'
import { t } from '../i18n/index'
import { LuSettings as Settings, LuUser as User, LuKey as Key, LuCamera as Camera, LuPalette as Palette } from 'react-icons/lu'
import { getCodeTheme, setCodeTheme, getAllThemes, getThemeStyle } from '../codeThemes'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'

const UserSettings = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
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
                    cursor="pointer" fontSize="14px" color="white"
                    border="2px solid white"
                    onClick={handleAvatarClick}
                    _hover={{ bg: '#16a34a' }}>
                    <Camera size={14} />
                  </Box>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                </Box>
                <Box>
                  <Text fontSize="14px" fontWeight="600" color="#333" mb="4px">{user?.full_name || user?.username}</Text>
                  <Text fontSize="13px" color="#888" mb="8px">@{user?.username}</Text>
                  <Button h="26px" px="10px" fontSize="12px" rounded="4px" variant="outline" borderColor="#d1d5db"
                    onClick={handleAvatarClick} isLoading={avatarUploading}>
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
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Box mb="16px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('userSettings.bio')}</Text>
                <Textarea value={profile.bio} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { bio: e.target.value }) }) }}
                  placeholder={t('userSettings.bioPlaceholder')} fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={4}
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Box mb="16px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('userSettings.website')}</Text>
                <Input value={profile.website} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { website: e.target.value }) }) }}
                  placeholder="https://example.com" h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Box mb="20px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('userSettings.location')}</Text>
                <Input value={profile.location} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { location: e.target.value }) }) }}
                  placeholder={t('userSettings.locationPlaceholder')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Flex justify="flex-end" gap="10px">
                <Button h="34px" px="16px" fontSize="13px" rounded="6px" variant="outline"
                  borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>
                  {t('common.cancel')}
                </Button>
                <Button h="34px" px="20px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
                  _hover={{ bg: '#16a34a' }} onClick={handleSaveProfile} isLoading={saving}>
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
                  _hover={{ bg: '#16a34a' }} onClick={handleChangePassword} isLoading={saving}>
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
                          style={theme.style}
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

export default UserSettings
