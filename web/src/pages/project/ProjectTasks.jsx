import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Button, Spinner, Select } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { tasksAPI } from '../../api/index'
import { t, timeAgo } from '../../i18n/index'

var STATUS_CONFIG = {
  draft: { label: t('task.draft'), bg: '#f3f4f6', color: '#666', icon: '📝' },
  progress: { label: t('task.inProgress'), bg: '#dbeafe', color: '#2563eb', icon: '🔄' },
  review: { label: t('task.review'), bg: '#fef3c7', color: '#d97706', icon: '👀' },
  completed: { label: t('task.done'), bg: '#dcfce7', color: '#16a34a', icon: '✅' },
}

var PRIORITY_COLORS = {
  1: '#dc2626',
  2: '#f97316',
  3: '#eab308',
  4: '#22c55e',
  5: '#3b82f6',
}

const ProjectTasks = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    var params = {}
    if (statusFilter) params.status = statusFilter
    tasksAPI.list(owner, repo, params).then(function(data) {
      setTasks(Array.isArray(data) ? data : [])
    }).catch(function() { setTasks([]) }).finally(function() { setLoading(false) })
  }, [owner, repo, statusFilter])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb="16px">
        <HStack gap="12px" fontSize="14px" fontWeight="600">
          <Text color="#333">📋 {t('task.title')}</Text>
          <Text color="#888" fontSize="13px">({tasks.length})</Text>
        </HStack>
        <HStack gap="10px">
          <Select h="30px" w="150px" fontSize="13px" borderColor="#d1d5db" rounded="6px"
            value={statusFilter} onChange={function(e) { setStatusFilter(e.target.value) }}>
            <option value="">{t('common.all')}</option>
            <option value="draft">{t('task.draft')}</option>
            <option value="progress">{t('task.inProgress')}</option>
            <option value="review">{t('task.review')}</option>
            <option value="completed">{t('task.done')}</option>
          </Select>
          <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }}
            onClick={function() { navigate('/' + owner + '/' + repo + '/tasks/new') }}>
            + {t('task.newTask')}
          </Button>
        </HStack>
      </Flex>

      <VStack spacing="10px" align="stretch">
        {tasks.map(function(task) {
          var cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.draft
          var priorityColor = PRIORITY_COLORS[task.priority] || '#888'
          return (
            <Box key={task.id} bg="white" border="1px solid" borderColor="#e2e2e2"
              rounded="8px" p="16px 20px" transition="all 0.15s"
              _hover={{ borderColor: '#d1d5db', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              cursor="pointer"
              onClick={function() { navigate('/' + owner + '/' + repo + '/tasks/' + task.id) }}>
              <Flex justify="space-between" align="start">
                <Box flex={1}>
                  <HStack gap="8px" mb="4px" align="center">
                    <Text fontSize="14px">{cfg.icon}</Text>
                    <Badge fontSize="11px" px="7px" py="1px" rounded="4px" bg={cfg.bg} color={cfg.color}>
                      {cfg.label}
                    </Badge>
                    <Text fontSize="13.5px" fontWeight="600" color="#333">{task.title}</Text>
                  </HStack>
                  <HStack gap="14px" fontSize="12.5px" color="#888" mt="6px">
                    <HStack gap="4px">
                      <Box w="8px" h="8px" rounded="full" bg={priorityColor} />
                      <Text>P{task.priority}</Text>
                    </HStack>
                    {task.initiator && <Text>👤 {task.initiator}</Text>}
                    {task.handler && <Text>🔧 {task.handler}</Text>}
                    <Text>{timeAgo(task.created_at)}</Text>
                  </HStack>
                </Box>
              </Flex>
            </Box>
          )
        })}
      </VStack>

      {!loading && tasks.length === 0 && (
        <Box textAlign="center" py="50px" color="#aaa">
          <Text fontSize="36px" mb="6px">📋</Text>
          <Text fontSize="14px">{t('task.noTasks')}</Text>
        </Box>
      )}
    </Box>
  )
}

export default ProjectTasks
