import { useState, useRef } from 'react'
import {
  Box,
  Button,
  Text,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react'
import { t } from '../../i18n/index'

const typeConfig = {
  mirror: { color: '#2563eb', bg: '#eff6ff', labelKey: 'project.mirror' },
  public: { color: '#16a34a', bg: '#f0fdf4', labelKey: 'project.public' },
  private: { color: '#ea580c', bg: '#fff7ed', labelKey: 'project.private' },
  local: { color: '#6b7280', bg: '#f3f4f6', labelKey: 'common.local' },
}

const allowedTransitions = {
  local: ['local'],
  mirror: ['mirror', 'public', 'private'],
  public: ['public', 'private', 'mirror'],
  private: ['private', 'public', 'mirror'],
}

function getSideEffectKey(from, to) {
  const fromCap = from[0].toUpperCase() + from.slice(1)
  const toCap = to[0].toUpperCase() + to.slice(1)
  return `projectSettings.convertSideEffect${fromCap}To${toCap}`
}

export default function ProjectTypeSelector({ currentType, onChange, disabled }) {
  const [targetType, setTargetType] = useState(null)
  const cancelRef = useRef()
  const allowed = allowedTransitions[currentType] || []

  if (currentType === 'local') {
    return (
      <Text fontSize="13px" color="#888">
        {t('projectSettings.localCannotConvert')}
      </Text>
    )
  }

  return (
    <>
      <Box display="flex" flexWrap="wrap" gap="12px">
        {allowed.map((type) => {
          const cfg = typeConfig[type]
          const isCurrent = type === currentType
          return (
            <Box
              key={type}
              border="1px solid"
              borderColor={isCurrent ? cfg.color : '#d1d5db'}
              bg={isCurrent ? cfg.bg : 'white'}
              color={isCurrent ? cfg.color : '#555'}
              rounded="8px"
              p="12px"
              minW="140px"
              opacity={disabled ? 0.6 : 1}
            >
              <Text fontSize="13px" fontWeight="600" mb="4px">
                {isCurrent ? t('projectSettings.currentType') : t(cfg.labelKey)}
              </Text>
              <Text fontSize="12px" color="#888" mb="10px">
                {t(`projectSettings.${type}ProjectDesc`)}
              </Text>
              {!isCurrent && !disabled && (
                <Button
                  size="xs"
                  variant="outline"
                  color={cfg.color}
                  borderColor={cfg.color}
                  onClick={() => setTargetType(type)}
                >
                  {t('projectSettings.convertTo', { type: t(cfg.labelKey) })}
                </Button>
              )}
            </Box>
          )
        })}
      </Box>

      <AlertDialog isOpen={!!targetType} leastDestructiveRef={cancelRef} onClose={() => setTargetType(null)}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="md" fontWeight="bold">
              {t('projectSettings.convertConfirmTitle')}
            </AlertDialogHeader>
            <AlertDialogBody>
              <Text mb="12px">
                {t('projectSettings.convertConfirmDesc', { from: t(typeConfig[currentType].labelKey), to: targetType ? t(typeConfig[targetType].labelKey) : '' })}
              </Text>
              {targetType && (
                <Text fontSize="13px" color="#666">
                  {t(getSideEffectKey(currentType, targetType))}
                </Text>
              )}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setTargetType(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                colorScheme="green"
                ml={3}
                onClick={() => {
                  onChange(targetType)
                  setTargetType(null)
                }}
              >
                {t('common.confirm')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  )
}
