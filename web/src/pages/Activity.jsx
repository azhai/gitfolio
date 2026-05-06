import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, Spinner } from '@chakra-ui/react'
import { activitiesAPI } from '../api/index'
import { timeAgo } from '../i18n/zh'

var TYPE_CONFIG = {
  push: { color: '#22c55e', bg: '#f0fdf4', icon: '📤', label: '推送' },
  mr: { color: '#8b5cf6', bg: '#faf5ff', icon: '🔀', label: '合并请求' },
  issue: { color: '#f59e0b', bg: '#fffbeb', icon: '⚠️', label: '议题' },
  comment: { color: '#3b82f6', bg: '#eff6ff', icon: '💬', label: '评论' },
  star: { color: '#ec4899', bg: '#fdf2f8', icon: '⭐', label: '星标' },
  fork: { color: '#6366f1', bg: '#eef2ff', icon: '🔱', label: '派生' },
  wiki: { color: '#14b8a6', bg: '#f0fdfa', icon: '📖', label: '维基' },
  release: { color: '#f97316', bg: '#fff7ed', icon: '🚀', label: '发布' },
}

const Activity = () => {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    activitiesAPI.list().then(function(data) {
      setActivities(Array.isArray(data) ? data : [])
    }).catch(function() { setActivities([]) }).finally(function() { setLoading(false) })
  }, [])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="80px">
        <Spinner size="xl" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box>
      <Text fontSize="22px" fontWeight="700" color="#333" mb="20px">📊 活动动态</Text>

      <VStack spacing="12px" align="stretch">
        {activities.map(function(item, idx) {
          var type = item.type || 'push'
          var cfg = TYPE_CONFIG[type] || TYPE_CONFIG.push
          return (
            <Flex key={item.id || idx} gap="14px"
              bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px"
              p="16px 20px" transition="all 0.15s"
              _hover={{ borderColor: '#d1d5db', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Box w="38px" h="38px" rounded="9px" bg={cfg.bg} flexShrink={0}
                display="flex" alignItems="center" justifyContent="center" fontSize="17px">
                {cfg.icon}
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
          <Text fontSize="40px" mb="8px">📊</Text>
          <Text fontSize="15px">暂无活动动态</Text>
        </Box>
      )}
    </Box>
  )
}

export default Activity
