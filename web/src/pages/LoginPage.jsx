import React, { useState, useEffect } from 'react'
import { Box, Text, Input, Button, Flex, Link, Alert, AlertIcon, Spinner, HStack } from '@chakra-ui/react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { statsAPI } from '../api/index'
import { LuRocket as Rocket } from 'react-icons/lu'
import { t } from '../i18n'
import LanguageSwitcher from '../components/LanguageSwitcher'

const LoginPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/home'
  const { login, isAuthenticated } = useAuth()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [siteMark, setSiteMark] = useState('')

  useEffect(function() {
    statsAPI.get().then(function(data) {
      if (data && data.site_mark) setSiteMark(data.site_mark)
    }).catch(function() {})
  }, [])

  if (isAuthenticated) {
    navigate(redirect)
    return null
  }

  function updateField(key) {
    return function(e) {
      setForm(function(prev) { var o = {}; Object.assign(o, prev); o[key] = e.target.value; return o })
      setError('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.username.trim()) { setError(t('auth.enterUsername')); return }
    if (!form.password) { setError(t('auth.enterPassword')); return }

    setLoading(true)
    try {
      await login(form.username.trim(), form.password)
      navigate(redirect)
    } catch (err) {
      setError(err.message || t('auth.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      minH="100vh"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      bg="#f5f5f5"
      px={4}
    >
      <Box w="100%" maxW="420px">
        <Box textAlign="center" mb="36px">
          <Flex justify="space-between" align="flex-end" mb={2}>
            <Link href="/" fontSize="13px" color="#888" _hover={{ color: '#16a34a' }}>
              ← {t('nav.home')}
            </Link>
            <LanguageSwitcher width="110px" height="34px" />
          </Flex>
          <HStack gap="8px" justifyContent="center">
            <Rocket size={32} color="#16a34a" />
            <Text fontSize="32px" fontWeight="bold" color="#16a34a">GitFolio</Text>
          </HStack>
          <Text fontSize="14px" color="#888" mt={2}>
            {t('auth.signInToContinue')}
          </Text>
        </Box>

        <Box bg="white" rounded="12px" p="28px" boxShadow="0 2px 12px rgba(0,0,0,0.06)" border="1px solid #e8e8e8">
          <form onSubmit={handleSubmit}>
            <Box mb="16px">
              <Text fontSize="13.5px" fontWeight="600" color="#333" mb="6px">{t('auth.username')}</Text>
              <Input
                value={form.username}
                onChange={updateField('username')}
                placeholder={t('auth.placeholderUsername')}
                h="40px" fontSize="14px"
                borderRadius="8px" borderColor="#d1d5db"
                _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }}
              />
            </Box>

            <Box mb="18px">
              <Text fontSize="13.5px" fontWeight="600" color="#333" mb="6px">{t('auth.password')}</Text>
              <Input
                type="password"
                value={form.password}
                onChange={updateField('password')}
                placeholder={t('auth.placeholderPassword')}
                h="40px" fontSize="14px"
                borderRadius="8px" borderColor="#d1d5db"
                _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }}
              />
            </Box>

            {error && (
              <Alert status="error" borderRadius="8px" mb="16px" fontSize="13px">
                <AlertIcon />
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              w="100%"
              h="40px"
              bg="#22c55e"
              color="white"
              fontSize="15px"
              fontWeight="600"
              borderRadius="8px"
              _hover={{ bg: '#16a34a' }}
              _active={{ bg: '#15803d' }}
              isLoading={loading}
              loadingText={t('auth.signingIn')}
              spinner={<Spinner size="sm" color="white" />}
            >
              {t('auth.signIn')}
            </Button>

            <Text fontSize="12.5px" color="#888" textAlign="center" mt="14px">
              {t('auth.forgotPasswordContactAdmin')}
            </Text>
          </form>
        </Box>
      </Box>
      <Box as="footer" py="16px">
        {siteMark && (
          <Text fontSize="12px" color="gray.400">
            <Link href="https://beian.miit.gov.cn/" target="_blank" rel="noopener" _hover={{ color: 'gray.600' }}>
              {siteMark}
            </Link>
          </Text>
        )}
      </Box>
    </Box>
  )
}

export default LoginPage
