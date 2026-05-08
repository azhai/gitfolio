import React, { useState, useEffect, useRef } from 'react'
import { Box, Text, Flex, VStack, HStack, Badge, Button, Spinner, useToast, AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { tasksAPI, issuesAPI } from '../../api/index'
import SimpleRenderer from '../../components/SimpleRenderer'
import SimpleEditor from '../../components/SimpleEditor'
import { t, timeAgo } from '../../i18n/index'
import { LuClipboardList as ClipboardList, LuUser as User, LuWrench as Wrench, LuCircleCheckBig as CheckCircle2, LuMessageSquare as MessageSquare, LuPaperclip as Paperclip, LuLink as LinkIcon, LuUpload as Upload, LuX as X, LuTrash2 as Trash2, LuFile as FileIcon, LuImage as ImageIcon, LuFileText as FileText } from 'react-icons/lu'

var STATUS_CONFIG = {
  draft: { labelKey: 'task.status.draft', bg: '#f3f4f6', color: '#666' },
  progress: { labelKey: 'task.status.progress', bg: '#dbeafe', color: '#2563eb' },
  review: { labelKey: 'task.status.review', bg: '#fef3c7', color: '#d97706' },
  completed: { labelKey: 'task.status.completed', bg: '#dcfce7', color: '#16a34a' },
}

var PRIORITY_COLORS = {
  1: '#dc2626', 2: '#f97316', 3: '#eab308', 4: '#22c55e', 5: '#3b82f6',
}

var NEXT_STATUS = {
  draft: 'progress',
  progress: 'review',
  review: 'completed',
}

function getFileIcon(fileType) {
  if (!fileType) return <FileIcon size={14} color="#888" />
  if (fileType.indexOf('image') >= 0) return <ImageIcon size={14} color="#22c55e" />
  if (fileType.indexOf('pdf') >= 0) return <FileText size={14} color="#dc2626" />
  if (fileType.indexOf('word') >= 0 || fileType.indexOf('document') >= 0) return <FileText size={14} color="#2563eb" />
  return <FileIcon size={14} color="#888" />
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const TaskDetail = () => {
  const { owner, repo, id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [task, setTask] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [availableIssues, setAvailableIssues] = useState([])
  const [showIssuePicker, setShowIssuePicker] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const fileInputRef = useRef(null)
  const cancelRef = useRef()

  useEffect(() => {
    tasksAPI.get(owner, repo, id).then(function(data) {
      setTask(data)
    }).catch(function() { setTask(null) }).finally(function() { setLoading(false) })

    tasksAPI.comments(owner, repo, id).then(function(data) {
      setComments(Array.isArray(data) ? data : [])
    }).catch(function() { setComments([]) })
  }, [owner, repo, id])

  function refreshTask() {
    tasksAPI.get(owner, repo, id).then(function(data) { setTask(data) })
  }

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

  function handleFileUpload(e) {
    var files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    var promises = Array.from(files).map(function(file) {
      return tasksAPI.uploadAttachment(owner, repo, id, file)
    })
    Promise.all(promises).then(function() {
      toast({ title: t('task.attachmentUploaded'), status: 'success', duration: 2000 })
      refreshTask()
    }).catch(function(err) {
      toast({ title: err.message || t('task.uploadFailed'), status: 'error', duration: 3000 })
    }).finally(function() {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    })
  }

  function handleDeleteAttachment() {
    if (!deleteTarget) return
    tasksAPI.deleteAttachment(owner, repo, id, deleteTarget.id).then(function() {
      toast({ title: t('task.attachmentDeleted'), status: 'success', duration: 2000 })
      refreshTask()
    }).catch(function(err) {
      toast({ title: err.message || t('task.deleteFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setDeleteTarget(null) })
  }

  function handleLinkIssue(issueId) {
    tasksAPI.linkIssue(owner, repo, id, issueId).then(function() {
      toast({ title: t('task.issueLinked'), status: 'success', duration: 2000 })
      refreshTask()
    }).catch(function(err) {
      toast({ title: err.message || t('task.linkFailed'), status: 'error', duration: 3000 })
    })
  }

  function handleUnlinkIssue(issueId) {
    tasksAPI.unlinkIssue(owner, repo, id, issueId).then(function() {
      toast({ title: t('task.issueUnlinked'), status: 'success', duration: 2000 })
      refreshTask()
    }).catch(function(err) {
      toast({ title: err.message || t('task.unlinkFailed'), status: 'error', duration: 3000 })
    })
  }

  function openIssuePicker() {
    if (availableIssues.length > 0) {
      setShowIssuePicker(!showIssuePicker)
      return
    }
    issuesAPI.list(owner, repo, { state: 'open', per_page: 50 }).then(function(data) {
      var items = Array.isArray(data) ? data : (data && data.items ? data.items : [])
      setAvailableIssues(items)
      setShowIssuePicker(true)
    }).catch(function() { setAvailableIssues([]) })
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
        <ClipboardList size={36} color="#ccc" mb="6px" />
        <Text fontSize="14px">{t('task.notFound')}</Text>
      </Box>
    )
  }

  var cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.draft
  var priorityColor = PRIORITY_COLORS[task.priority] || '#888'
  var nextStatus = NEXT_STATUS[task.status]
  var linkedIssueIds = (task.issues || []).map(function(i) { return i.id })

  return (
    <Box>
      <Flex justify="space-between" align="start" mb="16px">
        <Box flex={1}>
          <HStack gap="10px" mb="6px" align="center">
            <Badge fontSize="12px" px="8px" py="2px" rounded="4px" bg={cfg.bg} color={cfg.color}>
              {t(cfg.labelKey)}
            </Badge>
            <Text fontSize="18px" fontWeight="700" color="#333">{task.title}</Text>
          </HStack>
          <HStack gap="14px" fontSize="13px" color="#888" mt="6px">
            <HStack gap="4px">
              <Box w="8px" h="8px" rounded="full" bg={priorityColor} />
              <Text>P{task.priority}</Text>
            </HStack>
            {task.initiator && <HStack gap="4px"><User size={13} /><Text>{task.initiator}</Text></HStack>}
            {task.handler && <HStack gap="4px"><Wrench size={13} /><Text>{task.handler}</Text></HStack>}
            {task.verifier && <HStack gap="4px"><CheckCircle2 size={13} /><Text>{task.verifier}</Text></HStack>}
            <Text>{timeAgo(task.created_at)}</Text>
          </HStack>
        </Box>
        {nextStatus && (
          <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleTransition} isLoading={submitting}>
            {t('task.transitionTo', { status: t(STATUS_CONFIG[nextStatus].labelKey) })}
          </Button>
        )}
      </Flex>

      {task.goal && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="8px">{t('task.goal')}</Text>
          <SimpleRenderer source={task.goal} owner={owner} repo={repo} />
        </Box>
      )}

      {task.draft && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="8px">{t('task.draftOrPlan')}</Text>
          <SimpleRenderer source={task.draft} owner={owner} repo={repo} />
        </Box>
      )}

      {task.schedules && task.schedules.length > 0 && (
        <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="10px">{t('task.schedules')}</Text>
          <VStack spacing="8px" align="stretch">
            {task.schedules.map(function(s, idx) {
              return (
                <Flex key={s.id || idx} justify="space-between" align="center" fontSize="13px">
                  <Badge fontSize="11px" px="6px" py="1px" rounded="4px" bg="#eff6ff" color="#2563eb">
                    {s.schedule_type || t('task.schedule')}
                  </Badge>
                  <Text color="#666">
                    {s.plan_start_date || t('common.pending')} ~ {s.plan_end_date || t('common.pending')}
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

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
        <Flex justify="space-between" align="center" mb="10px">
          <HStack gap="6px">
            <LinkIcon size={14} color="#555" />
            <Text fontSize="13px" fontWeight="600" color="#555">{t('task.linkedIssues')}</Text>
            {(task.issues && task.issues.length > 0) && (
              <Badge fontSize="11px" px="6px" py="1px" rounded="8px" bg="#eff6ff" color="#2563eb">
                {task.issues.length}
              </Badge>
            )}
          </HStack>
          <Button h="22px" px="8px" fontSize="11px" variant="outline" borderColor="#d1d5db" color="#666"
            onClick={openIssuePicker}>
            {showIssuePicker ? t('common.collapse') : t('common.linkIssue')}
          </Button>
        </Flex>

        {task.issues && task.issues.length > 0 && (
          <VStack spacing="6px" align="stretch" mb="8px">
            {task.issues.map(function(issue) {
              return (
                <Flex key={issue.id} align="center" gap="8px" fontSize="13px" py="4px" px="8px"
                  rounded="6px" _hover={{ bg: '#f9fafb' }}>
                  <Text color="#888">#{issue.number}</Text>
                  <Text color="#333" flex={1} cursor="pointer"
                    _hover={{ color: '#16a34a' }}
                    onClick={function() { navigate('/' + owner + '/' + repo + '/issues/' + issue.number) }}>
                    {issue.title}
                  </Text>
                  <Badge fontSize="10px" px="5px" py="1px" rounded="4px"
                    bg={issue.status === 'closed' ? '#f3f4f6' : '#dcfce7'}
                    color={issue.status === 'closed' ? '#666' : '#16a34a'}>
                    {issue.status === 'closed' ? t('common.closed') : t('common.open')}
                  </Badge>
                  <Box as="span" cursor="pointer" color="#aaa" _hover={{ color: '#dc2626' }}
                    onClick={function() { handleUnlinkIssue(issue.id) }}>
                    <X size={13} />
                  </Box>
                </Flex>
              )
            })}
          </VStack>
        )}

        {(!task.issues || task.issues.length === 0) && !showIssuePicker && (
          <Text fontSize="12px" color="#aaa">{t('common.noLinkedIssues')}</Text>
        )}

        {showIssuePicker && (
          <Box border="1px solid" borderColor="#e2e2e2" rounded="8px" maxH="200px" overflow="auto">
            {availableIssues.filter(function(i) { return linkedIssueIds.indexOf(i.id) < 0 }).length > 0
              ? availableIssues.filter(function(i) { return linkedIssueIds.indexOf(i.id) < 0 }).map(function(issue) {
                return (
                  <Flex key={issue.id} align="center" gap="8px" px="12px" py="8px" cursor="pointer"
                    _hover={{ bg: '#f9fafb' }}
                    onClick={function() { handleLinkIssue(issue.id) }}
                    borderBottom="1px solid" borderColor="#f0f0f0">
                    <Text fontSize="12px" color="#888">#{issue.number}</Text>
                    <Text fontSize="12.5px" color="#333" flex={1} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{issue.title}</Text>
                    <Text fontSize="11px" color="#22c55e">+ {t('common.link')}</Text>
                  </Flex>
                )
              })
              : <Text fontSize="12px" color="#aaa" py="12px" textAlign="center">{t('common.noLinkableIssues')}</Text>
            }
          </Box>
        )}
      </Box>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="20px" mb="16px">
        <Flex justify="space-between" align="center" mb="10px">
          <HStack gap="6px">
            <Paperclip size={14} color="#555" />
            <Text fontSize="13px" fontWeight="600" color="#555">{t('task.attachments')}</Text>
            {(task.attachments && task.attachments.length > 0) && (
              <Badge fontSize="11px" px="6px" py="1px" rounded="8px" bg="#fef3c7" color="#d97706">
                {task.attachments.length}
              </Badge>
            )}
          </HStack>
          <Button h="22px" px="8px" fontSize="11px" leftIcon={<Upload size={11} />}
            variant="outline" borderColor="#d1d5db" color="#666"
            onClick={function() { fileInputRef.current && fileInputRef.current.click() }}
            isLoading={uploading}>
            {t('task.uploadAttachment')}
          </Button>
        </Flex>

        <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          style={{ display: 'none' }} onChange={handleFileUpload} />

        {task.attachments && task.attachments.length > 0 && (
          <VStack spacing="4px" align="stretch">
            {task.attachments.map(function(a) {
              return (
                <Flex key={a.id} align="center" gap="8px" fontSize="13px" py="6px" px="8px"
                  rounded="6px" _hover={{ bg: '#f9fafb' }}>
                  {getFileIcon(a.file_type)}
                  <Text color="#16a34a" cursor="pointer" _hover={{ textDecoration: 'underline' }} flex={1}>{a.file_name}</Text>
                  <Text color="#aaa" fontSize="12px">{formatFileSize(a.file_size)}</Text>
                  <Box as="span" cursor="pointer" color="#aaa" _hover={{ color: '#dc2626' }}
                    onClick={function() { setDeleteTarget(a) }}>
                    <Trash2 size={13} />
                  </Box>
                </Flex>
              )
            })}
          </VStack>
        )}

        {(!task.attachments || task.attachments.length === 0) && (
          <Text fontSize="12px" color="#aaa">{t('task.noAttachments')}</Text>
        )}
      </Box>

      <HStack gap="6px" mb="10px">
        <MessageSquare size={14} color="#333" />
        <Text fontSize="13px" fontWeight="600" color="#333">{t('task.comments')} ({comments.length})</Text>
      </HStack>

      <VStack spacing="10px" align="stretch" mb="16px">
        {comments.map(function(c) {
          return (
            <Box key={c.id} bg="white" border="1px solid" borderColor="#e2e2e2" rounded="8px" p="16px">
              <Flex align="center" gap="8px" mb="8px">
                <Text fontSize="13px" fontWeight="600" color="#333">{c.author || t('common.unknown')}</Text>
                <Text fontSize="12px" color="#aaa">{timeAgo(c.created_at)}</Text>
              </Flex>
              <SimpleRenderer source={c.body} fontSize="13.5px" owner={owner} repo={repo} />
            </Box>
          )
        })}
      </VStack>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="8px" p="16px">
        <SimpleEditor
          value={commentText}
          onChange={setCommentText}
          placeholder={t('issue.writeComment')}
          height={160}
          owner={owner}
          repo={repo}
        />
        <Flex justify="flex-end" mt="10px">
          <Button h="30px" px="14px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleComment} isLoading={submitting}
            isDisabled={!commentText.trim()}>
            {t('issue.submitComment')}
          </Button>
        </Flex>
      </Box>

      <AlertDialog isOpen={!!deleteTarget} leastDestructiveRef={cancelRef}
        onClose={function() { setDeleteTarget(null) }}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="15px" fontWeight="600">{t('task.confirmDelete')}</AlertDialogHeader>
            <AlertDialogBody fontSize="14px">
              {t('task.confirmDeleteAttachment', { name: deleteTarget && deleteTarget.file_name })}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={function() { setDeleteTarget(null) }} h="32px" fontSize="13px">
                {t('common.cancel')}
              </Button>
              <Button colorScheme="red" onClick={handleDeleteAttachment} h="32px" fontSize="13px" ml={3}>
                {t('common.delete')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  )
}

export default TaskDetail
