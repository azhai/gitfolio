import { Box } from '@chakra-ui/react'

export default function SettingCard({ children, ...rest }) {
  return (
    <Box
      bg="white"
      border="1px solid"
      borderColor="#e2e2e2"
      rounded="10px"
      p="24px"
      mb="20px"
      {...rest}
    >
      {children}
    </Box>
  )
}
