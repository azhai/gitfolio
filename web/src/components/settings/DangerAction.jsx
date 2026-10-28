import { Box, Button, Flex, Text } from '@chakra-ui/react'

export default function DangerAction({ title, description, buttonText, buttonColor = '#dc2626', disabled, onClick }) {
  return (
    <Flex align="center" justify="space-between" py="16px" borderBottom="1px solid" borderColor="#f0f0f0">
      <Box>
        <Text fontSize="14px" fontWeight="500" color="#333">{title}</Text>
        <Text fontSize="12px" color="#888">{description}</Text>
      </Box>
      <Button
        size="sm"
        variant="outline"
        color={buttonColor}
        borderColor={buttonColor}
        isDisabled={disabled}
        onClick={onClick}
      >
        {buttonText}
      </Button>
    </Flex>
  )
}
