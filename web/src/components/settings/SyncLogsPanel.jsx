import { Box, Button, Flex, Spinner, Text, VStack } from '@chakra-ui/react'
import { LuCircleCheck, LuCircleX } from 'react-icons/lu'
import { t, formatDuration } from '../../i18n/index'

export default function SyncLogsPanel({ logs, onRefresh }) {
  return (
    <Box>
      <Flex align="center" justify="space-between" mb="12px">
        <Text fontSize="15px" fontWeight="600" color="#333">{t('projectSettings.syncLogs')}</Text>
        <Button size="xs" variant="ghost" color="#888" onClick={onRefresh}>
          {t('projectSettings.refresh')}
        </Button>
      </Flex>

      {logs.length === 0 ? (
        <Text fontSize="13px" color="#aaa">{t('projectSettings.noSyncLogs')}</Text>
      ) : (
        <VStack spacing="0" align="stretch">
          {logs.map((log, idx) => {
            const isSuccess = log.status === 'success'
            const isRunning = log.status === 'running'
            return (
              <Flex key={log.id || idx} align="center" justify="space-between"
                py="10px" borderBottom={idx < logs.length - 1 ? '1px solid' : 'none'}
                borderColor="#f0f0f0">
                <Flex align="center" gap="8px">
                  {isSuccess ? <LuCircleCheck size={14} color="#16a34a" />
                    : isRunning ? <Spinner size="xs" color="#3b82f6" />
                    : <LuCircleX size={14} color="#dc2626" />}
                  <Box>
                    <Text fontSize="13px" color="#333" fontWeight="500">
                      {log.sync_type === 'mirror' ? t('projectSettings.mirrorSync') : t('projectSettings.statsRefresh')}
                      {' '}{isSuccess ? t('projectSettings.success') : isRunning ? t('projectSettings.currentlyRunning') : t('projectSettings.failed')}
                    </Text>
                    {log.message && (
                      <Text fontSize="12px" color="#888">{log.message}</Text>
                    )}
                  </Box>
                </Flex>
                <Box textAlign="right">
                  <Text fontSize="12px" color="#888">{formatDuration(log.duration)}</Text>
                  {log.items_synced > 0 && (
                    <Text fontSize="12px" color="#666">{log.items_synced} items</Text>
                  )}
                </Box>
              </Flex>
            )
          })}
        </VStack>
      )}
    </Box>
  )
}
