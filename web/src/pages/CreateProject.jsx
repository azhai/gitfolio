import React, { useState } from 'react'
import { Box, Text, Input, Textarea, Button, Flex, Switch, useToast, Spinner, HStack } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { reposAPI } from '../api/index'
import { t } from '../i18n/index'
import { LuHardDrive as HardDrive } from 'react-icons/lu'

const CreateProject = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    homepage: '',
    project_type: 'local',
    default_branch: 'main',
    init_readme: true,
  })

  function updateField(key) {
    return function(e) {
      var val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm(function(prev) { return Object.assign({}, prev, { [key]: val }) })
    }
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: t('createProject.nameRequired'), status: 'error', duration: 3000 })
      return
    }
    setSubmitting(true)
    reposAPI.create(form).then(function(data) {
      navigate('/' + (data.owner || 'ryan') + '/' + data.name)
    }).catch(function(err) {
      toast({ title: err.message || t('createProject.createFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  return (
    <Box maxW="720px" mx="auto">
      <Text fontSize="22px" fontWeight="700" color="#333" mb="24px">{t('createProject.title')}</Text>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="28px">
        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('createProject.projectName')} *</Text>
          <Input value={form.name} onChange={updateField('name')}
            placeholder="my-project" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
          <Text fontSize="12px" color="#999" mt="4px">{t('createProject.nameHint')}</Text>
        </Box>

        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('createProject.description')}</Text>
          <Textarea value={form.description} onChange={updateField('description')}
            placeholder={t('createProject.descriptionOptional')} fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={3}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('createProject.homepage')}</Text>
          <Input value={form.homepage} onChange={updateField('homepage')}
            placeholder="https://example.com" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('createProject.defaultBranch')}</Text>
          <Input value={form.default_branch} onChange={updateField('default_branch')}
            placeholder="main" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="24px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="12px">{t('createProject.projectType')}</Text>
          <Flex
            flex={1} direction="column" align="center" p="16px"
            border="2px solid" borderColor="#22c55e"
            rounded="10px" bg="#f0fdf4"
          >
            <HardDrive size={22} color="#16a34a" mb="6px" />
            <Text fontSize="13px" fontWeight="600" color="#16a34a">{t('createProject.localProject')}</Text>
            <Text fontSize="11px" color="#888" mt="4px" textAlign="center">{t('createProject.localProjectDesc')}</Text>
          </Flex>
        </Box>

        <Flex align="center" justify="space-between" mb="24px" py="10px" borderBottom="1px solid" borderColor="#f0f0f0">
          <Box>
            <Text fontSize="13.5px" fontWeight="500" color="#555">{t('createProject.initReadme')}</Text>
            <Text fontSize="12px" color="#888">{t('createProject.initReadmeDesc')}</Text>
          </Box>
          <Switch colorScheme="green" isChecked={form.init_readme} onChange={updateField('init_readme')} />
        </Flex>

        <Flex justify="flex-end" gap="10px">
          <Button h="36px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>
            {t('common.cancel')}
          </Button>
          <Button h="36px" px="24px" fontSize="14px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>
            {t('createProject.createProject')}
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}

export default CreateProject
