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
      const pincodeIdNum = parseInt(pincodeId, 10)
      if (isNaN(pincodeIdNum)) {
        return NextResponse.json([])
      }
      
      const pincodeResult = await prisma.pincode.findUnique({
        where: { id: pincodeIdNum } as any,
      }) as any

      if (!pincodeResult) {
        return NextResponse.json([])
      }

      const zipCode = pincodeResult.zipCode as number

      // Find all pincodes with the same zipCode and get their unique cities
      const pincodesWithSameZip = await prisma.pincode.findMany({
        where: { 
          zipCode: zipCode,
          status: 1, // Only active pincodes
        } as any,
        select: {
          cityId: true,
        },
      })

      if (pincodesWithSameZip.length === 0) {
        return NextResponse.json([])
      }

      // Get unique city IDs
      const cityIds = [...new Set(pincodesWithSameZip.map(p => p.cityId))]
      
      // Get all unique cities
      const cities = await prisma.city.findMany({
        where: {
          id: { in: cityIds },
        },
        select: {
          id: true,
          city: true,
          state: true,
          country: true,
        },
        orderBy: [
          { city: 'asc' },
          { state: 'asc' },
        ],
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
        select: {
          id: true,
          city: true,
          state: true,
          country: true,
        },
        take: 20,
      })

      return NextResponse.json(cities)
    }

    if (state) {
      const cities = await prisma.city.findMany({
        where: { state },
        select: {
          id: true,
          city: true,
          state: true,
          country: true,
        },
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

