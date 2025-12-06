'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Search, Edit, Trash2, ShoppingCart, User, Stethoscope, MapPin, Settings, Info } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PincodeAutocomplete } from '@/components/pincode-autocomplete'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pagination } from '@/components/ui/pagination'

const leadSchema = z.object({
  // Patient Information
  name: z.string().optional(),
  fatherName: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  age: z.number().int().positive().optional().or(z.nan()),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email().optional().or(z.literal('')),
  alternatePhone: z.string().optional(),
  
  // Medical Information
  disease: z.string().optional(),
  duration: z.string().optional(),
  patientHistory: z.string().optional(),
  vppAmount: z.number().min(0).optional().or(z.nan()),
  
  // Address Information
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  addressLine3: z.string().optional(),
  addressLine4: z.string().optional(),
  addressLine5: z.string().optional(),
  addressLine6: z.string().optional(),
  pincodeId: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  cityId: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  state: z.string().optional(),
  country: z.string().optional(),
  
  // Communication Preferences
  preferredLanguage: z.string().optional(),
  preferredCommunication: z.string().optional(),
  
  // Lead Management
  source: z.enum(['WHATSAPP', 'SOCIAL_MEDIA', 'WEBSITE', 'REFERRAL', 'PHONE_CALL', 'OTHER']).optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  notes: z.string().optional(),
})

type LeadFormData = z.infer<typeof leadSchema>

const statusColors: Record<string, string> = {
  NEW: 'default',
  CONTACTED: 'secondary',
  QUALIFIED: 'success',
  CONVERTED: 'success',
  LOST: 'destructive',
}

const priorityColors: Record<string, string> = {
  LOW: 'secondary',
  MEDIUM: 'default',
  HIGH: 'warning',
  URGENT: 'destructive',
}

export default function LeadsPage() {
  const [open, setOpen] = useState(false)
  const [convertDialog, setConvertDialog] = useState<{ open: boolean; lead: any }>({ open: false, lead: null })
  const [editingLead, setEditingLead] = useState<any>(null)
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    source: '',
    search: '',
  })
  const [page, setPage] = useState(1)
  const limit = 20
  const [selectedPincodeId, setSelectedPincodeId] = useState<string>('')
  const [selectedCityId, setSelectedCityId] = useState<string>('')
  const [pincodeZipCode, setPincodeZipCode] = useState<string>('')
  const [addressData, setAddressData] = useState<{ area: string; city: string; state: string } | null>(null)
  const [activeTab, setActiveTab] = useState('patient')

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['leads', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.priority) params.append('priority', filters.priority)
      if (filters.source) params.append('source', filters.source)
      if (filters.search) params.append('search', filters.search)
      params.append('page', page.toString())
      params.append('limit', limit.toString())
      const res = await fetch(`/api/leads?${params}`)
      if (!res.ok) throw new Error('Failed to fetch leads')
      return res.json()
    },
  })

  const leads = data?.data || []
  const pagination = data?.pagination

  // Reset to page 1 when filters change
  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters)
    setPage(1)
  }

  const { register, handleSubmit, reset, setValue, watch, getValues, trigger, formState: { errors } } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      status: 'NEW',
      priority: 'MEDIUM',
      source: 'OTHER',
      country: 'India',
    },
  })

  // Sync selectedPincodeId and selectedCityId with form values
  useEffect(() => {
    if (selectedPincodeId) {
      setValue('pincodeId', String(selectedPincodeId), { shouldValidate: false })
    }
  }, [selectedPincodeId, setValue])

  useEffect(() => {
    if (selectedCityId) {
      setValue('cityId', String(selectedCityId), { shouldValidate: false })
    }
  }, [selectedCityId, setValue])

  const createMutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      // Build request body with proper pincodeId and cityId handling
      const requestBody: any = {
        ...data,
        state: addressData?.state || data.state,
      }
      
      // Handle pincodeId and cityId
      if (data.pincodeId && data.pincodeId !== '' && data.pincodeId !== 'null') {
        requestBody.pincodeId = String(data.pincodeId)
      } else if (selectedPincodeId && selectedPincodeId !== '' && selectedPincodeId !== 'null') {
        requestBody.pincodeId = String(selectedPincodeId)
      } else {
        requestBody.pincodeId = null
      }
      
      if (data.cityId && data.cityId !== '' && data.cityId !== 'null') {
        requestBody.cityId = String(data.cityId)
      } else if (selectedCityId && selectedCityId !== '' && selectedCityId !== 'null') {
        requestBody.cityId = String(selectedCityId)
      } else {
        requestBody.cityId = null
      }
      
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to create lead' }))
        console.error('Create lead error:', errorData)
        throw new Error(errorData.error || errorData.details?.[0]?.message || 'Failed to create lead')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setOpen(false)
      reset()
      setSelectedPincodeId('')
      setSelectedCityId('')
      setPincodeZipCode('')
      setAddressData(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<LeadFormData> }) => {
      // Ensure pincodeId and cityId are always included (even if null)
      const requestBody: any = {
        ...data,
        // Ensure state is included from addressData if available
        state: addressData?.state || data.state,
      }
      
      // Explicitly include pincodeId and cityId (they should already be in data, but ensure they're there)
      if ('pincodeId' in data && data.pincodeId !== undefined && data.pincodeId !== '' && data.pincodeId !== 'null') {
        requestBody.pincodeId = String(data.pincodeId)
      } else if (selectedPincodeId && selectedPincodeId !== '' && selectedPincodeId !== 'null') {
        requestBody.pincodeId = String(selectedPincodeId)
      } else {
        requestBody.pincodeId = null
      }
      
      if ('cityId' in data && data.cityId !== undefined && data.cityId !== '' && data.cityId !== 'null') {
        requestBody.cityId = String(data.cityId)
      } else if (selectedCityId && selectedCityId !== '' && selectedCityId !== 'null') {
        requestBody.cityId = String(selectedCityId)
      } else {
        requestBody.cityId = null
      }
      
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      if (!res.ok) {
        const errorText = await res.text()
        console.error('Update failed:', errorText)
        throw new Error('Failed to update lead')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setOpen(false)
      setEditingLead(null)
      reset()
      setSelectedPincodeId('')
      setSelectedCityId('')
      setPincodeZipCode('')
      setAddressData(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete lead')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })

  const onSubmit = (data: LeadFormData) => {
    // Get current form values (including any setValue updates)
    const currentValues = getValues()
    
    // Get pincodeId and cityId - prefer current form values, fallback to state
    const pincodeIdValue = currentValues.pincodeId || selectedPincodeId || null
    const cityIdValue = currentValues.cityId || selectedCityId || null
    
    const submitData: any = {
      ...data,
      age: isNaN(data.age as any) ? undefined : data.age,
      vppAmount: isNaN(data.vppAmount as any) ? undefined : data.vppAmount,
    }
    
    // Handle pincodeId and cityId - only include if they have actual values
    if (pincodeIdValue && pincodeIdValue !== 'null' && pincodeIdValue !== '') {
      submitData.pincodeId = String(pincodeIdValue)
    } else {
      submitData.pincodeId = null
    }
    
    if (cityIdValue && cityIdValue !== 'null' && cityIdValue !== '') {
      submitData.cityId = String(cityIdValue)
    } else {
      submitData.cityId = null
    }
    
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data: submitData })
    } else {
      createMutation.mutate(submitData)
    }
  }

  const onError = (errors: any) => {
    // Form validation errors are handled by react-hook-form
  }

  const handleEdit = async (lead: any) => {
    setEditingLead(lead)
    const pincodeIdStr = lead.pincodeId ? String(lead.pincodeId) : ''
    const cityIdStr = lead.cityId ? String(lead.cityId) : ''
    
    // Try to fetch zipcode by searching with area name
    let zipCodeStr = ''
    if (lead.pincode?.area) {
      try {
        // Search pincodes by area name to get zipcode
        const res = await fetch(`/api/pincodes?q=${encodeURIComponent(lead.pincode.area)}`)
        if (res.ok) {
          const pincodes = await res.json()
          // Find the pincode matching our ID
          const matchingPincode = pincodes.find((p: any) => String(p.id) === pincodeIdStr)
          if (matchingPincode && matchingPincode.zipCode) {
            zipCodeStr = String(matchingPincode.zipCode)
          } else {
            // Fallback to area name if zipcode not found
            zipCodeStr = lead.pincode.area
          }
        } else {
          zipCodeStr = lead.pincode.area
        }
      } catch (error) {
        console.error('Error fetching pincode zipcode:', error)
        zipCodeStr = lead.pincode.area
      }
    }
    
    setSelectedPincodeId(pincodeIdStr)
    setSelectedCityId(cityIdStr)
    setPincodeZipCode(zipCodeStr)
    reset({
      name: lead.name,
      fatherName: lead.fatherName || '',
      gender: lead.gender || undefined,
      age: lead.age || undefined,
      phone: lead.phone || '',
      email: lead.email || '',
      alternatePhone: lead.alternatePhone || '',
      disease: lead.disease || '',
      duration: lead.duration || '',
      patientHistory: lead.patientHistory || '',
      vppAmount: lead.vppAmount ? Number(lead.vppAmount) : undefined,
      addressLine1: lead.addressLine1 || '',
      addressLine2: lead.addressLine2 || '',
      addressLine3: lead.addressLine3 || '',
      addressLine4: lead.addressLine4 || '',
      addressLine5: lead.addressLine5 || '',
      addressLine6: lead.addressLine6 || '',
      pincodeId: pincodeIdStr,
      cityId: cityIdStr,
      state: lead.state || '',
      country: lead.country || 'India',
      preferredLanguage: lead.preferredLanguage || '',
      preferredCommunication: lead.preferredCommunication || '',
      source: lead.source || 'OTHER',
      status: lead.status,
      priority: lead.priority,
      notes: lead.notes || '',
    })
    setOpen(true)
    setActiveTab('patient')
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this lead?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleConvertToOrder = (lead: any) => {
    setConvertDialog({ open: true, lead })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Leads</h1>
          <p className="text-gray-500">Manage patient leads</p>
        </div>
        <Button onClick={() => { setOpen(true); setEditingLead(null); reset(); setSelectedPincodeId(''); setSelectedCityId(''); setPincodeZipCode(''); setAddressData(null); setActiveTab('patient'); }} className="shadow-md">
          <Plus className="mr-2 h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search leads..."
                value={filters.search}
                onChange={(e) => handleFilterChange({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>
            <Select
              value={filters.status}
              onChange={(e) => handleFilterChange({ ...filters, status: e.target.value })}
            >
              <option value="">All Statuses</option>
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="LOST">Lost</option>
            </Select>
            <Select
              value={filters.priority}
              onChange={(e) => handleFilterChange({ ...filters, priority: e.target.value })}
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
            <Select
              value={filters.source}
              onChange={(e) => handleFilterChange({ ...filters, source: e.target.value })}
            >
              <option value="">All Sources</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SOCIAL_MEDIA">Social Media</option>
              <option value="WEBSITE">Website</option>
              <option value="REFERRAL">Referral</option>
              <option value="PHONE_CALL">Phone Call</option>
              <option value="OTHER">Other</option>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                handleFilterChange({ status: '', priority: '', source: '', search: '' })
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Disease</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No leads found
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead: any) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.phone}</TableCell>
                      <TableCell>{lead.disease || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={statusColors[lead.status] as any}>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={priorityColors[lead.priority] as any}>
                          {lead.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>{lead.source || '-'}</TableCell>
                      <TableCell>{lead.vppAmount ? formatCurrency(lead.vppAmount) : '-'}</TableCell>
                      <TableCell>{formatDate(lead.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(lead)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {lead.status !== 'CONVERTED' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleConvertToOrder(lead)}
                              title="Convert to Order"
                            >
                              <ShoppingCart className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(lead.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
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

      {/* Create/Edit Lead Dialog */}
      <Dialog 
        open={open} 
        onOpenChange={(newOpen) => {
          // Only allow closing if not submitting
          if (!newOpen && !createMutation.isPending && !updateMutation.isPending) {
            setOpen(false)
            setEditingLead(null)
            reset()
            setSelectedPincodeId('')
            setSelectedCityId('')
            setAddressData(null)
          }
        }}
        onInteractOutside={(e) => {
          // Prevent closing on outside click
          e.preventDefault()
        }}
      >
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              {editingLead ? (
                <>
                  <Edit className="h-5 w-5 text-primary" />
                  Edit Patient Lead
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5 text-primary" />
                  Create New Patient Lead
                </>
              )}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {editingLead ? 'Update patient information and medical details' : 'Enter patient details to create a new lead'}
            </p>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit, onError)} className="mt-6" noValidate>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="patient" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Patient Info
                </TabsTrigger>
                <TabsTrigger value="medical" className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  Medical
                </TabsTrigger>
                <TabsTrigger value="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Address
                </TabsTrigger>
                <TabsTrigger value="management" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Management
                </TabsTrigger>
              </TabsList>

              {/* Patient Information Tab */}
              <TabsContent value="patient" className="space-y-6 mt-0">
                <Card className="border-2">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <User className="h-5 w-5 text-primary" />
                      Patient Information
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Basic patient details and contact information</p>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-semibold">
                          Patient Name
                        </Label>
                        <Input id="name" {...register('name')} className="h-11" placeholder="Enter patient full name" />
                        {errors.name && <p className="text-sm text-destructive flex items-center gap-1 mt-1"><Info className="h-3 w-3" /> {errors.name.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fatherName" className="text-sm font-semibold">Father Name</Label>
                        <Input id="fatherName" {...register('fatherName')} className="h-11" placeholder="Enter father's name" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gender" className="text-sm font-semibold">Gender</Label>
                        <Select id="gender" {...register('gender')} className="h-11">
                          <option value="">Select Gender</option>
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="age" className="text-sm font-semibold">Age</Label>
                        <Input id="age" type="number" {...register('age', { valueAsNumber: true })} className="h-11" placeholder="Enter age" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-sm font-semibold flex items-center gap-1">
                          Mobile Phone <span className="text-destructive">*</span>
                        </Label>
                        <Input id="phone" {...register('phone')} className="h-11" placeholder="10-digit mobile number" />
                        {errors.phone && <p className="text-sm text-destructive flex items-center gap-1 mt-1"><Info className="h-3 w-3" /> {errors.phone.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="alternatePhone" className="text-sm font-semibold">Alternate Phone</Label>
                        <Input id="alternatePhone" {...register('alternatePhone')} className="h-11" placeholder="Alternate contact number" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="email" className="text-sm font-semibold">Email <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                        <Input id="email" type="email" {...register('email')} className="h-11" placeholder="patient@example.com" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Medical Information Tab */}
              <TabsContent value="medical" className="space-y-6 mt-0">
                <Card className="border-2">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Stethoscope className="h-5 w-5" style={{ color: '#10B981' }} />
                      Medical Information
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Patient medical history and condition details</p>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="disease" className="text-sm font-semibold">Disease / Condition</Label>
                        <Input id="disease" {...register('disease')} className="h-11" placeholder="e.g., Male Sexual Disorder" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="duration" className="text-sm font-semibold">Duration</Label>
                        <Input id="duration" {...register('duration')} className="h-11" placeholder="e.g., 1 month, 6 months" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="patientHistory" className="text-sm font-semibold">Patient Description / History</Label>
                        <textarea
                          id="patientHistory"
                          {...register('patientHistory')}
                          className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                          placeholder="Enter detailed patient history, symptoms, and any relevant medical information..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vppAmount" className="text-sm font-semibold">
                          Total Amount / Estimated Order Value
                        </Label>
                        <Input id="vppAmount" type="number" step="0.01" {...register('vppAmount', { valueAsNumber: true })} className="h-11" placeholder="0.00" />
                        <p className="text-xs text-muted-foreground mt-1">Estimated total value of the order (VPP amount will be determined when converting to order)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Address Information Tab */}
              <TabsContent value="address" className="space-y-6 mt-0">
                <Card className="border-2">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <MapPin className="h-5 w-5 text-primary" />
                      Contact Address
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Patient address and communication preferences</p>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid gap-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="preferredCommunication" className="text-sm font-semibold">Preferred Communication</Label>
                          <Select id="preferredCommunication" {...register('preferredCommunication')} className="h-11">
                            <option value="">Select Communication</option>
                            <option value="PHONE">Phone</option>
                            <option value="WHATSAPP">WhatsApp</option>
                            <option value="EMAIL">Email</option>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="preferredLanguage" className="text-sm font-semibold">Preferred Language</Label>
                          <Input id="preferredLanguage" {...register('preferredLanguage')} className="h-11" placeholder="e.g., Hindi, English" />
                        </div>
                      </div>
                      
                      <div className="border-t pt-6 mt-2">
                        <h4 className="text-sm font-semibold mb-4 text-muted-foreground">ADDRESS DETAILS</h4>
                        <div className="grid gap-4">
                          {[1, 2, 3, 4, 5, 6].map((num) => (
                            <div key={num} className="space-y-2">
                              <Label htmlFor={`addressLine${num}`} className="text-sm font-semibold">
                                Address Line {num}
                                {num === 1 && <span className="text-muted-foreground font-normal ml-2">(Street, Building, etc.)</span>}
                              </Label>
                              <Input id={`addressLine${num}`} {...register(`addressLine${num}` as any)} className="h-11" placeholder={`Address line ${num}`} />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border-t pt-6 mt-2">
                        <h4 className="text-sm font-semibold mb-4 text-muted-foreground">LOCATION</h4>
                        {/* Hidden inputs to register pincodeId and cityId with react-hook-form */}
                        <input type="hidden" {...register('pincodeId')} />
                        <input type="hidden" {...register('cityId')} />
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="md:col-span-2">
                            <PincodeAutocomplete
                              value={pincodeZipCode || ''}
                              onPincodeChange={(pincodeId, pincode, area) => {
                                setSelectedPincodeId(pincodeId)
                                setPincodeZipCode(pincode)
                                setValue('pincodeId', String(pincodeId), { shouldValidate: true })
                              }}
                              onCityChange={(cityId, city, state, country) => {
                                setSelectedCityId(cityId)
                                setValue('cityId', String(cityId), { shouldValidate: true })
                                setValue('state', state, { shouldValidate: true })
                                setValue('country', country, { shouldValidate: true })
                              }}
                              onAddressFill={(data) => {
                                setAddressData(data)
                                if (!watch('addressLine1')) {
                                  setValue('addressLine1', data.area, { shouldValidate: true })
                                }
                                setValue('state', data.state, { shouldValidate: true })
                                setValue('country', data.country, { shouldValidate: true })
                              }}
                              selectedPincodeId={selectedPincodeId}
                              selectedCityId={selectedCityId}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="state" className="text-sm font-semibold">State</Label>
                            <Input id="state" {...register('state')} className="h-11" placeholder="State" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="country" className="text-sm font-semibold">Country</Label>
                            <Input id="country" {...register('country')} className="h-11" defaultValue="India" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Lead Management Tab */}
              <TabsContent value="management" className="space-y-6 mt-0">
                <Card className="border-2">
                  <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Settings className="h-5 w-5" style={{ color: '#F59E0B' }} />
                      Lead Management
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Lead source, status, priority, and additional notes</p>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid gap-6 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="source" className="text-sm font-semibold flex items-center gap-1">
                          Lead Source <span className="text-destructive">*</span>
                        </Label>
                        <Select id="source" {...register('source')} className="h-11">
                          <option value="WHATSAPP">WhatsApp</option>
                          <option value="SOCIAL_MEDIA">Social Media</option>
                          <option value="WEBSITE">Website</option>
                          <option value="REFERRAL">Referral</option>
                          <option value="PHONE_CALL">Phone Call</option>
                          <option value="OTHER">Other</option>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status" className="text-sm font-semibold flex items-center gap-1">
                          Status <span className="text-destructive">*</span>
                        </Label>
                        <Select id="status" {...register('status')} className="h-11">
                          <option value="NEW">New</option>
                          <option value="CONTACTED">Contacted</option>
                          <option value="QUALIFIED">Qualified</option>
                          <option value="CONVERTED">Converted</option>
                          <option value="LOST">Lost</option>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priority" className="text-sm font-semibold flex items-center gap-1">
                          Priority <span className="text-destructive">*</span>
                        </Label>
                        <Select id="priority" {...register('priority')} className="h-11">
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                          <option value="URGENT">Urgent</option>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <Label htmlFor="notes" className="text-sm font-semibold">Additional Notes</Label>
                        <textarea
                          id="notes"
                          {...register('notes')}
                          className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                          placeholder="Enter any additional notes or comments about this lead..."
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <DialogFooter className="border-t pt-4 mt-6">
              <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); setSelectedPincodeId(''); setSelectedCityId(''); setPincodeZipCode(''); setAddressData(null); setActiveTab('patient'); }}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending} 
                className="min-w-[120px]"
                onClick={async (e) => {
                  // Ensure form values are up to date before validation
                  if (selectedPincodeId) {
                    setValue('pincodeId', String(selectedPincodeId), { shouldValidate: true })
                  }
                  if (selectedCityId) {
                    setValue('cityId', String(selectedCityId), { shouldValidate: true })
                  }
                  
                  // Small delay to ensure setValue has taken effect
                  await new Promise(resolve => setTimeout(resolve, 10))
                  
                  // Trigger validation
                  await trigger()
                  // Don't prevent default - let form submit naturally
                }}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <>Saving...</>
                ) : editingLead ? (
                  <>Update Lead</>
                ) : (
                  <>Create Lead</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Convert to Order Dialog */}
      <ConvertToOrderDialog
        open={convertDialog.open}
        lead={convertDialog.lead}
        onClose={() => setConvertDialog({ open: false, lead: null })}
      />
    </div>
  )
}

// Convert to Order Dialog Component
function ConvertToOrderDialog({ open, lead, onClose }: { open: boolean; lead: any; onClose: () => void }) {
  const [formData, setFormData] = useState({
    receivedAmount: '',
    paymentStatus: 'PARTIAL',
    paymentMethod: 'MONEY_ORDER',
    moneyOrderNumber: '',
    totalAmount: '',
    vppAmount: '',
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    addressLine4: '',
    addressLine5: '',
    addressLine6: '',
    pincodeId: '',
    cityId: '',
    state: '',
    country: 'India',
    station: '',
    notes: '',
  })
  const [selectedPincodeId, setSelectedPincodeId] = useState('')
  const [selectedCityId, setSelectedCityId] = useState('')
  const [addressData, setAddressData] = useState<{ area: string; city: string; state: string } | null>(null)
  const [leadData, setLeadData] = useState<any>(null)
  const [pincodeZipCode, setPincodeZipCode] = useState('')

  const queryClient = useQueryClient()

  // Fetch full lead details when dialog opens
  const { data: fullLeadData, isLoading: isLoadingLead } = useQuery({
    queryKey: ['lead', lead?.id],
    queryFn: async () => {
      if (!lead?.id) return null
      const res = await fetch(`/api/leads/${lead.id}`)
      if (!res.ok) throw new Error('Failed to fetch lead')
      return res.json()
    },
    enabled: !!lead?.id && open,
  })

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!leadData) throw new Error('Lead data not loaded')
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: leadData.id,
          receivedAmount: parseFloat(formData.receivedAmount),
          paymentStatus: formData.paymentStatus,
          paymentMethod: formData.paymentMethod,
          moneyOrderNumber: formData.moneyOrderNumber,
          totalAmount: parseFloat(formData.totalAmount || formData.vppAmount),
          vppAmount: parseFloat(formData.vppAmount),
          addressLine1: formData.addressLine1,
          addressLine2: formData.addressLine2,
          addressLine3: formData.addressLine3,
          addressLine4: formData.addressLine4,
          addressLine5: formData.addressLine5,
          addressLine6: formData.addressLine6,
          pincodeId: selectedPincodeId ? String(selectedPincodeId) : (leadData?.pincodeId ? String(leadData.pincodeId) : undefined),
          cityId: selectedCityId ? String(selectedCityId) : (leadData?.cityId ? String(leadData.cityId) : undefined),
          state: addressData?.state || formData.state || leadData?.state || '',
          country: formData.country || leadData?.country || 'India',
          station: formData.station,
          notes: formData.notes,
        }),
      })
      if (!res.ok) throw new Error('Failed to create order')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      onClose()
      alert('Order created successfully!')
    },
  })

  // Initialize form when lead data is loaded
  useEffect(() => {
    const initializeForm = async () => {
      if (fullLeadData && open) {
      setLeadData(fullLeadData)
      const currentLead = fullLeadData
      const pincodeIdStr = currentLead.pincodeId ? String(currentLead.pincodeId) : ''
      const cityIdStr = currentLead.cityId ? String(currentLead.cityId) : ''
      
      setFormData({
        receivedAmount: '',
        paymentStatus: 'PARTIAL',
        paymentMethod: 'MONEY_ORDER',
        moneyOrderNumber: '',
        totalAmount: currentLead.vppAmount ? currentLead.vppAmount.toString() : '',
        vppAmount: currentLead.vppAmount ? currentLead.vppAmount.toString() : '',
        addressLine1: currentLead.addressLine1 || '',
        addressLine2: currentLead.addressLine2 || '',
        addressLine3: currentLead.addressLine3 || '',
        addressLine4: currentLead.addressLine4 || '',
        addressLine5: currentLead.addressLine5 || '',
        addressLine6: currentLead.addressLine6 || '',
        pincodeId: pincodeIdStr,
        cityId: cityIdStr,
        state: currentLead.state || '',
        country: currentLead.country || 'India',
        station: '',
        notes: '',
      })
      
      setSelectedPincodeId(pincodeIdStr)
      setSelectedCityId(cityIdStr)
      
      // Fetch zipcode for display
      let zipCodeStr = ''
      if (currentLead.pincode?.area && pincodeIdStr) {
        try {
          const res = await fetch(`/api/pincodes?q=${encodeURIComponent(currentLead.pincode.area)}`)
          if (res.ok) {
            const pincodes = await res.json()
            const matchingPincode = pincodes.find((p: any) => String(p.id) === pincodeIdStr)
            if (matchingPincode && matchingPincode.zipCode) {
              zipCodeStr = String(matchingPincode.zipCode)
            } else {
              zipCodeStr = currentLead.pincode.area
            }
          } else {
            zipCodeStr = currentLead.pincode.area
          }
        } catch (error) {
          zipCodeStr = currentLead.pincode.area
        }
      }
      setPincodeZipCode(zipCodeStr)
      
      // Set address data from pincode and city
      if (currentLead.pincode || currentLead.city) {
        setAddressData({
          area: currentLead.pincode?.area || '',
          city: currentLead.city?.city || '',
          state: currentLead.city?.state || currentLead.state || '',
        })
      } else {
        setAddressData(null)
      }
    }
    }
    
    initializeForm()
  }, [fullLeadData, open])

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setLeadData(null)
      setFormData({
        receivedAmount: '',
        paymentStatus: 'PARTIAL',
        paymentMethod: 'MONEY_ORDER',
        moneyOrderNumber: '',
        totalAmount: '',
        vppAmount: '',
        addressLine1: '',
        addressLine2: '',
        addressLine3: '',
        addressLine4: '',
        addressLine5: '',
        addressLine6: '',
        pincodeId: '',
        cityId: '',
        state: '',
        country: 'India',
        station: '',
        notes: '',
      })
      setSelectedPincodeId('')
      setSelectedCityId('')
      setAddressData(null)
      setPincodeZipCode('')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert Lead to Order</DialogTitle>
        </DialogHeader>
        {isLoadingLead ? (
          <div className="text-center py-8">Loading lead details...</div>
        ) : (
          <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Payment Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="order-totalAmount">Total Amount *</Label>
                <Input
                  id="order-totalAmount"
                  type="number"
                  step="0.01"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-vppAmount">VPP Amount *</Label>
                <Input
                  id="order-vppAmount"
                  type="number"
                  step="0.01"
                  value={formData.vppAmount}
                  onChange={(e) => setFormData({ ...formData, vppAmount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-receivedAmount">Received Amount *</Label>
                <Input
                  id="order-receivedAmount"
                  type="number"
                  step="0.01"
                  value={formData.receivedAmount}
                  onChange={(e) => setFormData({ ...formData, receivedAmount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-paymentStatus">Payment Status *</Label>
                <Select
                  id="order-paymentStatus"
                  value={formData.paymentStatus}
                  onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                >
                  <option value="PENDING">Pending</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="FULL">Full</option>
                  <option value="CUSTOM">Custom</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-paymentMethod">Payment Method</Label>
                <Select
                  id="order-paymentMethod"
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                >
                  <option value="MONEY_ORDER">Money Order</option>
                  <option value="ONLINE">Online</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-moneyOrderNumber">Money Order Number</Label>
                <Input
                  id="order-moneyOrderNumber"
                  value={formData.moneyOrderNumber}
                  onChange={(e) => setFormData({ ...formData, moneyOrderNumber: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Complete Address</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="order-addressLine1">Address Line 1</Label>
                <Input
                  id="order-addressLine1"
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="order-addressLine2">Address Line 2</Label>
                <Input
                  id="order-addressLine2"
                  value={formData.addressLine2}
                  onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="order-addressLine3">Address Line 3</Label>
                <Input
                  id="order-addressLine3"
                  value={formData.addressLine3}
                  onChange={(e) => setFormData({ ...formData, addressLine3: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="order-addressLine4">Address Line 4</Label>
                <Input
                  id="order-addressLine4"
                  value={formData.addressLine4}
                  onChange={(e) => setFormData({ ...formData, addressLine4: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="order-addressLine5">Address Line 5</Label>
                <Input
                  id="order-addressLine5"
                  value={formData.addressLine5}
                  onChange={(e) => setFormData({ ...formData, addressLine5: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="order-addressLine6">Address Line 6</Label>
                <Input
                  id="order-addressLine6"
                  value={formData.addressLine6}
                  onChange={(e) => setFormData({ ...formData, addressLine6: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <PincodeAutocomplete
                  value={pincodeZipCode || ''}
                  onPincodeChange={(pincodeId, pincode, area) => {
                    setSelectedPincodeId(pincodeId)
                    setPincodeZipCode(pincode)
                    setFormData({ ...formData, pincodeId })
                  }}
                  onCityChange={(cityId, city, state, country) => {
                    setSelectedCityId(cityId)
                    setFormData({ ...formData, cityId, state, country })
                  }}
                  onAddressFill={(data) => {
                    setAddressData(data)
                    if (!formData.addressLine1) {
                      setFormData({ ...formData, addressLine1: data.area, state: data.state, country: data.country })
                    } else {
                      setFormData({ ...formData, state: data.state, country: data.country })
                    }
                  }}
                  selectedPincodeId={selectedPincodeId}
                  selectedCityId={selectedCityId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-state">State</Label>
                <Input
                  id="order-state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-station">Station</Label>
                <Input
                  id="order-station"
                  value={formData.station}
                  onChange={(e) => setFormData({ ...formData, station: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-country">Country</Label>
                <Input
                  id="order-country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="order-notes">Notes</Label>
                <textarea
                  id="order-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => createOrderMutation.mutate()}
              disabled={createOrderMutation.isPending || !formData.receivedAmount || !formData.totalAmount || isLoadingLead}
            >
              {createOrderMutation.isPending ? 'Creating...' : 'Create Order'}
            </Button>
          </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
