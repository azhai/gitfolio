import { Box, Button, Flex, Spinner, Text } from '@chakra-ui/react'

export default function GitActionCard({
  title,
  description,
  statusText,
  isLoading,
  buttonText,
  buttonVariant = 'solid',
  buttonColor = '#22c55e',
  disabled,
  onClick,
}) {
  return (
    <Box
      border="1px solid"
      borderColor="#e2e2e2"
      rounded="8px"
      p="16px"
      flex="1"
      minW="220px"
    >
      <Text fontSize="14px" fontWeight="600" color="#333" mb="4px">
        {title}
      </Text>
      <Text fontSize="12px" color="#888" mb="12px" minH="36px">
        {description}
      </Text>
      {statusText && (
        <Flex align="center" gap="6px" mb="12px" fontSize="12px" color="#666">
          {isLoading && <Spinner size="xs" color="#3b82f6" />}
          <Text>{statusText}</Text>
        </Flex>
      )}
      <Button
        size="sm"
        variant={buttonVariant}
        bg={buttonVariant === 'solid' ? buttonColor : 'white'}
        color={buttonVariant === 'solid' ? 'white' : buttonColor}
        borderColor={buttonColor}
        isLoading={isLoading}
        isDisabled={disabled}
        onClick={onClick}
      >
        {buttonText}
      </Button>
    </Box>
  )
}
