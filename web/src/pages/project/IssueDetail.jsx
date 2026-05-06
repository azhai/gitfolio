import React, { useState, useEffect } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Button, Spinner, Textarea, Avatar, Divider, Input, useToast } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { issuesAPI, labelsAPI } from '../../api/index'
import { timeAgo } from '../../i18n/zh'

const IssueDetail = () => {
  const { owner, repo, number } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [issue, setIssue] = useState(null)
  const [comments, setComments] = useState([])
  const [allLabels, setAllLabels] = useState([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [updatingLabels, setUpdatingLabels] = useState(false)

  useEffect(() => {
    Promise.all([
      issuesAPI.get(owner, repo, number),
      issuesAPI.comments(owner, repo, number),
      labelsAPI.list(owner, repo).catch(function() { return [] }),
    ]).then(function([issueData, commentsData, labelsData]) {
      setIssue(issueData)
      setComments(Array.isArray(commentsData) ? commentsData : [])
      setAllLabels(Array.isArray(labelsData) ? labelsData : [])
    }).catch(function() { setIssue(null) }).finally(function() { setLoading(false) })
  }, [owner, repo, number])

  function handleComment() {
    if (!commentText.trim()) return
    setSubmitting(true)
    issuesAPI.createComment(owner, repo, number, { body: commentText }).then(function(newComment) {
      setComments(function(prev) { return prev.concat([newComment]) })
      setCommentText('')
    }).catch(function(err) {
      toast({ title: err.message || '评论失败', status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  function handleToggleClose() {
    if (!issue) return
    issuesAPI.update(owner, repo, number, { is_closed: !issue.is_closed }).then(function(data) {
      setIssue(data)
    }).catch(function(err) {
      toast({ title: err.message || '操作失败', status: 'error', duration: 3000 })
    })
  }

  function handleToggleLabel(labelName) {
    if (!issue) return
    setUpdatingLabels(true)
    var currentLabels = (issue.labels || []).map(function(l) { return l.name || l })
    var newLabels
    if (currentLabels.indexOf(labelName) >= 0) {
      newLabels = currentLabels.filter(function(n) { return n !== labelName })
    } else {
      newLabels = currentLabels.concat([labelName])
    }
    issuesAPI.update(owner, repo, number, { labels: newLabels }).then(function(data) {
      setIssue(data)
    }).catch(function(err) {
      toast({ title: err.message || '更新标签失败', status: 'error', duration: 3000 })
    }).finally(function() { setUpdatingLabels(false) })
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py="60px">
        <Spinner size="lg" color="#22c55e" />
      </Box>
    )
  }

  if (!issue) {
    return (
      <Box textAlign="center" py="50px" color="#aaa">
        <Text fontSize="36px" mb="6px">⚠️</Text>
        <Text fontSize="14px">未找到该议题</Text>
      </Box>
    )
  }

  var currentLabelNames = (issue.labels || []).map(function(l) { return l.name || l })

  return (
    <Box>
      <Flex justify="space-between" align="start" mb="16px">
        <Box flex={1}>
          <HStack gap="10px" mb="6px" align="center">
            {issue.is_closed ? (
              <Badge fontSize="12px" px="8px" py="2px" rounded="4px" bg="#fef2f2" color="#dc2626">已关闭</Badge>
            ) : (
              <Badge fontSize="12px" px="8px" py="2px" rounded="4px" bg="#dcfce7" color="#16a34a">开启中</Badge>
            )}
            <Text fontSize="18px" fontWeight="700" color="#333">{issue.title}</Text>
          </HStack>
          <Text fontSize="13px" color="#888">
            #{issue.number} 由 {issue.author || '未知用户'} 创建于 {timeAgo(issue.created_at)}
            {issue.assignee && ' · 指派给 ' + issue.assignee}
          </Text>
        </Box>
        <Button h="30px" px="14px" fontSize="13px" rounded="6px"
          bg={issue.is_closed ? '#22c55e' : '#dc2626'} color="white"
          _hover={{ bg: issue.is_closed ? '#16a34a' : '#b91c1c' }}
          onClick={handleToggleClose}>
          {issue.is_closed ? '重新开启' : '关闭议题'}
        </Button>
      </Flex>

      <Flex gap="20px" align="start">
        <Box flex={1}>
          {issue.body && (
            <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
              <Flex align="center" gap="8px" mb="10px">
                <Avatar size="sm" name={issue.author} bg="#22c55e" color="white" />
                <Text fontSize="13px" fontWeight="600" color="#333">{issue.author || '未知用户'}</Text>
                <Text fontSize="12px" color="#aaa">发表于 {timeAgo(issue.created_at)}</Text>
              </Flex>
              <Divider borderColor="#f0f0f0" mb="12px" />
              <Text fontSize="13.5px" color="#333" whiteSpace="pre-wrap" lineHeight="1.7">{issue.body}</Text>
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
                    <Avatar size="sm" name={c.author} bg="#22c55e" color="white" />
                    <Text fontSize="13px" fontWeight="600" color="#333">{c.author || '未知用户'}</Text>
                    <Text fontSize="12px" color="#aaa">{timeAgo(c.created_at)}</Text>
                  </Flex>
                  <Divider borderColor="#f0f0f0" mb="10px" />
                  <Text fontSize="13.5px" color="#444" whiteSpace="pre-wrap" lineHeight="1.6">{c.body}</Text>
                </Box>
              )
            })}
          </VStack>

          <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="8px" p="16px">
            <Textarea value={commentText} onChange={function(e) { setCommentText(e.target.value) }}
              placeholder="写下你的评论..." fontSize="13.5px" borderRadius="8px" borderColor="#d1d5db" rows={4}
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

        <Box w="240px" flexShrink={0}>
          <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="8px" p="16px">
            <VStack spacing="12px" align="stretch">
              <Box>
                <Text fontSize="11px" fontWeight="600" color="#aaa" textTransform="uppercase" mb="4px">状态</Text>
                <Badge fontSize="12px" px="8px" py="2px" rounded="4px"
                  bg={issue.is_closed ? '#fef2f2' : '#dcfce7'} color={issue.is_closed ? '#dc2626' : '#16a34a'}>
                  {issue.is_closed ? '已关闭' : '开启中'}
                </Badge>
              </Box>

              <Box>
                <Text fontSize="11px" fontWeight="600" color="#aaa" textTransform="uppercase" mb="4px">创建者</Text>
                <HStack gap="6px">
                  <Avatar size="xs" name={issue.author} bg="#22c55e" color="white" />
                  <Text fontSize="13px" color="#333">{issue.author || '未知'}</Text>
                </HStack>
              </Box>

              {issue.assignee && (
                <Box>
                  <Text fontSize="11px" fontWeight="600" color="#aaa" textTransform="uppercase" mb="4px">指派给</Text>
                  <HStack gap="6px">
                    <Avatar size="xs" name={issue.assignee} bg="#2563eb" color="white" />
                    <Text fontSize="13px" color="#333">{issue.assignee}</Text>
                  </HStack>
                </Box>
              )}

              <Box>
                <Flex justify="space-between" align="center" mb="6px">
                  <Text fontSize="11px" fontWeight="600" color="#aaa" textTransform="uppercase">标签</Text>
                  <Button h="18px" px="4px" fontSize="10px" variant="link" color="#22c55e"
                    onClick={function() { setShowLabelPicker(!showLabelPicker) }}>
                    {showLabelPicker ? '收起' : '编辑'}
                  </Button>
                </Flex>
                {currentLabelNames.length > 0 && (
                  <VStack spacing="4px" align="start" mb="6px">
                    {issue.labels.map(function(label) {
                      return (
                        <Badge key={label.name || label} fontSize="11px" px="8px" py="2px" rounded="12px"
                          bg={label.color || '#e5e7eb'} color={label.text_color || '#333'}>
                          {label.name || label}
                        </Badge>
                      )
                    })}
                  </VStack>
                )}
                {showLabelPicker && (
                  <Box border="1px solid" borderColor="#e2e2e2" rounded="6px" p="8px" maxH="160px" overflow="auto">
                    {allLabels.length > 0 ? allLabels.map(function(label) {
                      var name = label.name || label
                      var isActive = currentLabelNames.indexOf(name) >= 0
                      return (
                        <Flex key={name} align="center" gap="6px" py="4px" px="4px" cursor="pointer"
                          rounded="4px" _hover={{ bg: '#f9fafb' }}
                          onClick={function() { handleToggleLabel(name) }}>
                          <Box w="14px" h="14px" rounded="3px" border="2px solid"
                            borderColor={isActive ? '#22c55e' : '#d1d5db'}
                            bg={isActive ? '#22c55e' : 'transparent'}
                            display="flex" alignItems="center" justifyContent="center">
                            {isActive && <Text fontSize="9px" color="white">✓</Text>}
                          </Box>
                          <Box w="10px" h="10px" rounded="2px" bg={label.color || '#e5e7eb'} />
                          <Text fontSize="12px" color="#333">{name}</Text>
                        </Flex>
                      )
                    }) : (
                      <Text fontSize="12px" color="#aaa" py="4px">暂无标签</Text>
                    )}
                  </Box>
                )}
              </Box>

              <Box>
                <Text fontSize="11px" fontWeight="600" color="#aaa" textTransform="uppercase" mb="4px">创建时间</Text>
                <Text fontSize="12.5px" color="#666">{new Date(issue.created_at).toLocaleString('zh-CN')}</Text>
              </Box>

              <Box>
                <Text fontSize="11px" fontWeight="600" color="#aaa" textTransform="uppercase" mb="4px">更新时间</Text>
                <Text fontSize="12.5px" color="#666">{new Date(issue.updated_at).toLocaleString('zh-CN')}</Text>
              </Box>

              {issue.is_locked && (
                <Box>
                  <Badge fontSize="11px" px="8px" py="2px" rounded="4px" bg="#fef3c7" color="#d97706">🔒 已锁定</Badge>
                </Box>
              )}
            </VStack>
          </Box>
        </Box>
      </Flex>
    </Box>
  )
}

export default IssueDetail
