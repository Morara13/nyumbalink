export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { phone, amount, reference } = req.body

  if (!phone || !amount || !reference) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const response = await fetch('https://payment.intasend.com/api/v1/payment/mpesa-stk-push/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-IntaSend-Public-API-Key': process.env.VITE_INTASEND_PUBLISHABLE_KEY,
        'Authorization': 'Bearer ' + process.env.VITE_INTASEND_SECRET_KEY
      },
      body: JSON.stringify({
        phone_number: phone.startsWith('0') ? '254' + phone.substring(1) : phone,
        amount: amount,
        narrative: reference,
        currency: 'KES'
      })
    })

    const data = await response.json()
    console.log('IntaSend response:', JSON.stringify(data))

    if (data.invoice) {
      return res.status(200).json({ success: true, invoice_id: data.invoice.invoice_id })
    } else {
      return res.status(400).json({ error: data.detail || JSON.stringify(data) })
    }
  } catch (e) {
    console.error('IntaSend error:', e)
    return res.status(500).json({ error: e.message })
  }
}