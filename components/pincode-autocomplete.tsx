'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface PincodeOption {
  id: string
  zipCode: string
  area: string
  city: {
    id: string
    city: string
    state: string
  }
}

interface CityOption {
  id: string
  city: string
  state: string
  country: string
}

interface PincodeAutocompleteProps {
  value?: string
  onPincodeChange: (pincodeId: string, pincode: string, area: string) => void
  onCityChange: (cityId: string, city: string, state: string, country: string) => void
  onAddressFill?: (address: { area: string; city: string; state: string; country: string }) => void
  selectedPincodeId?: string
  selectedCityId?: string
  disabled?: boolean
}

export function PincodeAutocomplete({
  value = '',
  onPincodeChange,
  onCityChange,
  onAddressFill,
  selectedPincodeId,
  selectedCityId,
  disabled = false,
}: PincodeAutocompleteProps) {
  const [pincode, setPincode] = useState(value)
  const [pincodeOptions, setPincodeOptions] = useState<PincodeOption[]>([])
  const [cities, setCities] = useState<CityOption[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedPincode, setSelectedPincode] = useState<PincodeOption | null>(null)
  const [localSelectedCityId, setLocalSelectedCityId] = useState<string>(selectedCityId || '')
  const timeoutRef = useRef<NodeJS.Timeout>()
  const valueFromPropsRef = useRef(false)

  // Sync pincode input when value prop changes
  useEffect(() => {
    if (value !== pincode) {
      valueFromPropsRef.current = true
      setPincode(value || '')
    }
  }, [value])

  // Sync local state with prop when it changes externally
  useEffect(() => {
    if (selectedCityId !== localSelectedCityId) {
      setLocalSelectedCityId(selectedCityId || '')
    }
  }, [selectedCityId])

  // Load pincode details and cities when component mounts with existing pincodeId (for editing)
  useEffect(() => {
    const loadPincodeDetails = async () => {
      if (selectedPincodeId && !selectedPincode) {
        try {
          // First try to load pincode details by searching - we need area name to search
          // Since we might have the value (zipcode or area), use that to find the pincode
          if (value && value.length >= 3) {
            const res = await fetch(`/api/pincodes?pincode=${encodeURIComponent(value)}`)
            if (res.ok) {
              const pincodes = await res.json()
              const matchingPincode = pincodes.find((p: any) => String(p.id) === selectedPincodeId)
              if (matchingPincode) {
                setSelectedPincode({
                  id: String(matchingPincode.id),
                  zipCode: String(matchingPincode.zipCode),
                  area: matchingPincode.area,
                  city: matchingPincode.city,
                })
              }
            }
          }
          
          // Load cities for this pincode
          const cityRes = await fetch(`/api/cities?pincodeId=${selectedPincodeId}`)
          if (cityRes.ok) {
            const cityData = await cityRes.json()
            setCities(cityData)
            
            // If only one city, auto-select it
            if (cityData.length === 1) {
              const city = cityData[0]
              setLocalSelectedCityId(city.id)
              onCityChange(city.id, city.city, city.state, city.country || 'India')
            } else if (cityData.length > 1 && selectedCityId) {
              // Multiple cities - pre-select if already selected
              const preSelected = cityData.find((c: CityOption) => c.id === selectedCityId)
              if (preSelected) {
                setLocalSelectedCityId(preSelected.id)
                onCityChange(preSelected.id, preSelected.city, preSelected.state, preSelected.country || 'India')
              }
            }
          }
        } catch (error) {
          console.error('Error loading pincode details:', error)
        }
      }
    }
    
    loadPincodeDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPincodeId, value]) // Run when selectedPincodeId or value changes

  useEffect(() => {
    // Don't auto-search if value was just set from props (editing mode)
    if (valueFromPropsRef.current && pincode === value) {
      valueFromPropsRef.current = false
      setPincodeOptions([])
      setShowSuggestions(false)
      return
    }
    
    // Don't auto-search if we have a selectedPincodeId and the value matches (user is not typing)
    // This prevents dropdown from opening when editing with existing pincode
    if (selectedPincodeId && pincode && selectedPincode) {
      // If we have a selection and value matches, don't auto-search
      if (pincode === selectedPincode.zipCode || pincode === selectedPincode.area) {
        setPincodeOptions([])
        setShowSuggestions(false)
        return
      }
    }
    
    if (pincode.length >= 3) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        searchPincodes(pincode)
      }, 300)
    } else {
      setPincodeOptions([])
      setShowSuggestions(false)
      // Clear cities and selection when pincode is cleared
      if (!selectedPincodeId) {
        setCities([])
        setLocalSelectedCityId('')
        setSelectedPincode(null)
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [pincode, selectedPincodeId, selectedPincode, value])

  const searchPincodes = async (query: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/pincodes?pincode=${query}`)
      if (res.ok) {
        const data = await res.json()
        setPincodeOptions(data)
        setShowSuggestions(data.length > 0)
      }
    } catch (error) {
      console.error('Error fetching pincodes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePincodeSelect = async (option: PincodeOption) => {
    valueFromPropsRef.current = false
    setPincode(option.zipCode)
    setSelectedPincode(option)
    setShowSuggestions(false)
    onPincodeChange(option.id, option.zipCode, option.area)

    // Fetch cities for this pincode
    try {
      const res = await fetch(`/api/cities?pincodeId=${option.id}`)
      if (res.ok) {
        const cityData = await res.json()
        setCities(cityData)

        // If only one city, auto-select it
        if (cityData.length === 1) {
          const city = cityData[0]
          onCityChange(city.id, city.city, city.state, city.country || 'India')
          if (onAddressFill) {
            onAddressFill({
              area: option.area,
              city: city.city,
              state: city.state,
              country: city.country || 'India',
            })
          }
        } else if (cityData.length > 1) {
          // Multiple cities - user must select
          // Pre-select if already selected
          if (selectedCityId) {
            const preSelected = cityData.find((c: CityOption) => c.id === selectedCityId)
            if (preSelected) {
              setLocalSelectedCityId(preSelected.id)
              onCityChange(preSelected.id, preSelected.city, preSelected.state, preSelected.country || 'India')
            } else {
              // Reset selection if previously selected city is not in the list
              setLocalSelectedCityId('')
            }
          } else {
            setLocalSelectedCityId('')
          }
        } else {
          // No cities found, reset selection
          setLocalSelectedCityId('')
        }
      }
    } catch (error) {
      console.error('Error fetching cities:', error)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="pincode">Pincode</Label>
      <div className="relative">
        <Input
          id="pincode"
          type="text"
          value={pincode}
          onChange={(e) => setPincode(e.target.value)}
          placeholder="Enter pincode"
          disabled={disabled}
          onFocus={() => {
            if (pincodeOptions.length > 0) {
              setShowSuggestions(true)
            }
          }}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {showSuggestions && pincodeOptions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {pincodeOptions.map((option) => (
              <div
                key={option.id}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => handlePincodeSelect(option)}
              >
                <div className="font-medium">{option.zipCode}</div>
                <div className="text-sm text-muted-foreground">
                  {option.area}, {option.city.city}, {option.city.state}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cities.length > 1 && (
        <div className="space-y-2">
          <Label htmlFor="city">City (Multiple cities found for this pincode)</Label>
          <Select
            id="city"
            value={localSelectedCityId}
            onChange={(e) => {
              const selectedId = e.target.value
              setLocalSelectedCityId(selectedId)
              const city = cities.find((c) => c.id === selectedId)
              if (city) {
                onCityChange(city.id, city.city, city.state, city.country || 'India')
                if (onAddressFill && selectedPincode) {
                  onAddressFill({
                    area: selectedPincode.area,
                    city: city.city,
                    state: city.state,
                    country: city.country || 'India',
                  })
                }
              }
            }}
            disabled={disabled}
          >
            <option value="">Select City</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.city}, {city.state}
              </option>
            ))}
          </Select>
        </div>
      )}

      {cities.length === 1 && (
        <div className="text-sm text-muted-foreground">
          City: {cities[0].city}, {cities[0].state}
        </div>
      )}
    </div>
  )
}

