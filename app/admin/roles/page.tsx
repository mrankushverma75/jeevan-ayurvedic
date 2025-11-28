'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Edit, Trash2, Shield } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function RolesPage() {
  const [open, setOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<any>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Roles & Permissions</h1>
          <p className="text-gray-500">Manage roles and permissions</p>
        </div>
        <Button onClick={() => { setOpen(true); setEditingRole(null); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Role
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Roles & Permissions management is coming soon. For now, users have ADMIN or EMPLOYEE roles.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

