import React from 'react'
import { render, screen } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import theme from '../theme'
import ConflictBanner from '../components/gitworkflow/conflict_banner'
import { GitWorkflowProvider } from '../contexts/GitWorkflowContext'

function wrapper(_ref) {
  var children = _ref.children
  return (
    <ChakraProvider theme={theme}>
      <GitWorkflowProvider owner="test" repo="repo">
        {children}
      </GitWorkflowProvider>
    </ChakraProvider>
  )
}

describe('ConflictBanner', () => {
  it('renders nothing when no conflict', () => {
    var result = render(<ConflictBanner />, { wrapper })
    expect(result.container.querySelector('div')).toBeNull()
  })
})