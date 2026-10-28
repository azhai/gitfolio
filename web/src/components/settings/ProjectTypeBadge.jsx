import { Box, Tooltip } from '@chakra-ui/react'
import { LuRefreshCw, LuGlobe, LuLock, LuHardDrive } from 'react-icons/lu'
import { t } from '../../i18n/index'

const config = {
  mirror: { color: '#2563eb', bg: '#eff6ff', icon: LuRefreshCw, tooltip: 'project.mirrorTooltip' },
  public: { color: '#16a34a', bg: '#f0fdf4', icon: LuGlobe, tooltip: 'project.publicTooltip' },
  private: { color: '#ea580c', bg: '#fff7ed', icon: LuLock, tooltip: 'project.privateTooltip' },
  local: { color: '#6b7280', bg: '#f3f4f6', icon: LuHardDrive, tooltip: 'project.localTooltip' },
}

export default function ProjectTypeBadge({ type, onClick }) {
  const c = config[type] || config.local
  const Icon = c.icon
  return (
    <Tooltip label={t(c.tooltip)} hasArrow>
      <Box
        as={onClick ? 'button' : 'span'}
        display="inline-flex"
        alignItems="center"
        gap="5px"
        px="10px"
        py="4px"
        rounded="12px"
        fontSize="12px"
        fontWeight="600"
        color={c.color}
        bg={c.bg}
        cursor={onClick ? 'pointer' : 'default'}
        onClick={onClick}
      >
        <Icon size={12} />
        {t(`projectType.${type}`) || type}
      </Box>
    </Tooltip>
  )
}
