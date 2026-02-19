'use client'

import { useState, useEffect } from 'react'

export function useBnbPrice() {
  const [usdPrice, setUsdPrice] = useState<number | null>(null)

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT')
        const data = await res.json()
        setUsdPrice(parseFloat(data.price))
      } catch (e) {
        console.error("Failed to fetch BNB price")
      }
    }

    fetchPrice()
    // Refresh price every 60 seconds
    const interval = setInterval(fetchPrice, 60000)
    return () => clearInterval(interval)
  }, [])

  const convert = (bnbAmount: string | number) => {
    if (!usdPrice) return null
    const total = Number(bnbAmount) * usdPrice
    return total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  }

  return { usdPrice, convert }
}