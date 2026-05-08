import React, { useState, useEffect } from 'react'
import { Box, Text, Input, Button, Flex, HStack, Badge, useToast } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { tasksAPI, issuesAPI } from '../../api/index'
import SimpleEditor from '../../components/SimpleEditor'
import { t } from '../../i18n/index'
import { LuClipboardList as ClipboardList, LuLink as LinkIcon, LuX as X } from 'react-icons/lu'
import DateTimePicker from '../../components/DateTimePicker'

var PRIORITY_OPTIONS = [
  { value: 1, labelKey: 'task.priorityOptions.p1', color: '#dc2626' },
  { value: 2, labelKey: 'task.priorityOptions.p2', color: '#f97316' },
  { value: 3, labelKey: 'task.priorityOptions.p3', color: '#eab308' },
  { value: 4, labelKey: 'task.priorityOptions.p4', color: '#22c55e' },
  { value: 5, labelKey: 'task.priorityOptions.p5', color: '#3b82f6' },
]

const NewTask = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    goal: '',
    draft: '',
    priority: 3,
    handler: '',
    verifier: '',
    review_at: '',
  })
  const [availableIssues, setAvailableIssues] = useState([])
  const [selectedIssueIds, setSelectedIssueIds] = useState([])
  const [showIssuePicker, setShowIssuePicker] = useState(false)
  const [createdTaskId, setCreatedTaskId] = useState(null)

  useEffect(() => {
    issuesAPI.list(owner, repo, { state: 'open', per_page: 50 }).then(function(data) {
      var items = Array.isArray(data) ? data : (data && data.items ? data.items : [])
      setAvailableIssues(items)
    }).catch(function() { setAvailableIssues([]) })
  }, [owner, repo])

  useEffect(() => {
    if (!createdTaskId) return
    var promises = selectedIssueIds.map(function(issueId) {
      return tasksAPI.linkIssue(owner, repo, createdTaskId, issueId).catch(function() {})
    })
    Promise.all(promises).then(function() {
      navigate('/' + owner + '/' + repo + '/tasks/' + createdTaskId)
    })
  }, [createdTaskId])

  function toggleIssueSelection(issueId) {
    setSelectedIssueIds(function(prev) {
      if (prev.indexOf(issueId) >= 0) return prev.filter(function(id) { return id !== issueId })
      return prev.concat([issueId])
    })
  }

  function handleSubmit() {
    if (!form.title.trim()) {
      toast({ title: t('task.titleRequired'), status: 'error', duration: 3000 })
      return
    }
    setSubmitting(true)
    tasksAPI.create(owner, repo, form).then(function(data) {
      if (selectedIssueIds.length > 0) {
        setCreatedTaskId(data.id)
      } else {
        navigate('/' + owner + '/' + repo + '/tasks/' + data.id)
      }
    }).catch(function(err) {
      toast({ title: err.message || t('task.createFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  var selectedIssues = availableIssues.filter(function(i) { return selectedIssueIds.indexOf(i.id) >= 0 })

  return (
    <Box>
      <HStack gap="8px" mb="20px">
        <ClipboardList size={18} color="#333" />
        <Text fontSize="18px" fontWeight="700" color="#333">{t('task.newTask')}</Text>
      </HStack>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px">
        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('task.title')} *</Text>
          <Input value={form.title} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { title: e.target.value }) }) }}
            placeholder={t('task.title')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('task.goal')}</Text>
          <SimpleEditor
            value={form.goal}
            onChange={function(val) { setForm(function(p) { return Object.assign({}, p, { goal: val }) }) }}
            placeholder={t('task.goalPlaceholder')}
            height={200}
            owner={owner}
            repo={repo}
          />
        </Box>

        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('task.draftOrPlan')}</Text>
          <SimpleEditor
            value={form.draft}
            onChange={function(val) { setForm(function(p) { return Object.assign({}, p, { draft: val }) }) }}
            placeholder={t('task.draftPlaceholder')}
            height={200}
            owner={owner}
            repo={repo}
          />
        </Box>

        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('task.priority')}</Text>
          <HStack gap="8px" flexWrap="wrap">
            {PRIORITY_OPTIONS.map(function(opt) {
              var isActive = form.priority === opt.value
              return (
                <Badge key={opt.value} fontSize="12px" px="10px" py="4px" rounded="6px" cursor="pointer"
                  bg={isActive ? opt.color : '#f3f4f6'}
                  color={isActive ? 'white' : '#666'}
                  _hover={{ opacity: 0.8 }}
                  onClick={function() { setForm(function(p) { return Object.assign({}, p, { priority: opt.value }) }) }}>
                  {t(opt.labelKey)}
                </Badge>
              )
            })}
          </HStack>
        </Box>

        <Flex gap="16px" mb="20px">
          <Box flex={1}>
            <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('task.handler')}</Text>
            <Input value={form.handler} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { handler: e.target.value }) }) }}
              placeholder={t('common.username')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
              _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          </Box>
          <Box flex={1}>
            <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('task.verifier')}</Text>
            <Input value={form.verifier} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { verifier: e.target.value }) }) }}
              placeholder={t('common.username')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
              _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          </Box>
        </Flex>

        <Box mb="20px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('task.reviewAt')}</Text>
          <DateTimePicker
            value={form.review_at}
            onChange={function(val) { setForm(function(p) { return Object.assign({}, p, { review_at: val }) }) }}
            placeholder={t('task.reviewAt')}
          />
        </Box>

        <Box mb="20px">
          <Flex justify="space-between" align="center" mb="8px">
            <HStack gap="6px">
              <LinkIcon size={14} color="#555" />
              <Text fontSize="13px" fontWeight="600" color="#555">{t('task.linkedIssues')}</Text>
            </HStack>
            <Button h="22px" px="8px" fontSize="11px" variant="outline" borderColor="#d1d5db" color="#666"
              onClick={function() { setShowIssuePicker(!showIssuePicker) }}>
              {showIssuePicker ? t('common.collapse') : t('common.selectIssue')}
            </Button>
          </Flex>

          {selectedIssues.length > 0 && (
            <HStack gap="6px" flexWrap="wrap" mb="8px">
              {selectedIssues.map(function(issue) {
                return (
                  <Badge key={issue.id} fontSize="11px" px="8px" py="3px" rounded="6px" bg="#eff6ff" color="#2563eb"
                    display="flex" alignItems="center" gap="4px">
                    <Text>#{issue.number}</Text>
                    <Text maxW="120px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{issue.title}</Text>
                    <Box as="span" cursor="pointer" _hover={{ color: '#dc2626' }}
                      onClick={function() { toggleIssueSelection(issue.id) }}>
                      <X size={12} />
                    </Box>
                  </Badge>
                )
              })}
            </HStack>
          )}

          {showIssuePicker && (
            <Box border="1px solid" borderColor="#e2e2e2" rounded="8px" maxH="200px" overflow="auto">
              {availableIssues.length > 0 ? availableIssues.map(function(issue) {
                var isSelected = selectedIssueIds.indexOf(issue.id) >= 0
                return (
                  <Flex key={issue.id} align="center" gap="8px" px="12px" py="8px" cursor="pointer"
                    bg={isSelected ? '#f0fdf4' : 'transparent'}
                    _hover={{ bg: isSelected ? '#f0fdf4' : '#f9fafb' }}
                    onClick={function() { toggleIssueSelection(issue.id) }}
                    borderBottom="1px solid" borderColor="#f0f0f0">
                    <Box w="14px" h="14px" rounded="3px" border="2px solid"
                      borderColor={isSelected ? '#22c55e' : '#d1d5db'}
                      bg={isSelected ? '#22c55e' : 'transparent'}
                      display="flex" alignItems="center" justifyContent="center">
                      {isSelected && <Text fontSize="9px" color="white">✓</Text>}
                    </Box>
                    <Text fontSize="12px" color="#888">#{issue.number}</Text>
                    <Text fontSize="12.5px" color="#333" flex={1} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{issue.title}</Text>
                  </Flex>
                )
              }) : (
                <Text fontSize="12px" color="#aaa" py="12px" textAlign="center">{t('common.noLinkableIssues')}</Text>
              )}
            </Box>
          )}
        </Box>

        <Flex justify="flex-end" gap="10px">
          <Button h="34px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>
            {t('common.cancel')}
          </Button>
          <Button h="34px" px="20px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>
            {t('task.createTask')}
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}

export default NewTask
