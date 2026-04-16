import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { TranslationBubble, type ChatMessage } from './TranslationBubble'

const message: ChatMessage = {
  id: 'm1',
  senderDisplayName: 'Guest User',
  original: '안녕하세요',
  translated: 'Hello',
  translationState: 'ready',
  src: 'ko',
  dst: 'en',
}

describe('TranslationBubble', () => {
  it('shows only the translated text by default', () => {
    render(<TranslationBubble message={message} />)

    expect(screen.getByText('Guest User')).toBeTruthy()
    expect(screen.getByText('Hello')).toBeTruthy()
    expect(screen.queryByText('안녕하세요')).toBeNull()
    expect(screen.getByText(/translation ready/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /view original/i })).toBeTruthy()
    expect(screen.queryByText(/showing the translated message for this room/i)).toBeNull()
  })

  it('reveals the original text when toggled', async () => {
    const user = userEvent.setup()

    render(<TranslationBubble message={message} />)

    await user.click(screen.getByRole('button', { name: /view original/i }))

    expect(screen.getByText('안녕하세요')).toBeTruthy()
    expect(screen.getByRole('button', { name: /hide original/i })).toBeTruthy()
  })

  it('shows a fallback explanation when translation is unavailable', () => {
    render(
      <TranslationBubble
        message={{
          ...message,
          translated: '안녕하세요',
          translationState: 'fallback',
        }}
      />,
    )

    expect(screen.getByText(/showing the original message/i)).toBeTruthy()
    expect(screen.getByText(/translation was unavailable/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /view original/i })).toBeNull()
  })

  it('uses a spinner-style status while translation is still streaming', () => {
    render(
      <TranslationBubble
        message={{
          ...message,
          translated: '',
          translationState: 'streaming',
        }}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/translation in progress/i)
    expect(screen.queryByTestId('translation-primary-text')).toBeNull()
  })
})
