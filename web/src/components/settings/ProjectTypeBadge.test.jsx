import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProjectTypeBadge from './ProjectTypeBadge'

describe('ProjectTypeBadge', () => {
  it('renders mirror badge', () => {
    render(<ProjectTypeBadge type="mirror" />)
    expect(screen.getByText('镜像')).toBeInTheDocument()
  })

  it('renders local badge', () => {
    render(<ProjectTypeBadge type="local" />)
    expect(screen.getByText('本地')).toBeInTheDocument()
  })
})
