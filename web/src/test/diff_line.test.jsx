import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import DiffLine from '../components/gitworkflow/diff_line'

describe('DiffLine', () => {
  it('renders context line with line numbers', () => {
    var line = { type: 'context', content: 'hello world', old_line_no: 1, new_line_no: 1 }
    render(<DiffLine line={line} index={0} selectable={false} />)
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('renders added line with green background', () => {
    var line = { type: 'added', content: 'new line', old_line_no: -1, new_line_no: 5 }
    render(<DiffLine line={line} index={0} selectable={false} />)
    expect(screen.getByText('new line')).toBeInTheDocument()
  })

  it('renders deleted line with red background', () => {
    var line = { type: 'deleted', content: 'old line', old_line_no: 3, new_line_no: -1 }
    render(<DiffLine line={line} index={0} selectable={false} />)
    expect(screen.getByText('old line')).toBeInTheDocument()
  })

  it('renders hunk header', () => {
    var line = { type: 'hunk', content: '@@ -1,3 +1,4 @@', old_line_no: -1, new_line_no: -1 }
    render(<DiffLine line={line} index={0} selectable={false} />)
    expect(screen.getByText('@@ -1,3 +1,4 @@')).toBeInTheDocument()
  })

  it('shows checkbox when selectable and line is changed', () => {
    var line = { type: 'added', content: 'new line', old_line_no: -1, new_line_no: 1 }
    var onToggle = vi.fn()
    render(<DiffLine line={line} index={0} selectable={true} selected={false} onToggle={onToggle} />)
    var checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeInTheDocument()
    fireEvent.click(checkbox)
    expect(onToggle).toHaveBeenCalledWith(0)
  })

  it('hides checkbox when not selectable', () => {
    var line = { type: 'added', content: 'new line', old_line_no: -1, new_line_no: 1 }
    render(<DiffLine line={line} index={0} selectable={false} />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})