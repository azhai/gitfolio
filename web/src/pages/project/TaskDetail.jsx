import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Button, Spinner, Textarea } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { tasksAPI } from '../../api/index'
import { timeAgo } from '../../i18n/zh'

var STATUS_CONFIG = {
  draft: { label: '草稿', bg: '#f3f4f6', color: '#666' },
  progress: { label: '进行中', bg: '#dbeafe', color: '#2563eb' },
  review: { label: '审核中', bg: '#fef3c7', color: '#d97706' },
  completed: { label: '已完成', bg: '#dcfce7', color: '#16a34a' },
}

var PRIORITY_COLORS = {
  1: '#dc2626', 2: '#f97316', 3: '#eab308', 4: '#22c55e', 5: '#3b82f6',
}

var NEXT_STATUS = {
  draft: 'progress',
  progress: 'review',
  review: 'completed',
}

const TaskDetail = () => {
  const { owner, repo, id } = useParams()
  const navigate = useNavigate()
  const [task, setTask] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    tasksAPI.get(owner, repo, id).then(function(data) {
      setTask(data)
    }).catch(function() { setTask(null) }).finally(function() { setLoading(false) })

    tasksAPI.comments(owner, repo, id).then(function(data) {
      setComments(Array.isArray(data) ? data : [])
    }).catch(function() { setComments([]) })
  }, [owner, repo, id])

  function handleTransition() {
    if (!task) return
    var nextStatus = NEXT_STATUS[task.status]
    if (!nextStatus) return
    setSubmitting(true)
    tasksAPI.transition(owner, repo, id, { to_status: nextStatus }).then(function() {
      return tasksAPI.get(owner, repo, id)
    }).then(function(data) {
      setTask(data)
    }).catch(function() {}).finally(function() { setSubmitting(false) })
  }

  function handleComment() {
    if (!commentText.trim()) return
    setSubmitting(true)
    tasksAPI.createComment(owner, repo, id, { body: commentText }).then(function(newComment) {
      setComments(function(prev) { return prev.concat([newComment]) })
      setCommentText('')
    }).catch(function() {}).finally(function() { setSubmitting(false) })
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  if (!task) {
    return (
      <Box textAlign="center" py="50px" color="#aaa">
        <Text fontSize="36px" mb="6px">📋</Text>
        <Text fontSize="14px">未找到任务</Text>
      </Box>
    )
  }

  var cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.draft
  var priorityColor = PRIORITY_COLORS[task.priority] || '#888'
  var nextStatus = NEXT_STATUS[task.status]

  return (
    <Box>
      <Flex justify="space-between" align="start" mb="16px">
        <Box flex={1}>
          <HStack gap="10px" mb="6px" align="center">
            <Badge fontSize="12px" px="8px" py="2px" rounded="4px" bg={cfg.bg} color={cfg.color}>
              {cfg.label}
            </Badge>
            <Text fontSize="18px" fontWeight="700" color="#333">{task.title}</Text>
          </HStack>
          <HStack gap="14px" fontSize="13px" color="#888" mt="6px">
            <HStack gap="4px">
              <Box w="8px" h="8px" rounded="full" bg={priorityColor} />
              <Text>P{task.priority}</Text>
            </HStack>
            {task.initiator && <Text>👤 {task.initiator}</Text>}
            {task.handler && <Text>🔧 {task.handler}</Text>}
            {task.verifier && <Text>✅ {task.verifier}</Text>}
            <Text>{timeAgo(task.created_at)}</Text>
          </HStack>
        </Box>
        {nextStatus && (
          <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleTransition} isLoading={submitting}>
            转为{STATUS_CONFIG[nextStatus].label}
          </Button>
        )}
      </Flex>

      {task.goal && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">目标</Text>
          <Text fontSize="13.5px" color="#333" whiteSpace="pre-wrap" lineHeight="1.7">{task.goal}</Text>
        </Box>
      )}

      {task.draft && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">草稿</Text>
          <Text fontSize="13.5px" color="#333" whiteSpace="pre-wrap" lineHeight="1.7">{task.draft}</Text>
        </Box>
      )}

      {task.schedules && task.schedules.length > 0 && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="10px">排期</Text>
          <VStack spacing="8px" align="stretch">
            {task.schedules.map(function(s, idx) {
              return (
                <Flex key={s.id || idx} justify="space-between" align="center" fontSize="13px">
                  <Badge fontSize="11px" px="6px" py="1px" rounded="4px" bg="#eff6ff" color="#2563eb">
                    {s.schedule_type || '排期'}
                  </Badge>
                  <Text color="#666">
                    {s.plan_start_date || '待定'} ~ {s.plan_end_date || '待定'}
                  </Text>
                  <HStack gap="8px" fontSize="12px" color="#888">
                    {s.user1 && <Text>{s.user1}</Text>}
                    {s.user2 && <Text>{s.user2}</Text>}
                  </HStack>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}

      {task.issues && task.issues.length > 0 && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="10px">关联议题</Text>
          <VStack spacing="6px" align="stretch">
            {task.issues.map(function(issue) {
              return (
                <Flex key={issue.id} align="center" gap="8px" fontSize="13px" cursor="pointer"
                  _hover={{ color: '#16a34a' }}
                  onClick={function() { navigate('/' + owner + '/' + repo + '/issues/' + issue.number) }}>
                  <Text color="#888">#{issue.number}</Text>
                  <Text color="#333" flex={1}>{issue.title}</Text>
                  <Badge fontSize="10px" px="5px" py="1px" rounded="4px"
                    bg={issue.status === 'closed' ? '#f3f4f6' : '#dcfce7'}
                    color={issue.status === 'closed' ? '#666' : '#16a34a'}>
                    {issue.status === 'closed' ? '已关闭' : '开启中'}
                  </Badge>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}

      {task.attachments && task.attachments.length > 0 && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="10px">附件</Text>
          <VStack spacing="6px" align="stretch">
            {task.attachments.map(function(a) {
              return (
                <Flex key={a.id} align="center" gap="8px" fontSize="13px">
                  <Text>📎</Text>
                  <Text color="#16a34a" _hover={{ textDecoration: 'underline' }} cursor="pointer">{a.file_name}</Text>
                  <Text color="#888" fontSize="12px">{(a.file_size / 1024).toFixed(1)} KB</Text>
                </Flex>
              )
            })}
          </VStack>
        </Box>
      )}

      <Text fontSize="13px" fontWeight="600" color="#333" mb="10px">
        💬 评论 ({comments.length})
      </Text>

      <VStack spacing="10px" align="stretch" mb="16px">
        {comments.map(function(c) {
          return (
            <Box key={c.id} bg="white" border="1px solid" borderColor="#e2e2e2" rounded="8px" p="16px">
              <Flex align="center" gap="8px" mb="8px">
                <Text fontSize="13px" fontWeight="600" color="#333">{c.author || '未知'}</Text>
                <Text fontSize="12px" color="#aaa">{timeAgo(c.created_at)}</Text>
              </Flex>
              <Text fontSize="13.5px" color="#444" whiteSpace="pre-wrap" lineHeight="1.6">{c.body}</Text>
            </Box>
          )
        })}
      </VStack>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="8px" p="16px">
        <Textarea value={commentText} onChange={function(e) { setCommentText(e.target.value) }}
          placeholder="写下你的评论..." fontSize="13.5px" borderRadius="8px" borderColor="#d1d5db" rows={3}
          _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        <Flex justify="flex-end" mt="10px">
          <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleComment} isLoading={submitting}
            isDisabled={!commentText.trim()}>
            发表评论
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}

export default TaskDetail
