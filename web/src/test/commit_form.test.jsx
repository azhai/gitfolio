import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import theme from '../theme'
import CommitForm from '../components/gitworkflow/commit_form'
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

vi.mock('../api/index', () => ({
  reposAPI: {
    commitChanges: vi.fn().mockResolvedValue({ commit_hash: 'abc1234' }),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isGuest: false }),
}))

describe('CommitForm', () => {
  it('renders commit button', () => {
    render(<CommitForm />, { wrapper })
    expect(screen.getByText('提交')).toBeInTheDocument()
  })

  it('disables commit when message is empty', () => {
    render(<CommitForm />, { wrapper })
    var btn = screen.getByText('提交')
    expect(btn).toBeDisabled()
  })
})