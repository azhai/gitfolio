import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Flex,
  HStack,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react'
import { LuDatabase, LuDatabaseBackup, LuRotateCcw } from 'react-icons/lu'
import { backupsAPI } from '../../api/index'
import { t } from '../../i18n/index'

export default function BackupPanel({ prefix = 'admin' }) {
  const toast = useToast()
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(null)
  const [restoring, setRestoring] = useState(null)

  const label = (key) => t(`${prefix}.${key}`) || t(`projectSettings.${key}`)

  const fetchBackups = async () => {
    setLoading(true)
    try {
      const res = await backupsAPI.list()
      const list = res.backups || []
      list.sort((a, b) => {
        const ta = a.completed_at ? new Date(a.completed_at).getTime() : 0
        const tb = b.completed_at ? new Date(b.completed_at).getTime() : 0
        return tb - ta
      })
      setBackups(list)
    } catch (err) {
      toast({ title: String(err), status: 'error', duration: 3000 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBackups()
  }, [])

  const handleCreate = async (type) => {
    setCreating(type)
    try {
      await backupsAPI.create(type)
      toast({ title: label('backupCreated'), status: 'success', duration: 3000 })
      await fetchBackups()
    } catch (err) {
      toast({ title: String(err), status: 'error', duration: 3000 })
    } finally {
      setCreating(null)
    }
  }

  const handleRestore = async (id) => {
    setRestoring(id)
    try {
      await backupsAPI.restore(id)
      toast({ title: label('backupRestored'), status: 'success', duration: 3000 })
    } catch (err) {
      toast({ title: String(err), status: 'error', duration: 3000 })
    } finally {
      setRestoring(null)
    }
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb="16px" bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="12px 16px">
        <Text fontSize="15px" fontWeight="600" color="#333">{label('dataBackup')}</Text>
        <HStack gap="10px">
          <Button
            leftIcon={<LuDatabase />}
            size="sm"
            bg="#22c55e"
            color="white"
            _hover={{ bg: '#16a34a' }}
            onClick={() => handleCreate('full')}
            isLoading={creating === 'full'}
          >
            {label('fullBackup')}
          </Button>
          <Button
            leftIcon={<LuDatabaseBackup />}
            size="sm"
            variant="outline"
            borderColor="#22c55e"
            color="#22c55e"
            _hover={{ bg: 'rgba(34,197,94,0.1)' }}
            onClick={() => handleCreate('incremental')}
            isLoading={creating === 'incremental'}
          >
            {label('incrementalBackup')}
          </Button>
        </HStack>
      </Flex>

      {loading && <Spinner size="sm" color="#22c55e" />}

      {!loading && backups.length === 0 && (
        <Text fontSize="13px" color="#888">{label('noBackups')}</Text>
      )}

      {!loading && backups.length > 0 && (
        <Box overflowX="auto" bg="white" border="1px solid" borderColor="#e2e2e2" rounded="10px" p="12px 16px">
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th>{label('backupName')}</Th>
                <Th>{label('backupType')}</Th>
                <Th>{label('backupStatus')}</Th>
                <Th>{label('backupSize')}</Th>
                <Th>{label('backupTime')}</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {backups.map((b) => (
                <Tr key={b.id}>
                  <Td fontSize="13px">{b.name}</Td>
                  <Td fontSize="13px">{b.backup_type}</Td>
                  <Td fontSize="13px">{b.status}</Td>
                  <Td fontSize="13px">{formatBytes(b.size)}</Td>
                  <Td fontSize="13px">{b.completed_at ? new Date(b.completed_at).toLocaleString() : '-'}</Td>
                  <Td>
                    <HStack>
                      <Button
                        leftIcon={<LuRotateCcw />}
                        size="xs"
                        variant="outline"
                        onClick={() => handleRestore(b.id)}
                        isLoading={restoring === b.id}
                        isDisabled={b.status !== 'success'}
                      >
                        {label('restore')}
                      </Button>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}
