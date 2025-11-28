'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Camera, Save } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  bio: z.string().optional(),
})

type ProfileFormData = z.infer<typeof profileSchema>

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: session?.user?.name || '',
      email: session?.user?.email || '',
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileFormData & { image?: File }) => {
      // In a real app, you'd upload the image and update the user profile
      // For now, we'll just update the session
      const formData = new FormData()
      formData.append('name', data.name)
      formData.append('email', data.email)
      if (data.phone) formData.append('phone', data.phone)
      if (data.bio) formData.append('bio', data.bio)
      if (data.image) formData.append('image', data.image)

      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        body: formData,
      })
      if (!res.ok) throw new Error('Failed to update profile')
      return res.json()
    },
    onSuccess: () => {
      update() // Refresh session
      alert('Profile updated successfully!')
    },
  })

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setProfileImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const onSubmit = (data: ProfileFormData) => {
    updateMutation.mutate({
      ...data,
      image: imageFile || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-gray-500">Manage your profile information</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Picture */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
            <CardDescription>Update your profile picture</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="h-24 w-24 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-semibold">
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt="Profile"
                      className="h-24 w-24 rounded-full object-cover"
                    />
                  ) : (
                    session?.user?.name?.charAt(0).toUpperCase()
                  )}
                </div>
                <label
                  htmlFor="profile-image"
                  className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors"
                >
                  <Camera className="h-4 w-4 text-white" />
                  <input
                    id="profile-image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
              </div>
              <div>
                <p className="text-sm font-medium">Upload a new photo</p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or GIF. Max size 2MB.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" {...register('name')} />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" {...register('email')} disabled />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" type="tel" {...register('phone')} />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <textarea
                  id="bio"
                  {...register('bio')}
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Tell us about yourself..."
                />
              </div>
              <Button type="submit" disabled={updateMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>View your account details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Role</p>
              <p className="text-sm mt-1">{session?.user?.role}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">User ID</p>
              <p className="text-sm mt-1 font-mono text-xs">{session?.user?.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


