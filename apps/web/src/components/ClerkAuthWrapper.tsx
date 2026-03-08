import { useEffect, useState } from 'react'
import { useAuth, SignIn } from '@clerk/react'
import { setAuthTokenGetter } from '@/services/api'

export default function ClerkAuthWrapper({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded, getToken } = useAuth()
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setAuthTokenGetter(getToken)
      getToken().then(() => setAuthReady(true))
    } else if (isLoaded && !isSignedIn) {
      setAuthTokenGetter(() => Promise.resolve(null))
      setAuthReady(false)
    }
  }, [isLoaded, isSignedIn, getToken])

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Not signed in - show sign in
  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <SignIn routing="hash" />
      </div>
    )
  }

  // Waiting for token
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Authenticating...</div>
      </div>
    )
  }

  return <>{children}</>
}
