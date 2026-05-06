import React, { useState, useEffect, useRef } from 'react'
import { Box, Text, Input, Textarea, Button, Flex, Spinner, useToast, Tabs, TabList, Tab, TabPanels, TabPanel, Avatar } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { usersAPI } from '../api/index'
import { useAuth } from '../contexts/AuthContext'

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
      toast({ title: '获取用户信息失败', status: 'error', duration: 3000 })
    }).finally(function() { setLoading(false) })
  }, [])

  function handleAvatarClick() {
    if (fileInputRef.current) fileInputRef.current.click()
  }

  function handleAvatarChange(e) {
    var file = e.target.files && e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: '头像文件不能超过 2MB', status: 'error', duration: 3000 })
      return
    }
    setAvatarUploading(true)
    usersAPI.uploadAvatar(user.username, file).then(function(data) {
      if (data.avatar || data.avatar_url) {
        setAvatarUrl(data.avatar || data.avatar_url)
        toast({ title: '头像已更新', status: 'success', duration: 3000 })
      } else {
        toast({ title: '头像上传失败', status: 'error', duration: 3000 })
      }
    }).catch(function() {
      toast({ title: '头像上传失败', status: 'error', duration: 3000 })
    }).finally(function() { setAvatarUploading(false) })
  }

  function handleSaveProfile() {
    if (!profile.full_name.trim()) {
      toast({ title: '请输入姓名', status: 'error', duration: 3000 })
      return
    }
    setSaving(true)
    usersAPI.updateMe(profile).then(function() {
      toast({ title: '个人资料已更新', status: 'success', duration: 3000 })
    }).catch(function(err) {
      toast({ title: err.message || '更新失败', status: 'error', duration: 3000 })
    }).finally(function() { setSaving(false) })
  }

  function handleChangePassword() {
    if (!passwords.old_password) {
      toast({ title: '请输入当前密码', status: 'error', duration: 3000 })
      return
    }
    if (!passwords.new_password || passwords.new_password.length < 6) {
      toast({ title: '新密码至少6个字符', status: 'error', duration: 3000 })
      return
    }
    if (passwords.new_password !== passwords.confirm_password) {
      toast({ title: '两次输入的新密码不一致', status: 'error', duration: 3000 })
      return
    }
    setSaving(true)
    usersAPI.changePassword({
      old_password: passwords.old_password,
      new_password: passwords.new_password,
    }).then(function() {
      toast({ title: '密码已修改', status: 'success', duration: 3000 })
      setPasswords({ old_password: '', new_password: '', confirm_password: '' })
    }).catch(function(err) {
      toast({ title: err.message || '修改密码失败', status: 'error', duration: 3000 })
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
      <Text fontSize="20px" fontWeight="700" color="#333" mb="24px">⚙️ 个人设置</Text>

      <Tabs colorScheme="green" mb="20px">
        <TabList borderColor="#e5e7eb" pb={0}>
          <Tab fontSize="13px" fontWeight="500" _selected={{ color: '#16a34a', borderColor: '#16a34a' }}>👤 个人资料</Tab>
          <Tab fontSize="13px" fontWeight="500" _selected={{ color: '#16a34a', borderColor: '#16a34a' }}>🔑 修改密码</Tab>
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
                    📷
                  </Box>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                </Box>
                <Box>
                  <Text fontSize="14px" fontWeight="600" color="#333" mb="4px">{user?.full_name || user?.username}</Text>
                  <Text fontSize="13px" color="#888" mb="8px">@{user?.username}</Text>
                  <Button h="26px" px="10px" fontSize="12px" rounded="4px" variant="outline" borderColor="#d1d5db"
                    onClick={handleAvatarClick} isLoading={avatarUploading}>
                    更换头像
                  </Button>
                </Box>
              </Flex>

              <Box mb="16px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">用户名</Text>
                <Input value={user?.username || ''} isReadOnly h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db" bg="#f9fafb" color="#999" />
              </Box>

              <Box mb="16px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">邮箱</Text>
                <Input value={user?.email || ''} isReadOnly h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db" bg="#f9fafb" color="#999" />
              </Box>

              <Box mb="16px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">姓名 *</Text>
                <Input value={profile.full_name} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { full_name: e.target.value }) }) }}
                  placeholder="输入姓名" h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Box mb="16px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">个人简介</Text>
                <Textarea value={profile.bio} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { bio: e.target.value }) }) }}
                  placeholder="介绍一下自己..." fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={4}
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Box mb="16px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">网站</Text>
                <Input value={profile.website} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { website: e.target.value }) }) }}
                  placeholder="https://example.com" h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Box mb="20px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">位置</Text>
                <Input value={profile.location} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { location: e.target.value }) }) }}
                  placeholder="城市/地区" h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Flex justify="flex-end" gap="10px">
                <Button h="34px" px="16px" fontSize="13px" rounded="6px" variant="outline"
                  borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>
                  取消
                </Button>
                <Button h="34px" px="20px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
                  _hover={{ bg: '#16a34a' }} onClick={handleSaveProfile} isLoading={saving}>
                  保存修改
                </Button>
              </Flex>
            </Box>
          </TabPanel>

          <TabPanel p={0}>
            <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px">
              <Box mb="16px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">当前密码 *</Text>
                <Input type="password" value={passwords.old_password} onChange={function(e) { setPasswords(function(p) { return Object.assign({}, p, { old_password: e.target.value }) }) }}
                  placeholder="输入当前密码" h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Box mb="16px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">新密码 *</Text>
                <Input type="password" value={passwords.new_password} onChange={function(e) { setPasswords(function(p) { return Object.assign({}, p, { new_password: e.target.value }) }) }}
                  placeholder="至少6个字符" h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Box mb="20px">
                <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">确认新密码 *</Text>
                <Input type="password" value={passwords.confirm_password} onChange={function(e) { setPasswords(function(p) { return Object.assign({}, p, { confirm_password: e.target.value }) }) }}
                  placeholder="再次输入新密码" h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
              </Box>

              <Flex justify="flex-end">
                <Button h="34px" px="20px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
                  _hover={{ bg: '#16a34a' }} onClick={handleChangePassword} isLoading={saving}>
                  修改密码
                </Button>
              </Flex>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  )
}

export default UserSettings
