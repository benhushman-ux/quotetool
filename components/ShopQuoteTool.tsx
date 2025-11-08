import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { jsPDF } from 'jspdf'

type Side = 'front' | 'back' | 'left' | 'right'
type Door = { id: number; type: 'walk' | 'garage'; size: string; x: number }

export default function ShopQuoteTool() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    email: '',
    sidewallHeight: '10',
    length: '30',
    width: '40',
    color: 'normal',
    roofPitch: '3/12',
    sprayFoam: false,
  })
  const [quote, setQuote] = useState<string | null>(null)
  const [quoteNote, setQuoteNote] = useState('')
  const [doors, setDoors] = useState<{ [K in Side]: Door[] }>({ front: [], back: [], left: [], right: [] })
  const [error, setError] = useState('')
  const [sendStatus, setSendStatus] = useState<'idle'|'sending'|'sent'|'failed'>('idle')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const OWNER_EMAIL = 'ben@325guys.com'
  const nextDoorId = useRef(0)
  const [doorKey, setDoorKey] = useState(0)

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target
    if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked })
      return
    }
    let newValue = parseFloat(value)
    if (Number.isNaN(newValue)) newValue = 0
    if (name === 'sidewallHeight') newValue = Math.max(newValue, 8)
    if (name === 'width') newValue = Math.max(newValue, 12)
    if (name === 'length') newValue = Math.max(newValue, 20)
    setFormData({ ...formData, [name]: newValue.toString() })
  }

  const handleColorChange = (e: any) => setFormData({ ...formData, color: e.target.value })
  const handlePitchChange = (e: any) => setFormData({ ...formData, roofPitch: e.target.value })

  const formatCurrency = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const addDoor = (side: Side, type: 'walk' | 'garage', size: string) => {
    setError('')
    const sidewall = Math.max(parseFloat(formData.sidewallHeight) || 0, 8)
    if (type === 'garage') {
      const doorHeight = parseFloat(size.split('x')[1])
      if (sidewall < doorHeight + 2) {
        setError(`Cannot add ${size} garage door: sidewall must be at least 2' taller than door height.`)
        return
      }
    }
    nextDoorId.current += 1
    const newDoor: Door = { id: nextDoorId.current, type, size, x: 0 }
    setDoors((prev) => ({ ...prev, [side]: [...prev[side], newDoor] }))
    setDoorKey((k) => k + 1)
  }

  const moveDoor = (side: Side, id: number, direction: 'left' | 'right') => {
    const EDGE_MARGIN = 0.5
    const MOVE_STEP = 0.5
    setDoors((prev) => ({
      ...prev,
      [side]: prev[side].map((d) => {
        const [dw] = d.size.split('x').map((n) => parseFloat(n))
        const buildingWidth = side === 'left' || side === 'right'
          ? Math.max(parseFloat(formData.length) || 0, 20)
          : Math.max(parseFloat(formData.width) || 0, 12)
        const halfWidth = buildingWidth / 2
        const newX = d.x + (direction === 'left' ? -MOVE_STEP : MOVE_STEP)
        const clampedX = Math.max(-halfWidth + dw / 2 + EDGE_MARGIN, Math.min(halfWidth - dw / 2 - EDGE_MARGIN, newX))
        return d.id === id ? { ...d, x: clampedX } : d
      }),
    }))
  }

  const removeDoor = (side: Side, id: number) => {
    setDoors((prev) => ({ ...prev, [side]: prev[side].filter((d) => d.id !== id) }))
    setDoorKey((k) => k + 1)
  }

  const calculateQuote = () => {
    const { sidewallHeight, length, width, color, sprayFoam, roofPitch } = formData
    const sidewall = Math.max(parseFloat(sidewallHeight) || 0, 8)
    const widthVal = Math.max(parseFloat(width) || 0, 12)
    const lengthVal = Math.max(parseFloat(length) || 0, 20)
    const area = lengthVal * widthVal
    let total = area * 35
    if (sidewall > 12) {
      const extraHeight = sidewall - 12
      const perimeter = 2 * (lengthVal + widthVal)
      total += perimeter * extraHeight * 6
    }
    const allDoors = Object.values(doors).flat()
    const walkDoors = allDoors.filter((d) => d.type === 'walk')
    const garageDoors = allDoors.filter((d) => d.type === 'garage')
    total += walkDoors.length * 800
    total += garageDoors.length * 2000

    if (sprayFoam) {
      const pitchRatio = (parseFloat(roofPitch.split('/')[0]) || 0) / 12
      const roofRise = (widthVal / 2) * pitchRatio
      const halfSpan = Math.sqrt(Math.pow(widthVal / 2, 2) + Math.pow(roofRise, 2))
      const roofArea = halfSpan * 2 * lengthVal
      const wallArea = 2 * (widthVal * sidewall + lengthVal * sidewall)
      const gableArea = widthVal * roofRise
      const totalFoamSqFt = roofArea + wallArea + gableArea
      total += totalFoamSqFt * 2
    }

    if (color === 'premium') total *= 1.15
    let note = 'Includes concrete and metal building.'
    const addons: string[] = []

    if (walkDoors.length > 0) {
      const walkSizesArr: string[] = []
      walkDoors.forEach(d => {
        if (!walkSizesArr.includes(d.size)) walkSizesArr.push(d.size)
      })
      const walkSizes = walkSizesArr.join(', ')
      addons.push(`${walkDoors.length} walk door${walkDoors.length > 1 ? 's' : ''} (${walkSizes})`)
    }

    if (garageDoors.length > 0) {
      const garageSizesArr: string[] = []
      garageDoors.forEach(d => {
        if (!garageSizesArr.includes(d.size)) garageSizesArr.push(d.size)
      })
      const garageSizes = garageSizesArr.join(', ')
      addons.push(`${garageDoors.length} garage door${garageDoors.length > 1 ? 's' : ''} (${garageSizes})`)
    }

    if (sprayFoam) addons.push('spray foam (1" closed cell on whole building)')
    if (addons.length > 0) note += ' Includes ' + addons.join(' and ') + '.'
    setQuote(formatCurrency(total))
    setQuoteNote(note)
  }

  const handleGetQuote = () => {
    setError('')
    calculateQuote()
  }

  return (
    <motion.div className="max-w-4xl mx-auto p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-3xl font-bold text-center mb-6">Shop Quote Calculator</h1>
      {error && <div className="bg-red-100 text-red-800 border border-red-300 rounded p-2 text-center mb-3">{error}</div>}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <input placeholder="Full Name" name="name" value={formData.name} onChange={handleChange} className="border rounded p-2 w-full mb-2" />
          <input placeholder="Phone" name="phone" value={formData.phone} onChange={handleChange} className="border rounded p-2 w-full mb-2" />
          <input placeholder="Address" name="address" value={formData.address} onChange={handleChange} className="border rounded p-2 w-full mb-2" />
          <input placeholder="Email" name="email" value={formData.email} onChange={handleChange} className="border rounded p-2 w-full mb-2" />
          <label>Sidewall Height (ft)</label>
          <input type="number" name="sidewallHeight" value={formData.sidewallHeight} onChange={handleChange} className="border rounded p-2 w-full mb-2" min={8} />
          <label>Length (ft)</label>
          <input type="number" name="length" value={formData.length} onChange={handleChange} className="border rounded p-2 w-full mb-2" min={20} />
          <label>Width (ft)</label>
          <input type="number" name="width" value={formData.width} onChange={handleChange} className="border rounded p-2 w-full mb-2" min={12} />
          <label>Roof Pitch</label>
          <select value={formData.roofPitch} onChange={handlePitchChange} className="border rounded p-2 w-full mb-2">
            <option value="1/12">1/12</option>
            <option value="2/12">2/12</option>
            <option value="3/12">3/12</option>
            <option value="4/12">4/12</option>
          </select>
          <label>Color Type</label>
          <select value={formData.color} onChange={handleColorChange} className="border rounded p-2 w-full mb-2">
            <option value="normal">Normal</option>
            <option value="premium">Premium (+15%)</option>
          </select>
          <div className="flex items-center mb-2">
            <input type="checkbox" id="sprayFoam" name="sprayFoam" checked={formData.sprayFoam} onChange={handleChange} className="mr-2" />
            <label htmlFor="sprayFoam" className="text-sm">Want sprayfoam included in the quote? (1 inch closed cell on whole building)</label>
          </div>
          <button onClick={handleGetQuote} className="bg-green-600 text-white rounded p-2 w-full">Get Quote</button>
          {quote && (
            <motion.div className="mt-4 p-4 bg-gray-100 rounded text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h3 className="text-xl font-bold mb-1">${quote}</h3>
              <p className="text-sm">{quoteNote}</p>
            </motion.div>
          )}
        </div>
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2">Front Elevation (preview)</h3>
          <div className="bg-gray-100 border rounded-lg p-6 text-center text-gray-500">
            Visualization placeholder (add drawing here)
          </div>
        </div>
      </div>
    </motion.div>
  )
}
