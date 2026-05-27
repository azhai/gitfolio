import React, { useState, useEffect, useRef } from 'react'
import { Box, Text, Flex, Button, Spinner, useToast } from '@chakra-ui/react'
import { useNavigate, useParams } from 'react-router-dom'
import { reposAPI } from '../api/index'
import { t } from '../i18n/index'

const MigrateProgress = ({ repoInfo, onStatusChange }) => {
  const { owner, repo } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [retrying, setRetrying] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const timerRef = useRef(null)

  useEffect(function() {
    if (!repoInfo) return
    var status = repoInfo.migrate_status
    if (status === 'completed' || status === 'failed') {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (status === 'completed') {
        toast({ title: t('migrateProject.cloneSuccess'), status: 'success', duration: 3000 })
      }
      return
    }
    if (timerRef.current) return
    timerRef.current = setInterval(function() {
      reposAPI.get(owner, repo).then(function(info) {
        if (onStatusChange) onStatusChange(info)
      }).catch(function() {})
    }, 3000)
    return function() {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [owner, repo, repoInfo, onStatusChange, toast])

  function handleRetry() {
    setRetrying(true)
    reposAPI.retryMigrate(owner, repo).then(function() {
      if (onStatusChange) {
        onStatusChange(Object.assign({}, repoInfo, { migrate_status: 'cloning', migrate_error: '' }))
      }
      toast({ title: t('migrateProject.retryStarted'), status: 'info', duration: 2000 })
    }).catch(function(err) {
      toast({ title: err.message || t('migrateProject.retryFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setRetrying(false) })
  }

  function handleCancel() {
    setCancelling(true)
    reposAPI.del(owner, repo).then(function() {
      toast({ title: t('migrateProject.cancelled'), status: 'info', duration: 2000 })
      navigate('/projects', { replace: true })
    }).catch(function(err) {
      toast({ title: err.message || t('migrateProject.cancelFailed'), status: 'error', duration: 3000 })
    }).finally(function() { setCancelling(false) })
  }

  var info = repoInfo || {}
  var isCloning = info.migrate_status === 'cloning'
  var isFailed = info.migrate_status === 'failed'
  var isCompleted = info.migrate_status === 'completed'

  return (
    <Box maxW="640px" mx="auto" pt="80px">
      <Box bg="white" border="1px solid" borderColor="#e2e2e2" rounded="12px" p="40px" textAlign="center">
        {(isCloning || (!isFailed && !isCompleted)) && (
          <>
            <Spinner size="xl" color="#2563eb" mb="20px" />
            <Text fontSize="20px" fontWeight="700" color="#1e40af" mb="8px">
              {t('migrateProject.cloning')}
            </Text>
            <Text fontSize="14px" color="#6b7280" mb="6px">
              {t('migrateProject.cloningHint')}
            </Text>
            <Text fontSize="13px" color="#9ca3af" mb="28px">
              {info.mirror_url}
            </Text>
            <Flex justify="center" gap="12px">
              <Button h="36px" px="20px" fontSize="13px" rounded="6px"
                variant="outline" borderColor="#d1d5db" color="#666"
                _hover={{ borderColor: '#ef4444', color: '#ef4444' }}
                onClick={handleCancel} isLoading={cancelling}>
                {t('migrateProject.cancel')}
              </Button>
            </Flex>
          </>
        )}

        {isFailed && (
          <>
            <Text fontSize="36px" mb="12px">⚠️</Text>
            <Text fontSize="20px" fontWeight="700" color="#dc2626" mb="8px">
              {t('migrateProject.cloneFailed')}
            </Text>
            {info.migrate_error && (
              <Box bg="#fef2f2" border="1px solid #fecaca" rounded="6px" p="12px" mb="16px" textAlign="left">
                <Text fontSize="12px" color="#991b1b" fontFamily="monospace" whiteSpace="pre-wrap" wordBreak="break-all">
                  {info.migrate_error}
                </Text>
              </Box>
            )}
            <Text fontSize="13px" color="#9ca3af" mb="28px">
              {info.mirror_url}
            </Text>
            <Flex justify="center" gap="12px">
              <Button h="36px" px="20px" fontSize="13px" rounded="6px"
                variant="outline" borderColor="#d1d5db" color="#666"
                _hover={{ borderColor: '#ef4444', color: '#ef4444' }}
                onClick={handleCancel} isLoading={cancelling}>
                {t('migrateProject.cancel')}
              </Button>
              <Button h="36px" px="24px" fontSize="13px" rounded="6px"
                bg="#22c55e" color="white" _hover={{ bg: '#16a34a' }}
                onClick={handleRetry} isLoading={retrying}>
                {t('migrateProject.retry')}
              </Button>
            </Flex>
          </>
        )}
      </Box>
    </Box>
  )
}

export default MigrateProgress
