'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'
import { formatDateTime } from '@/lib/utils'

const actionColors: Record<string, string> = {
  CREATE: 'success',
  UPDATE: 'warning',
  DELETE: 'destructive',
  ASSIGN: 'default',
  APPROVE: 'success',
  REJECT: 'destructive',
  CANCEL: 'destructive',
}

export default function AuditLogsPage() {
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    startDate: '',
    endDate: '',
  })
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.entityType) params.append('entityType', filters.entityType)
      if (filters.action) params.append('action', filters.action)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      params.append('page', page.toString())
      params.append('limit', limit.toString())
      const res = await fetch(`/api/audit-logs?${params}`)
      if (!res.ok) throw new Error('Failed to fetch audit logs')
      return res.json()
    },
  })

  const logs = data?.data || []
  const pagination = data?.pagination

  // Reset to page 1 when filters change
  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="text-gray-500">System activity and changes</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-5">
            <Select
              value={filters.entityType}
              onChange={(e) => handleFilterChange({ ...filters, entityType: e.target.value })}
            >
              <option value="">All Entities</option>
              <option value="Lead">Lead</option>
              <option value="Order">Order</option>
              <option value="User">User</option>
            </Select>
            <Select
              value={filters.action}
              onChange={(e) => handleFilterChange({ ...filters, action: e.target.value })}
            >
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="ASSIGN">Assign</option>
              <option value="APPROVE">Approve</option>
              <option value="REJECT">Reject</option>
              <option value="CANCEL">Cancel</option>
            </Select>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange({ ...filters, startDate: e.target.value })}
              placeholder="Start Date"
            />
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange({ ...filters, endDate: e.target.value })}
              placeholder="End Date"
            />
            <Button
              variant="outline"
              onClick={() => {
                handleFilterChange({ entityType: '', action: '', startDate: '', endDate: '' })
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No audit logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{log.user.name}</div>
                          <div className="text-sm text-muted-foreground">{log.user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={actionColors[log.action] as any}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.entityType}</TableCell>
                      <TableCell className="font-mono text-xs">{log.entityId.slice(0, 8)}...</TableCell>
                      <TableCell className="max-w-md truncate">{log.description || '-'}</TableCell>
                      <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Card>
          <CardContent className="pt-6">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

