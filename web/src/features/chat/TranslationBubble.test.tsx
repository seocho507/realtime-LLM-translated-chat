import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { TranslationBubble, type ChatMessage } from './TranslationBubble'

const message: ChatMessage = {
  id: 'm1',
  senderDisplayName: 'Guest User',
  original: '안녕하세요',
  translated: 'Hello',
  status: 'translated',
  src: 'ko',
  dst: 'en',
}

describe('TranslationBubble', () => {
  it('shows only the translated text by default', () => {
    render(<TranslationBubble message={message} />)

    expect(screen.getByText('Guest User')).toBeTruthy()
    expect(screen.getByText('Hello')).toBeTruthy()
    expect(screen.queryByText('안녕하세요')).toBeNull()
    expect(screen.getByRole('button', { name: /show original/i })).toBeTruthy()
  })

  it('reveals the original text when toggled', async () => {
    const user = userEvent.setup()

    render(<TranslationBubble message={message} />)

    await user.click(screen.getByRole('button', { name: /show original/i }))

    expect(screen.getByText('안녕하세요')).toBeTruthy()
    expect(screen.getByRole('button', { name: /hide original/i })).toBeTruthy()
  })
})
