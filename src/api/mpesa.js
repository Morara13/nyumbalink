export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { phone, amount, reference } = req.body

  if (!phone || !amount || !reference) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const response = await fetch('https://sandbox.intasend.com/api/v1/payment/mpesa-stk-push/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.VITE_INTASEND_SECRET_KEY
      },
      body: JSON.stringify({
        phone_number: phone,
        amount: amount,
        narrative: reference
      })
    })

    const data = await response.json()

    if (data.invoice) {
      return res.status(200).json({ success: true, invoice_id: data.invoice.invoice_id })
    } else {
      return res.status(400).json({ error: data.detail || 'Payment failed' })
    }
  } catch (e) {
    return res.status(500).json({ error: 'Server error' })
  }
}