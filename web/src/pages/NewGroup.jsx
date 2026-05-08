import React, { useState } from 'react'
import { Box, Text, Input, Textarea, Button, Flex, useToast } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { groupsAPI } from '../api/index'
import { t } from '../i18n/index'

const NewGroup = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    display_name: '',
    description: '',
    website: '',
    location: '',
  })

  function updateField(key) {
    return function(e) {
      setForm(function(prev) { return Object.assign({}, prev, { [key]: e.target.value }) })
    }
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: t('group.groupNameRequired'), status: 'error', duration: 3000 })
      return
    }
    setSubmitting(true)
    groupsAPI.create(form).then(function(data) {
      navigate('/groups/' + data.name)
    }).catch(function(err) {
      toast({ title: err.message || t('group.createFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setSubmitting(false) })
  }

  return (
    <Box maxW="720px">
      <Text fontSize="22px" fontWeight="700" color="#333" mb="24px">{t('group.newGroup')}</Text>

      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="28px">
        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('group.groupName')} *</Text>
          <Input value={form.name} onChange={updateField('name')}
            placeholder={t('group.groupNamePlaceholder')} h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('group.displayName')}</Text>
          <Input value={form.display_name} onChange={updateField('display_name')}
            placeholder={t('group.displayNamePlaceholder')} h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('group.description')}</Text>
          <Textarea value={form.description} onChange={updateField('description')}
            placeholder={t('group.descriptionPlaceholder')} fontSize="14px" borderRadius="8px" borderColor="#d1d5db" rows={3}
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="18px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('group.website')}</Text>
          <Input value={form.website} onChange={updateField('website')}
            placeholder="https://example.com" h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Box mb="24px">
          <Text fontSize="13.5px" fontWeight="600" color="#555" mb="6px">{t('group.location')}</Text>
          <Input value={form.location} onChange={updateField('location')}
            placeholder={t('group.locationPlaceholder')} h="40px" fontSize="14px" borderRadius="8px" borderColor="#d1d5db"
            _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }} />
        </Box>

        <Flex justify="flex-end" gap="10px">
          <Button h="36px" px="16px" fontSize="13px" rounded="6px" variant="outline"
            borderColor="#d1d5db" color="#666" onClick={function() { navigate(-1) }}>
            {t('common.cancel')}
          </Button>
          <Button h="36px" px="24px" fontSize="14px" rounded="6px" bg="#22c55e" color="white"
            _hover={{ bg: '#16a34a' }} onClick={handleSubmit} isLoading={submitting}>
            {t('group.createGroup')}
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}

export default NewGroup
