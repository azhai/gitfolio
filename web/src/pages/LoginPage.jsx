import React, { useState } from 'react'
import { Box, Text, Input, Button, Flex, Link, Alert, AlertIcon, Spinner } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const LoginPage = () => {
  const navigate = useNavigate()
  const { login, register, isAuthenticated } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    navigate('/')
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

    if (mode === 'login') {
      if (!form.username.trim()) { setError('Please enter your username'); return }
      if (!form.password) { setError('Please enter your password'); return }
    } else {
      if (!form.username.trim()) { setError('Username is required'); return }
      if (!form.email.trim()) { setError('Email is required'); return }
      if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
      if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.username.trim(), form.password)
        navigate('/')
      } else {
        await register({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
        })
        setMode('login')
        setError('')
        setForm({ username: '', email: '', password: '', confirmPassword: '' })
      }
    } catch (err) {
      setError(err.message || (mode === 'login' ? 'Invalid credentials' : 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="#f5f5f5"
      px={4}
    >
      <Box w="100%" maxW="420px">
        <Box textAlign="center" mb="36px">
          <Text fontSize="32px" fontWeight="bold" color="#16a34a">🚀 GitFolio</Text>
          <Text fontSize="14px" color="#888" mt={2}>
            {isLogin ? 'Sign in to continue' : 'Create your account'}
          </Text>
        </Box>

        <Box bg="white" rounded="12px" p="28px" boxShadow="0 2px 12px rgba(0,0,0,0.06)" border="1px solid #e8e8e8">
          <Flex gap="0" mb="24px" bg="#f3f4f6" rounded="8px" p="3px">
            {['login', 'register'].map(function(m) {
              var active = mode === m
              return (
                <Button
                  key={m}
                  flex={1}
                  h="34px"
                  fontSize="13px"
                  fontWeight="600"
                  borderRadius="6px"
                  bg={active ? 'white' : 'transparent'}
                  color={active ? '#16a34a' : '#888'}
                  boxShadow={active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'}
                  _hover={{ bg: active ? 'white' : 'rgba(255,255,255,0.5)' }}
                  onClick={() => { setMode(m); setError('') }}
                >
                  {m === 'login' ? 'Sign In' : 'Register'}
                </Button>
              )
            })}
          </Flex>

          <form onSubmit={handleSubmit}>
            <Box mb="16px">
              <Text fontSize="13.5px" fontWeight="600" color="#333" mb="6px">Username</Text>
              <Input
                value={form.username}
                onChange={updateField('username')}
                placeholder="Enter username"
                h="40px" fontSize="14px"
                borderRadius="8px" borderColor="#d1d5db"
                _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }}
              />
            </Box>

            {!isLogin && (
              <Box mb="16px">
                <Text fontSize="13.5px" fontWeight="600" color="#333" mb="6px">Email</Text>
                <Input
                  type="email"
                  value={form.email}
                  onChange={updateField('email')}
                  placeholder="you@example.com"
                  h="40px" fontSize="14px"
                  borderRadius="8px" borderColor="#d1d5db"
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }}
                />
              </Box>
            )}

            <Box mb="18px">
              <Flex justify="space-between" align="center" mb="6px">
                <Text fontSize="13.5px" fontWeight="600" color="#333">Password</Text>
                {isLogin && (
                  <Link href="#" fontSize="12.5px" color="#16a34a" _hover={{ textDecoration: 'underline' }}>
                    Forgot password?
                  </Link>
                )}
              </Flex>
              <Input
                type="password"
                value={form.password}
                onChange={updateField('password')}
                placeholder={isLogin ? 'Enter password' : 'Min 6 characters'}
                h="40px" fontSize="14px"
                borderRadius="8px" borderColor="#d1d5db"
                _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }}
              />
            </Box>

            {!isLogin && (
              <Box mb="20px">
                <Text fontSize="13.5px" fontWeight="600" color="#333" mb="6px">Confirm Password</Text>
                <Input
                  type="password"
                  value={form.confirmPassword}
                  onChange={updateField('confirmPassword')}
                  placeholder="Repeat password"
                  h="40px" fontSize="14px"
                  borderRadius="8px" borderColor="#d1d5db"
                  _focus={{ borderColor: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' }}
                />
              </Box>
            )}

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
              loadingText={isLogin ? 'Signing in...' : 'Creating account...'}
              spinner={<Spinner size="sm" color="white" />}
            >
              {isLogin ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <Text textAlign="center" mt="20px" fontSize="13px" color="#888">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Link
              color="#16a34a"
              fontWeight="500"
              _hover={{ textDecoration: 'underline' }}
              cursor="pointer"
              onClick={() => { setMode(isLogin ? 'register' : 'login'); setError('') }}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </Link>
          </Text>
        </Box>
      </Box>
    </Box>
  )
}

export default LoginPage
