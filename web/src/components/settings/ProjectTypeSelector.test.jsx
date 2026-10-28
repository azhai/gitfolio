import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ProjectTypeSelector from './ProjectTypeSelector'

describe('ProjectTypeSelector', () => {
  it('disables conversion for local project', () => {
    render(<ProjectTypeSelector currentType="local" onChange={vi.fn()} />)
    expect(screen.getByText('本地项目不能转换为其他类型。')).toBeInTheDocument()
  })

  it('shows convert button for mirror project', () => {
    render(<ProjectTypeSelector currentType="mirror" onChange={vi.fn()} />)
    expect(screen.getByText('转换为 公开')).toBeInTheDocument()
  })

  it('opens confirm dialog when clicking convert', () => {
    render(<ProjectTypeSelector currentType="mirror" onChange={vi.fn()} />)
    fireEvent.click(screen.getByText('转换为 公开'))
    expect(screen.getByText('转换项目类型')).toBeInTheDocument()
  })
})
