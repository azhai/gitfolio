import React from 'react'
import { render, screen } from '@testing-library/react'
import { Icon, IconMap, FileIcons, StatusIcons, NavIcons, ProjectTabIcons } from '../components/Icons'

describe('Icon', () => {
  it('renders known icon by name', () => {
    render(<Icon name="home" />)
    // Icon renders an SVG element
    var svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('returns null for unknown icon name', () => {
    var result = render(<Icon name="nonexistent_icon" />)
    expect(result.container.querySelector('svg')).toBeNull()
  })

  it('applies custom size and color', () => {
    render(<Icon name="star" size={24} color="red" />)
    var svg = document.querySelector('svg')
    expect(svg).toHaveAttribute('width', '24')
    expect(svg).toHaveAttribute('height', '24')
    expect(svg).toHaveAttribute('color', 'red')
  })
})

describe('IconMap', () => {
  it('contains essential icons', () => {
    var essentialKeys = ['home', 'users', 'activity', 'code', 'folder', 'issue', 'pr', 'commit', 'task', 'settings', 'branch', 'tag', 'star', 'search']
    essentialKeys.forEach(function(key) {
      expect(IconMap[key]).toBeDefined()
    })
  })

  it('all values are valid React components', () => {
    Object.entries(IconMap).forEach(function(entry) {
      var key = entry[0]
      var Comp = entry[1]
      expect(typeof Comp).toBe('function')
    })
  })
})

describe('FileIcons', () => {
  it('has directory entry as first item', () => {
    expect(FileIcons[0].isDir).toBe(true)
    expect(FileIcons[0].name).toBe('folder')
  })

  it('covers common file extensions', () => {
    var extensions = ['.go', '.js', '.py', '.html', '.css', '.md', '.json', '.yaml']
    extensions.forEach(function(ext) {
      var found = FileIcons.some(function(fi) {
        return fi.exts.includes(ext)
      })
      expect(found).toBe(true)
    })
  })
})

describe('StatusIcons', () => {
  it('has icon and color for each status', () => {
    var statuses = ['open', 'closed', 'draft', 'progress', 'review', 'completed', 'public', 'private']
    statuses.forEach(function(status) {
      expect(StatusIcons[status]).toBeDefined()
      expect(StatusIcons[status].icon).toBeDefined()
      expect(StatusIcons[status].color).toBeDefined()
    })
  })
})

describe('NavIcons', () => {
  it('has all navigation icons', () => {
    expect(Object.keys(NavIcons)).toContain('home')
    expect(Object.keys(NavIcons)).toContain('project')
    expect(Object.keys(NavIcons)).toContain('group')
  })
})

describe('ProjectTabIcons', () => {
  it('has all project tab icons', () => {
    expect(Object.keys(ProjectTabIcons)).toContain('code')
    expect(Object.keys(ProjectTabIcons)).toContain('issues')
    expect(Object.keys(ProjectTabIcons)).toContain('pull_requests')
  })
})
