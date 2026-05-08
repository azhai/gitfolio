import React, { useState, useEffect } from 'react'
import { Box, Text, Input, Textarea, Button, Flex, Select, useToast, HStack } from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
import { prsAPI, reposAPI } from '../../api/index'
import { t } from '../../i18n/index'
import { LuGitPullRequest as GitPullRequest } from 'react-icons/lu'

const NewPR = () => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ title: '', body: '', source_branch: '', target_branch: '', assignee: '' })
  const [branches, setBranches] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    reposAPI.branches(owner, repo).then(function(data) {
      var list = Array.isArray(data && data.branches ? data.branches : data) ? (data.branches || data) : []
      setBranches(list.map(function(b) { return typeof b === 'string' ? b : (b.name || '') }))
    }).catch(function() { setBranches([]) })
  }, [owner, repo])

  useEffect(() => {
    if (branches.length > 0 && !form.target_branch) {
      var defaultBranch = branches.find(function(b) { return b === 'main' || b === 'master' }) || branches[0]
      setForm(function(prev) { return Object.assign({}, prev, { target_branch: defaultBranch }) })
    }
  }, [branches])

  function handleSubmit() {
    if (!form.title.trim()) {
      toast({ title: t('newPR.titleRequired'), status: 'error', duration: 3000 })
      return
    }
    if (!form.source_branch) {
      toast({ title: t('newPR.sourceRequired'), status: 'error', duration: 3000 })
      return
    }
    if (!form.target_branch) {
      toast({ title: t('newPR.targetRequired'), status: 'error', duration: 3000 })
      return
    }
    setSubmitting(true)
    prsAPI.create(owner, repo, form).then(function(data) {
      navigate('/' + owner + '/' + repo + '/pull_requests/' + data.number)
    }).catch(function(err) {
      toast({ title: err.message || t('newPR.createFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  return (
    <Box>
      <HStack gap="8px" mb="20px">
        <GitPullRequest size={18} color="#333" />
        <Text fontSize="18px" fontWeight="700" color="#333">{t('pr.newPR')}</Text>
      </HStack>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="24px">
        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('pr.title')}</Text>
          <Input value={form.title} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { title: e.target.value }) }) }}
            placeholder={t('newPR.titlePlaceholder')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="16px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('pr.description')}</Text>
          <Textarea value={form.body} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { body: e.target.value }) }) }}
            placeholder={t('newPR.descriptionPlaceholder')} fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={6}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Flex gap="16px" mb="16px">
          <Box flex={1}>
            <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('pr.sourceBranch')}</Text>
            <Select value={form.source_branch} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { source_branch: e.target.value }) }) }}
              h="38px" fontSize="14px" borderColor="#d1d5db" borderRadius="8px"
              placeholder={t('newPR.selectSource')}>
              {branches.map(function(b) {
                return <option key={b} value={b}>{b}</option>
              })}
            </Select>
          </Box>
          <Box flex={1}>
            <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('pr.targetBranch')}</Text>
            <Select value={form.target_branch} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { target_branch: e.target.value }) }) }}
              h="38px" fontSize="14px" borderColor="#d1d5db" borderRadius="8px"
              placeholder={t('newPR.selectTarget')}>
              {branches.map(function(b) {
                return <option key={b} value={b}>{b}</option>
              })}
            </Select>
          </Box>
        </Flex>

        <Box mb="20px">
          <Text fontSize="13px" fontWeight="600" color="#555" mb="6px">{t('pr.assignee')}</Text>
          <Input value={form.assignee} onChange={function(e) { setForm(function(p) { return Object.assign({}, p, { assignee: e.target.value }) }) }}
            placeholder={t('newPR.assigneePlaceholder')} h="38px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Flex justify="flex-end" gap="10px">
          <Button h="34px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>
            {t('common.cancel')}
          </Button>
          <Button h="34px" px="20px" fontSize="13px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>
            {t('pr.newPR')}
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}

export default NewPR
