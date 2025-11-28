import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/get-session'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const profileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  profileImage: z.string().optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    if (!rateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const formData = await req.formData()
    const data: any = {}

    if (formData.has('name')) data.name = formData.get('name') as string
    if (formData.has('phone')) data.phone = formData.get('phone') as string
    if (formData.has('bio')) data.bio = formData.get('bio') as string

    const validatedData = profileSchema.parse(data)

    // Handle image upload (in production, upload to cloud storage)
    // For now, we'll store a placeholder URL or the filename
    const imageFile = formData.get('image') as File | null
    if (imageFile) {
      // In production, upload to S3/Cloudinary/etc. and get the URL
      // For now, we'll store a reference to indicate an image was uploaded
      // You can implement actual file upload logic here
      validatedData.profileImage = `/uploads/profiles/${session.user.id}-${Date.now()}.${imageFile.name.split('.').pop()}`
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: validatedData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    await createAuditLog(
      session.user.id,
      'UPDATE',
      'User',
      user.id,
      validatedData,
      `Updated profile: ${user.name}`,
      ip,
      req.headers.get('user-agent') || undefined
    )

    return NextResponse.json(user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

