import { Box, Button, Flex, HStack, Input, Switch, Text } from '@chakra-ui/react'
import { LuClock, LuRefreshCw, LuCircleX } from 'react-icons/lu'
import { t, timeAgo } from '../../i18n/index'

function secondsToHM(seconds) {
  return { hours: Math.floor((seconds || 0) / 3600), minutes: Math.floor(((seconds || 0) % 3600) / 60) }
}

function hmToSeconds(hours, minutes) {
  return (hours || 0) * 3600 + (minutes || 0) * 60
}

export default function SyncConfigPanel({ config, onChange, onSave, isSaving, disabled }) {
  if (!config) {
    return <Text fontSize="13px" color="#aaa">{t('projectSettings.loadingSyncConfig')}</Text>
  }

  const { hours, minutes } = secondsToHM(config.sync_interval)

  return (
    <Flex gap="24px" flexWrap="wrap" align="flex-start">
      <Box flex="1" minW="240px">
        <Box mb="14px">
          <Text fontSize="13px" fontWeight="500" color="#555" mb="4px">{t('projectSettings.syncInterval')}</Text>
          <HStack gap="8px">
            <Input
              type="number"
              value={hours}
              min={0}
              max={999}
              w="80px"
              h="36px"
              fontSize="14px"
              onChange={(e) => {
                const val = Math.min(999, Math.max(0, parseInt(e.target.value) || 0))
                onChange({ ...config, sync_interval: hmToSeconds(val, minutes) })
              }}
            />
            <Text fontSize="14px" color="#555">{t('common.hour')}</Text>
            <Input
              type="number"
              value={minutes}
              min={0}
              max={59}
              w="80px"
              h="36px"
              fontSize="14px"
              onChange={(e) => {
                const val = Math.min(59, Math.max(0, parseInt(e.target.value) || 0))
                onChange({ ...config, sync_interval: hmToSeconds(hours, val) })
              }}
            />
            <Text fontSize="14px" color="#555">{t('common.minute')}</Text>
          </HStack>
        </Box>

        {config.sync_interval > 0 && (
          <Flex align="center" justify="space-between" py="10px" borderBottom="1px solid" borderColor="#f0f0f0" mb="14px">
            <Box>
              <Text fontSize="13px" fontWeight="500" color="#555">{t('projectSettings.enableScheduledSync')}</Text>
              <Text fontSize="12px" color="#888">{config.is_paused ? t('projectSettings.currentlyPaused') : t('projectSettings.currentlyRunning')}</Text>
            </Box>
            <Switch colorScheme="green" isChecked={!config.is_paused}
              onChange={(e) => onChange({ ...config, is_paused: !e.target.checked })}
              isDisabled={disabled}
            />
          </Flex>
        )}

        <Button h="36px" px="20px" fontSize="14px" rounded="6px" bg="#22c55e" color="white"
          _hover={{ bg: '#16a34a' }} onClick={onSave} isLoading={isSaving} isDisabled={disabled}>
          {t('projectSettings.saveSyncConfig')}
        </Button>
      </Box>

      <Box flex="1" minW="220px" fontSize="12px" color="#888">
        <Flex align="center" gap="6px" mb="6px">
          <LuClock size={13} />
          <Text>{t('projectSettings.lastSync')}: {config.last_sync_at ? timeAgo(config.last_sync_at) : t('projectSettings.never')}</Text>
        </Flex>
        {config.sync_interval > 0 && !config.is_paused && config.next_sync_at && (
          <Flex align="center" gap="6px" mb="6px">
            <LuRefreshCw size={13} />
            <Text>{t('projectSettings.nextSync')}: {timeAgo(config.next_sync_at)}</Text>
          </Flex>
        )}
        {config.last_error && (
          <Flex align="center" gap="6px" color="#dc2626">
            <LuCircleX size={13} />
            <Text>{t('projectSettings.recentError')}: {config.last_error}</Text>
          </Flex>
        )}
      </Box>
    </Flex>
  )
}
