'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface PincodeOption {
  id: string
  pincode: string
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
}

interface PincodeAutocompleteProps {
  value?: string
  onPincodeChange: (pincodeId: string, pincode: string, area: string) => void
  onCityChange: (cityId: string, city: string, state: string) => void
  onAddressFill?: (address: { area: string; city: string; state: string }) => void
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
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
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
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [pincode])

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
    setPincode(option.pincode)
    setSelectedPincode(option)
    setShowSuggestions(false)
    onPincodeChange(option.id, option.pincode, option.area)

    // Fetch cities for this pincode
    try {
      const res = await fetch(`/api/cities?pincodeId=${option.id}`)
      if (res.ok) {
        const cityData = await res.json()
        setCities(cityData)

        // If only one city, auto-select it
        if (cityData.length === 1) {
          const city = cityData[0]
          onCityChange(city.id, city.city, city.state)
          if (onAddressFill) {
            onAddressFill({
              area: option.area,
              city: city.city,
              state: city.state,
            })
          }
        } else if (cityData.length > 1) {
          // Multiple cities - user must select
          // Pre-select if already selected
          if (selectedCityId) {
            const preSelected = cityData.find((c: CityOption) => c.id === selectedCityId)
            if (preSelected) {
              onCityChange(preSelected.id, preSelected.city, preSelected.state)
            }
          }
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
                <div className="font-medium">{option.pincode}</div>
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
            value={selectedCityId || ''}
            onChange={(e) => {
              const city = cities.find((c) => c.id === e.target.value)
              if (city) {
                onCityChange(city.id, city.city, city.state)
                if (onAddressFill && selectedPincode) {
                  onAddressFill({
                    area: selectedPincode.area,
                    city: city.city,
                    state: city.state,
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

