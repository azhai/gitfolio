import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingTabs from './SettingTabs'

describe('SettingTabs', () => {
  it('renders tabs and calls onChange', () => {
    const onChange = vi.fn()
    render(
      <SettingTabs
        tabs={[
          { key: 'general', label: 'General' },
          { key: 'sync', label: 'Remote & Sync' },
        ]}
        active="general"
        onChange={onChange}
      />
    )
    expect(screen.getByText('General')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Remote & Sync'))
    expect(onChange).toHaveBeenCalledWith('sync')
  })
})
