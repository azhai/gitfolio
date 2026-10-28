import { Box } from '@chakra-ui/react'

export default function SettingTabs({ tabs, active, onChange }) {
  return (
    <Box
      display="flex"
      gap="24px"
      borderBottom="1px solid"
      borderColor="#e2e2e2"
      mb="24px"
      px="4px"
    >
      {tabs.map((tab) => {
        const isActive = active === tab.key
        return (
          <Box
            key={tab.key}
            as="button"
            pb="10px"
            fontSize="14px"
            fontWeight={isActive ? '600' : '500'}
            color={isActive ? '#22c55e' : '#666'}
            borderBottom={isActive ? '2px solid #22c55e' : '2px solid transparent'}
            mb="-1px"
            cursor="pointer"
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </Box>
        )
      })}
    </Box>
  )
}
