import React, { useState } from 'react'
import { Box, Flex, HStack, Input, Text, Menu, MenuButton, MenuItem, MenuList, Avatar, Button } from '@chakra-ui/react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDownIcon } from '@chakra-ui/icons'
import { useAuth } from '../contexts/AuthContext'

var NAV_ITEMS = [
  { label: '首页', path: '/', icon: '🏠' },
  { label: '项目', path: '/projects', icon: '📂' },
  { label: '团队', path: '/groups', icon: '👥' },
  { label: '动态', path: '/activity', icon: '📊' },
  { label: '代码片段', path: '/snippets', icon: '📝' },
]

const TopNavbar = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    setMenuOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <Box as="nav" position="fixed" top={0} left={0} right={0} h="52px" bg="white" borderBottom="1px solid" borderColor="#e2e2e2" zIndex={1000}>
      <Flex h="full" alignItems="center" px={5} maxW="1400px" mx="auto">
        <RouterLink to="/">
          <Flex align="center" gap="6px" mr={8}>
            <Text fontSize="18px" fontWeight="bold">📁</Text>
            <Text fontSize="18px" fontWeight="bold" color="#333">gitfolio</Text>
          </Flex>
        </RouterLink>

        <HStack as="nav" spacing="4px" flex={1}>
          {NAV_ITEMS.map(function(item) {
            var isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <RouterLink key={item.path} to={item.path}>
                <Box px={3} py={2} rounded="6px" fontSize="14px"
                  color={isActive ? '#16a34a' : '#666'}
                  bg={isActive ? '#e6ffed' : 'transparent'}
                  _hover={{ bg: '#e6ffed', color: '#16a34a' }}
                  transition="all 0.15s">
                  {item.icon} {item.label}
                </Box>
              </RouterLink>
            )
          })}
        </HStack>

        <Flex alignItems="center" gap="16px">
          <Box position="relative" w="220px">
            <Box position="absolute" left="10px" top="50%" transform="translateY(-50%)" fontSize="12px" color="#bbb" pointerEvents="none">🔍</Box>
            <Input placeholder="搜索项目..." size="sm" w="full" h="30px"
              borderRadius="6px" borderColor="#e5e7eb" bg="#f9fafb" color="#999"
              pl="30px" pr="12px" fontSize="12.5px"
              _placeholder={{ color: '#bbb' }}
              _focus={{ borderColor: '#d1d5db', bg: 'white', boxShadow: 'none' }}
              _hover={{ borderColor: '#d1d5db' }} />
          </Box>
          <Text cursor="pointer" fontSize="14px" color="#bbb" _hover={{ color: '#16a34a' }}>🔔</Text>

          {isAuthenticated && user ? (
            <Menu isOpen={menuOpen} onOpen={function() { setMenuOpen(true) }} onClose={function() { setMenuOpen(false) }}>
              <MenuButton as={Button} variant="ghost" size="sm" px="10px" h="32px"
                borderRadius="9999px" _hover={{ bg: '#f3f4f6' }}
                rightIcon={<ChevronDownIcon fontSize="12px" />}>
                <HStack gap="6px">
                  <Avatar size="xs" name={user.full_name || user.username} src={user.avatar_url} bg="#22c55e" color="white" />
                  <Text fontSize="13px" fontWeight="500" color="#333">{user.username}</Text>
                </HStack>
              </MenuButton>
              <MenuList boxShadow="lg" border="1px solid #e8e8e8" rounded="10px" p="6px" minW="180px" zIndex={1100}>
                <MenuItem fontSize="13.5px" rounded="6px" _hover={{ bg: '#f0fdf4', color: '#16a34a' }}
                  onClick={function() { setMenuOpen(false); navigate('/users/' + user.username) }}>
                  👤 个人资料
                </MenuItem>
                <MenuItem fontSize="13.5px" rounded="6px" _hover={{ bg: '#f0fdf4', color: '#16a34a' }}
                  onClick={function() { setMenuOpen(false); navigate('/settings') }}>
                  ⚙️ 个人设置
                </MenuItem>
                <MenuItem fontSize="13.5px" rounded="6px" _hover={{ bg: '#f0fdf4', color: '#16a34a' }}
                  onClick={function() { setMenuOpen(false); navigate('/users') }}>
                  👥 用户管理
                </MenuItem>
                <Box my="4px" borderTop="1px solid #eee" />
                <MenuItem fontSize="13.5px" rounded="6px" color="#dc2626" _hover={{ bg: '#fef2f2' }}
                  onClick={handleLogout}>
                  🚪 退出登录
                </MenuItem>
              </MenuList>
            </Menu>
          ) : (
            <HStack gap="12px">
              <Button h="30px" px="14px" fontSize="13px" rounded="6px" variant="outline"
                borderColor="#d1d5db" color="#666"
                _hover={{ borderColor: '#22c55e', color: '#16a34a', bg: '#f0fdf4' }}
                onClick={function() { navigate('/login') }}>
                登录
              </Button>
              <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
                _hover={{ bg: '#16a34a' }}
                onClick={function() { navigate('/login') }}>
                注册
              </Button>
            </HStack>
          )}
        </Flex>
      </Flex>
    </Box>
  )
}

export default TopNavbar
