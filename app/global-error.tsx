'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global application error:', error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <CardTitle>Application Error</CardTitle>
              </div>
              <CardDescription>
                A critical error occurred. Please refresh the page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.env.NODE_ENV === 'development' && (
                <div className="p-4 bg-muted rounded-md">
                  <p className="text-sm font-mono text-destructive">
                    {error.message}
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={reset} className="flex-1">
                  Try again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = '/')}
                  className="flex-1"
                >
                  Go home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  )
}

