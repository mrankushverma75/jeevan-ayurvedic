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
    const query = searchParams.get('q')
    const state = searchParams.get('state')
    const pincodeId = searchParams.get('pincodeId')

    if (pincodeId) {
      // Get cities for a specific pincode
      const pincode = await prisma.pincode.findUnique({
        where: { id: pincodeId },
        include: { city: true },
      })

      if (!pincode) {
        return NextResponse.json([])
      }

      // If pincode has a city, return it; otherwise search for cities with same name
      const cities = await prisma.city.findMany({
        where: {
          OR: [
            { id: pincode.cityId },
            { city: { contains: pincode.city.city } },
          ],
        },
        include: {
          pincodes: {
            where: { pincode: pincode.pincode },
            take: 1,
          },
        },
      })

      return NextResponse.json(cities)
    }

    if (query) {
      const cities = await prisma.city.findMany({
        where: {
          OR: [
            { city: { contains: query } },
            { alias: { contains: query } },
            { state: { contains: query } },
          ],
        },
        take: 20,
      })

      return NextResponse.json(cities)
    }

    if (state) {
      const cities = await prisma.city.findMany({
        where: { state },
        take: 100,
      })

      return NextResponse.json(cities)
    }

    return NextResponse.json([])
  } catch (error) {
    console.error('Error fetching cities:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

