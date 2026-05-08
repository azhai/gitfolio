import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, Button, Spinner, SimpleGrid, HStack } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { groupsAPI } from '../api/index'
import { timeAgo, t } from '../i18n'
import { IconMap } from '../components/Icons'

const Groups = () => {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    groupsAPI.list().then(function(data) {
      setGroups(Array.isArray(data) ? data : [])
    }).catch(function() { setGroups([]) }).finally(function() { setLoading(false) })
  }, [])

  var UsersIcon = IconMap.users
  var PlusIcon = IconMap.plus

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

export default Groups
