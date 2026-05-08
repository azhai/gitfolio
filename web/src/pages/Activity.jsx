import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, Spinner } from '@chakra-ui/react'
import { activitiesAPI } from '../api/index'
import { timeAgo, t } from '../i18n'
import { ActivityIcons, IconMap } from '../components/Icons'

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

function ActIcon({ name, size = 17 }) {
  var cfg = ActivityIcons[name]
  if (!cfg) return null
  var C = cfg.icon
  return <C size={size} strokeWidth={2} color={cfg.color} />
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="80px">
        <Spinner size="xl" color="#22c55e" />
      </Box>
    )
  }

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
            <Flex key={item.id || idx} gap="14px"
              bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px"
              p="16px 20px" transition="all 0.15s"
              _hover={{ borderColor: '#d1d5db', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Box w="38px" h="38px" rounded="9px" bg={cfg.bg} flexShrink={0}
                display="flex" alignItems="center" justifyContent="center">
                <ActIcon name={key.icon} />
              </Box>
              <Box flex={1}>
                <Text fontSize="13.5px" color="#333" lineHeight="1.6">
                  <Text as="span" fontWeight="600">{item.user || item.username || ''}</Text>{' '}
                  <Text as="span" color="#666">{item.action || ''}</Text>{' '}
                  <Text as="span" fontWeight="600" color={cfg.color}>{item.target || ''}</Text>
                  {(item.ref_name || item.ref) && (
                    <Text as="span" ml="4px" px="7px" py="1px" rounded="4px" fontSize="11.5px"
                      bg="#f3f4f6" color="#666">{item.ref_name || item.ref}</Text>
                  )}
                </Text>
                <Text fontSize="12px" color="#aaa" mt="4px">{timeAgo(item.created_at)}</Text>
              </Box>
            </Flex>
          )
        })}
      </VStack>

      {!loading && activities.length === 0 && (
        <Box textAlign="center" py="60px" color="#aaa">
          <StatsIcon size={40} />
          <Text fontSize="15px" mt="8px">{t('activity.notFound')}</Text>
        </Box>
      )}
    </Box>
  )
}

export default Activity
