'use client'

import { useState } from 'react'
import { ClipboardIcon, CheckIcon } from 'lucide-react'

// Duration (ms) before the copied state resets back to idle
const COPY_RESET_DELAY_MS = 2000

interface CopyButtonProps {
  /** The text content to write to the clipboard */
  text: string
  /** Optional visible label shown beside the icon (e.g. "Copy") */
  label?: string
  /** Additional Tailwind classes forwarded to the outer <button> */
  className?: string
  /** Icon size in pixels (default 14) */
  iconSize?: number
}

/**
 * A minimal, accessible copy-to-clipboard button.
 *
 * On copy success:
 *  1. Icon swaps clipboard → checkmark with a scale-in transition (150ms ease-out)
 *  2. aria-live region announces "Copied to clipboard" to screen readers
 *  3. After COPY_RESET_DELAY_MS the icon reverts automatically
 *
 * Uses only existing design tokens (primary, muted-foreground) and lucide-react
 * icons — no new color or font dependencies.
 */
export function CopyButton({ text, label, className = '', iconSize = 14 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (copied) return

    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback for environments where clipboard API is unavailable
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    setCopied(true)
    setTimeout(() => setCopied(false), COPY_RESET_DELAY_MS)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded ${className}`}
      aria-label={copied ? 'Copied to clipboard' : label ? `Copy ${label}` : 'Copy to clipboard'}
    >
      {/* Icon swap: clipboard ↔ checkmark */}
      <span className="relative flex items-center justify-center" style={{ width: iconSize, height: iconSize }}>
        <ClipboardIcon
          size={iconSize}
          className={`absolute transition-all duration-150 ease-out ${
            copied ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
          }`}
          aria-hidden
        />
        <CheckIcon
          size={iconSize}
          className={`absolute transition-all duration-150 ease-out text-primary ${
            copied ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          }`}
          aria-hidden
        />
      </span>

      {/* Optional text label: swaps between idle and "Copied!" */}
      {label !== undefined && (
        <span className={`text-xs transition-colors duration-150 ${copied ? 'text-primary' : ''}`}>
          {copied ? 'Copied!' : label}
        </span>
      )}

      {/* Screen-reader live announcement — invisible, always rendered */}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </button>
  )
}
