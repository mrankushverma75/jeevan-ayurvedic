// Simple in-memory rate limiter (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(ip: string, limit: number = 100, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip)
    }
  }
}, 60 * 1000) // Clean up every minute

