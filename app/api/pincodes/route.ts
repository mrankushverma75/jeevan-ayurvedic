import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    if (!rateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') // Search query
    const pincode = searchParams.get('pincode') // Exact pincode search

    if (pincode) {
      // Search by exact pincode
      const pincodes = await prisma.pincode.findMany({
        where: {
          pincode: pincode,
          status: 'active',
        },
        include: {
          city: true,
        },
        take: 50,
      })

      return NextResponse.json(pincodes)
    }

    if (query) {
      // Search by area name or pincode
      const pincodes = await prisma.pincode.findMany({
        where: {
          OR: [
            { area: { contains: query } },
            { pincode: { contains: query } },
          ],
          status: 'active',
        },
        include: {
          city: true,
        },
        take: 20,
      })

      return NextResponse.json(pincodes)
    }

    return NextResponse.json([])
  } catch (error) {
    console.error('Error fetching pincodes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

