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
      const pincodeNum = parseInt(pincode, 10)
      if (isNaN(pincodeNum)) {
        return NextResponse.json([])
      }
      
      const pincodes = await prisma.pincode.findMany({
        where: {
          zipCode: pincodeNum,
          status: 1,
        } as any,
        include: {
          city: true,
        },
        take: 50,
      })

      return NextResponse.json(pincodes)
    }

    if (query) {
      // Search by area name or pincode
      // For zipCode, convert query to number if it's numeric, otherwise search as string in area
      const queryNum = parseInt(query, 10)
      const whereClause: any = {
        status: 1,
      }
      
      if (!isNaN(queryNum)) {
        // If query is numeric, search by zipCode (exact match) or area
        whereClause.OR = [
          { area: { contains: query } },
          { zipCode: queryNum },
        ]
      } else {
        // If query is not numeric, only search by area
        whereClause.area = { contains: query }
      }
      
      const pincodes = await prisma.pincode.findMany({
        where: whereClause,
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

