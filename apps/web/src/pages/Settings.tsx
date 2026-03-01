import { useState, useEffect } from 'react'

export function SettingsPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    }
    return 'light'
  })

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (saved) {
      setTheme(saved)
    }
  }, [])

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      {/* Theme Section */}
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-3">Appearance</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
              theme === 'light'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-muted-foreground'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
            Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
              theme === 'dark'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-muted-foreground'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
            Dark
          </button>
        </div>
      </div>

      {/* Placeholder for other settings */}
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-3">Preferences</h2>
        <p className="text-muted-foreground text-sm">
          Risk tolerance, tax bracket, investment horizon, and scoring preferences coming soon.
        </p>
      </div>
    </div>
  )
}
