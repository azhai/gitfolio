import React, { useState } from 'react'
import { Box, Flex, HStack, Input, Text, Menu, MenuButton, MenuItem, MenuList, Avatar, Button } from '@chakra-ui/react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDownIcon } from '@chakra-ui/icons'
import { useAuth } from '../contexts/AuthContext'
import { NavIcons, IconMap } from './Icons'
import { LuRocket as Rocket } from 'react-icons/lu'
import LanguageSwitcher from './LanguageSwitcher'
import { t } from '../i18n'

var NAV_ITEMS = [
  { label: 'nav.dashboard', path: '/', icon: 'home' },
  { label: 'nav.projects', path: '/projects', icon: 'project' },
  { label: 'nav.groups', path: '/groups', icon: 'group' },
  { label: 'nav.activity', path: '/activity', icon: 'activity' },
  { label: 'nav.snippets', path: '/snippets', icon: 'snippet' },
]

function NavIcon({ name, size = 15 }) {
  var Comp = NavIcons[name]
  if (!Comp) return null
  return <Comp size={size} strokeWidth={2} />
}

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

  var SearchIcon = IconMap.search
  var BellIcon = IconMap.bell
  var UserIcon = IconMap.user
  var SettingsIcon = IconMap.settings
  var UsersIcon = IconMap.users
  var LogoutIcon = IconMap.logout

  return (
    <Box as="nav" position="fixed" top={0} left={0} right={0} h="52px" bg="white" borderBottom="1px solid" borderColor="#e2e2e2" zIndex={1000}>
      <Flex h="full" alignItems="center" px={5} maxW="1400px" mx="auto">
        <RouterLink to="/">
          <Flex align="center" gap="8px" mr={8}>
            <Rocket size={22} color="#16a34a" />
            <Text fontSize="18px" fontWeight="bold" color="#16a34a">GitFolio</Text>
          </Flex>
        </RouterLink>

        <HStack as="nav" spacing="4px" flex={1}>
          {NAV_ITEMS.map(function(item) {
            var isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path))
            var iconColor = isActive ? '#16a34a' : '#6b7280'
            return (
              <RouterLink key={item.path} to={item.path}>
                <Box px={3} py={2} rounded="6px" fontSize="14px"
                  color={isActive ? '#16a34a' : '#666'}
                  bg={isActive ? '#e6ffed' : 'transparent'}
                  _hover={{ bg: '#e6ffed', color: '#16a34a' }}
                  transition="all 0.15s">
                  <HStack gap="4px"><NavIcon name={item.icon} /><Text>{t(item.label)}</Text></HStack>
                </Box>
              </RouterLink>
            )
          })}
        </HStack>

        <Flex alignItems="center" gap="16px">
          <Box position="relative" w="220px">
            <Box position="absolute" left="10px" top="50%" transform="translateY(-50%)" pointerEvents="none">
              <SearchIcon size={14} color="#bbb" />
            </Box>
            <Input placeholder={t('projects.searchPlaceholder')} size="sm" w="full" h="30px"
              borderRadius="6px" borderColor="#e5e7eb" bg="#f9fafb" color="#999"
              pl="30px" pr="12px" fontSize="12.5px"
              _placeholder={{ color: '#bbb' }}
              _focus={{ borderColor: '#d1d5db', bg: 'white', boxShadow: 'none' }}
              _hover={{ borderColor: '#d1d5db' }} />
          </Box>
          <LanguageSwitcher width="90px" height="30px" />
          <Box cursor="pointer" _hover={{ color: '#16a34a' }} color="#bbb">
            <BellIcon size={18} />
          </Box>

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
                  <HStack gap="8px"><UserIcon size={15} /><Text>{t('nav.profile') || '个人资料'}</Text></HStack>
                </MenuItem>
                <MenuItem fontSize="13.5px" rounded="6px" _hover={{ bg: '#f0fdf4', color: '#16a34a' }}
                  onClick={function() { setMenuOpen(false); navigate('/settings') }}>
                  <HStack gap="8px"><SettingsIcon size={15} /><Text>{t('nav.settings')}</Text></HStack>
                </MenuItem>
                <MenuItem fontSize="13.5px" rounded="6px" _hover={{ bg: '#f0fdf4', color: '#16a34a' }}
                  onClick={function() { setMenuOpen(false); navigate('/admin') }}>
                  <HStack gap="8px"><UsersIcon size={15} /><Text>{t('nav.admin')}</Text></HStack>
                </MenuItem>
                <Box my="4px" borderTop="1px solid #eee" />
                <MenuItem fontSize="13.5px" rounded="6px" color="#dc2626" _hover={{ bg: '#fef2f2' }}
                  onClick={handleLogout}>
                  <HStack gap="8px"><LogoutIcon size={15} /><Text>{t('nav.logout')}</Text></HStack>
                </MenuItem>
              </MenuList>
            </Menu>
          ) : (
            <HStack gap="12px">
              <Button h="30px" px="14px" fontSize="13px" rounded="6px" variant="outline"
                borderColor="#d1d5db" color="#666"
                _hover={{ borderColor: '#22c55e', color: '#16a34a', bg: '#f0fdf4' }}
                onClick={function() { navigate('/login') }}>
                {t('nav.login')}
              </Button>
              <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
                _hover={{ bg: '#16a34a' }}
                onClick={function() { navigate('/login') }}>
                {t('nav.register')}
              </Button>
            </HStack>
          )}
        </Flex>
      </Flex>
    </Box>
  )
}

export default TopNavbar
