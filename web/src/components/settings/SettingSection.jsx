import { Box, Text } from '@chakra-ui/react'

export default function SettingSection({ title, description, children }) {
  return (
    <Box mb="24px">
      <Text fontSize="15px" fontWeight="600" color="#333" mb={description ? '4px' : '16px'}>
        {title}
      </Text>
      {description && (
        <Text fontSize="13px" color="#666" mb="16px">
          {description}
        </Text>
      )}
      {children}
    </Box>
  )
}
