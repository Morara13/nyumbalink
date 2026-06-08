import { useState, useEffect } from 'react'
import { db } from './firebase'
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth'
import { collection, addDoc, getDocs, orderBy, query, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const auth = getAuth()
const MPESA_NUMBER = "0724380481"
const LISTING_DAYS = 30
const ADMIN_EMAIL = "kodikenya254@gmail.com"
const MAX_FILE_SIZE_MB = 5
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']

function isValidKenyanPhone(phone) {
  const cleaned = phone.replace(/\s+/g, '')
  return /^(07|01)\d{8}$/.test(cleaned)
}

function sanitize(str) {
  return String(str || '').replace(/[<>{}]/g, '').trim().substring(0, 500)
}

function daysLeft(createdAt) {
  if (!createdAt) return 0
  const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt)
  const diff = LISTING_DAYS - Math.floor((Date.now() - created.getTime()) / 86400000)
  return Math.max(0, diff)
}

function isExpired(createdAt) {
  return daysLeft(createdAt) === 0
}

function validateImages(files) {
  const errors = []
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) errors.push(`${file.name} is not a valid image type. Use JPG, PNG or WEBP.`)
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) errors.push(`${file.name} is too large. Max size is ${MAX_FILE_SIZE_MB}MB.`)
  }
  return errors
}

function normalizeSearch(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

// ── Dynamic page title for SEO ────────────────────────────────────────────────
function usePageTitle(page) {
  useEffect(() => {
    const titles = {
      home: 'Kodi254 — Find Houses & Rentals in Kenya',
      search: 'Search Properties — Kodi254',
      list: 'List Your Property — Kodi254',
      dashboard: 'My Listings — Kodi254',
      admin: 'Admin Panel — Kodi254',
      auth: 'Landlord Login — Kodi254',
      terms: 'Terms & Conditions — Kodi254',
    }
    document.title = titles[page] || 'Kodi254 — Find Houses & Rentals in Kenya'
  }, [page])
}

async function uploadImage(file) {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", "kodi254_preset")
  const res = await fetch("https://api.cloudinary.com/v1_1/dg4dwedsi/image/upload", { method: "POST", body: formData })
  const data = await res.json()
  if (!data.secure_url) throw new Error('Image upload failed')
  return data.secure_url
}

async function getCoordinates(address, location) {
  const queries = [address + ', ' + location + ', Kenya', location + ', Kenya']
  for (const q of queries) {
    try {
      const res = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q) + '&format=json&limit=1&countrycodes=ke', { headers: { 'Accept-Language': 'en' } })
      const data = await res.json()
      if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    } catch (e) { console.error('Geocoding error:', e) }
  }
  return { lat: -0.6831, lng: 37.0 }
}

// ── Skeleton Loader ───────────────────────────────────────────────────────────
function ListingSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm mb-4 border border-gray-100 overflow-hidden animate-pulse">
      <div className="w-full h-52 bg-gray-200" />
      <div className="p-4">
        <div className="flex justify-between mb-3">
          <div className="h-5 bg-gray-200 rounded-lg w-2/3" />
          <div className="h-5 bg-gray-200 rounded-lg w-1/5" />
        </div>
        <div className="h-4 bg-gray-200 rounded-lg w-1/2 mb-3" />
        <div className="flex gap-2 mb-3">
          <div className="h-6 bg-gray-200 rounded-lg w-12" />
          <div className="h-6 bg-gray-200 rounded-lg w-12" />
          <div className="h-6 bg-gray-200 rounded-lg w-12" />
        </div>
        <div className="h-11 bg-gray-200 rounded-xl w-full" />
      </div>
    </div>
  )
}

// ── 404 Not Found Page ────────────────────────────────────────────────────────
function NotFoundPage({ onGoHome }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="text-8xl mb-6">🏚️</div>
        <h1 className="text-3xl font-black text-gray-900 mb-3">Page Not Found</h1>
        <p className="text-gray-500 mb-2">Looks like this page packed up and moved.</p>
        <p className="text-gray-400 text-sm mb-8">The page you are looking for does not exist or has been moved.</p>
        <button
          onClick={onGoHome}
          className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 w-full"
        >
          🏠 Back to Home
        </button>
        
          href="https://wa.me/254724380481"
          target="_blank"
          rel="noreferrer"
          className="block mt-3 text-green-600 text-sm underline"
        >
          Need help? Chat with us on WhatsApp
        </a>
      </div>
    </div>
  )
}

// ── Terms Page ────────────────────────────────────────────────────────────────
function TermsPage({ onClose }) {
  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 pb-16">
        <div className="flex items-center gap-3 mb-8 sticky top-0 bg-white py-4 border-b border-gray-100">
          <button onClick={onClose} className="bg-gray-100 rounded-full w-9 h-9 flex items-center justify-center text-gray-500">✕</button>
          <div>
            <h1 className="text-xl font-black text-gray-900">Terms & Conditions</h1>
            <p className="text-gray-400 text-xs">Last updated: June 2026</p>
          </div>
        </div>
        <div className="space-y-6 text-gray-600 text-sm leading-relaxed">
          <div>
            <h2 className="font-bold text-gray-900 mb-2">1. About Kodi254</h2>
            <p>Kodi254 is a property listing platform that connects tenants with landlords across Kenya. We are not a real estate agent. We do not own, manage, or inspect any of the properties listed on our platform.</p>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 mb-2">2. For Tenants — Viewing Fee</h2>
            <p className="mb-2">To receive a landlord's contact information, tenants pay a one-time viewing fee of <strong>KES 250</strong> via M-Pesa. This fee is:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Non-refundable</strong> once the landlord's contact has been sent to you</li>
              <li>Used to verify serious interest and cover our operational costs</li>
              <li>Not a deposit or booking fee for the property itself</li>
            </ul>
            <p className="mt-2">After payment is verified, you will receive the landlord's WhatsApp number within <strong>30 minutes</strong>. If we are unable to deliver the contact within 2 hours, you may request a refund by contacting us on WhatsApp.</p>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 mb-2">3. For Landlords — Listing Fee</h2>
            <p className="mb-2">To list a property, landlords pay a listing fee via M-Pesa:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>KES 300</strong> for long-stay rentals</li>
              <li><strong>KES 500</strong> for short-stay / Airbnb-style listings</li>
            </ul>
            <p className="mt-2">Listings stay live for <strong>30 days</strong> from the date of approval. The listing fee is non-refundable once your listing has been approved and published.</p>
            <p className="mt-2">Kodi254 reserves the right to reject any listing that contains false information, inappropriate content, or does not meet our standards.</p>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 mb-2">4. Payment Verification</h2>
            <p>All payments are processed via M-Pesa through IntaSend. After paying, you are required to send your M-Pesa confirmation code to our WhatsApp number <strong>{MPESA_NUMBER}</strong> as proof of payment. We manually verify every payment before delivering services.</p>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 mb-2">5. Accuracy of Listings</h2>
            <p>Landlords are solely responsible for the accuracy of their listings. Kodi254 does not verify property details, ownership, or availability. We strongly advise tenants to physically visit and inspect any property before making any payments to a landlord.</p>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 mb-2">6. Prohibited Content</h2>
            <p>The following are strictly prohibited on Kodi254:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Fake or duplicate listings</li>
              <li>Properties you do not own or have authority to list</li>
              <li>Misleading photos or descriptions</li>
              <li>Listings intended to defraud tenants</li>
            </ul>
            <p className="mt-2">Violations will result in immediate removal of the listing without refund and may be reported to relevant authorities.</p>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 mb-2">7. Limitation of Liability</h2>
            <p>Kodi254 is a platform only. We are not liable for any disputes, losses, or damages arising from transactions between landlords and tenants. Use this platform at your own risk and exercise due diligence before making any financial commitments.</p>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 mb-2">8. Contact Us</h2>
            <p>For any questions, disputes, or refund requests, contact us at:</p>
            <p className="mt-2"><strong>WhatsApp:</strong> {MPESA_NUMBER}</p>
            <p><strong>Email:</strong> kodikenya254@gmail.com</p>
          </div>
        </div>
        <button onClick={onClose} className="w-full mt-8 bg-green-600 text-white py-4 rounded-2xl font-bold">Close</button>
      </div>
    </div>
  )
}

// ── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ listing, onClose }) {
  const isAirbnb = listing.type === 'airbnb'
  const fee = isAirbnb ? listing.price : 250
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mpesaCode, setMpesaCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [showTerms, setShowTerms] = useState(false)

  const triggerSTK = async () => {
    if (!isValidKenyanPhone(phone)) { setError('Enter a valid Kenyan number e.g. 0712 345 678'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/mpesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/\s+/g, ''), amount: fee, reference: 'Kodi254 - ' + listing.title })
      })
      const data = await res.json()
      if (data.success) { setStep(2) } else { setError(data.error || 'Payment failed. Try again.') }
    } catch (e) { setError('Network error. Check your connection.') }
    setLoading(false)
  }

  const waLink = `https://wa.me/254${MPESA_NUMBER.substring(1)}?text=Hi Kodi254, I paid KES ${fee} for *${listing.title}* in ${listing.location}. M-Pesa code: ${mpesaCode}. My number: ${phone}`

  const handleSendProof = () => {
    if (!mpesaCode || mpesaCode.length < 6) { setError('Please enter your M-Pesa confirmation code before sending'); return }
    setCodeSent(true); setError('')
  }

  return (
    <>
      {showTerms && <TermsPage onClose={() => setShowTerms(false)} />}
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end sm:items-center justify-center z-50 p-4">
        <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-screen overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{isAirbnb ? '🏨 Book Your Stay' : '🏠 Request Viewing'}</h3>
                <p className="text-gray-500 text-sm mt-1">{listing.title} · {listing.location}</p>
              </div>
              <button onClick={onClose} className="bg-gray-100 rounded-full w-9 h-9 flex items-center justify-center text-gray-500 text-lg">✕</button>
            </div>
            {step === 1 && (
              <div>
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5">
                  <p className="text-gray-500 text-sm mb-1">Amount to pay</p>
                  <p className="text-3xl font-black text-green-700">KES {fee.toLocaleString()}</p>
                  <p className="text-green-600 text-xs mt-1">{isAirbnb ? 'Full booking amount' : 'One-time viewing fee — non-refundable'}</p>
                </div>
                <label className="block text-gray-700 font-semibold mb-2 text-sm">Your M-Pesa Number</label>
                <input className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 text-lg focus:outline-none focus:border-green-400 mb-1" placeholder="0712 345 678" value={phone} onChange={e => { setPhone(e.target.value); setError('') }} type="tel" maxLength={12} />
                <p className="text-gray-400 text-xs mb-4">Safaricom number starting with 07 or 01</p>
                {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}
                <button onClick={triggerSTK} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50">
                  {loading ? '⏳ Sending prompt...' : `Pay KES ${fee.toLocaleString()} via M-Pesa 📱`}
                </button>
                <p className="text-center text-gray-400 text-xs mt-3">🔒 Secured by IntaSend · Prompt sent to your phone</p>
                <p className="text-center text-xs mt-2">
                  <button onClick={() => setShowTerms(true)} className="text-green-600 underline">View Terms & Conditions</button>
                </p>
              </div>
            )}
            {step === 2 && (
              <div>
                <div className="text-center mb-5">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">📲</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Check your phone!</h3>
                  <p className="text-gray-500 text-sm">M-Pesa prompt sent to <strong>{phone}</strong></p>
                  <p className="text-gray-500 text-sm">Enter your PIN to complete payment.</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5">
                  <p className="text-amber-800 font-semibold text-sm mb-1">⚠️ Required — don't skip</p>
                  <p className="text-amber-700 text-sm">Enter your M-Pesa confirmation code below, then send proof on WhatsApp.</p>
                </div>
                <label className="block text-gray-700 font-semibold mb-2 text-sm">M-Pesa Confirmation Code <span className="text-red-500">*</span></label>
                <input className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-lg focus:outline-none focus:border-green-400 mb-2 uppercase" placeholder="e.g. QGH7X8Y9Z0" value={mpesaCode} onChange={e => { setMpesaCode(e.target.value.toUpperCase()); setError('') }} maxLength={12} />
                <p className="text-gray-400 text-xs mb-4">You will find this code in the M-Pesa SMS after paying</p>
                {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}
                {!codeSent ? (
                  <button onClick={handleSendProof} className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg mb-3">✅ Confirm Payment Code</button>
                ) : (
                  <a href={waLink} target="_blank" rel="noreferrer" onClick={() => setStep(3)} className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg block text-center mb-3">📱 Send Proof on WhatsApp</a>
                )}
              </div>
            )}
            {step === 3 && (
              <div className="text-center py-4">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">⏳</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">You are all set!</h3>
                <p className="text-gray-500 mb-4">We are verifying your payment. Landlord contact will be sent to your WhatsApp within <strong>30 minutes</strong>.</p>
                <div className="bg-green-50 border border-green-100 rounded-2xl p-4 mb-5">
                  <p className="text-green-700 text-sm">Need help? WhatsApp <strong>{MPESA_NUMBER}</strong></p>
                </div>
                <button onClick={onClose} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-lg">Done 👍</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Landlord Payment Modal ────────────────────────────────────────────────────
function LandlordPaymentModal({ listingType, formData, onSuccess, onClose }) {
  const fee = listingType === 'airbnb' ? 500 : 300
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mpesaCode, setMpesaCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)

  const triggerSTK = async () => {
    if (!isValidKenyanPhone(phone)) { setError('Enter a valid Kenyan number e.g. 0712 345 678'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/mpesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/\s+/g, ''), amount: fee, reference: 'Kodi254 Listing Fee' })
      })
      const data = await res.json()
      if (data.success) { setStep(2) } else { setError(data.error || 'Payment failed. Try again.') }
    } catch (e) { setError('Network error. Check your connection.') }
    setLoading(false)
  }

  const waLink = `https://wa.me/254${MPESA_NUMBER.substring(1)}?text=Hi Kodi254, I paid KES ${fee} listing fee for *${formData?.title}* in ${formData?.location}. M-Pesa code: ${mpesaCode}. My number: ${phone}`

  const handleConfirmCode = () => {
    if (!mpesaCode || mpesaCode.length < 6) { setError('Please enter your M-Pesa confirmation code'); return }
    setCodeSent(true); setError('')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-screen overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-xl font-bold text-gray-900">💳 Listing Fee</h3>
              <p className="text-gray-500 text-sm mt-1">{listingType === 'airbnb' ? 'Short Stay · 30 days' : 'Rental · 30 days'}</p>
            </div>
            <button onClick={onClose} className="bg-gray-100 rounded-full w-9 h-9 flex items-center justify-center text-gray-500 text-lg">✕</button>
          </div>
          {step === 1 && (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5">
                <p className="text-gray-500 text-sm mb-1">One-time listing fee</p>
                <p className="text-3xl font-black text-blue-700">KES {fee.toLocaleString()}</p>
                <p className="text-blue-600 text-xs mt-1">Your listing stays live for 30 days after approval</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-3 mb-4">
                <p className="text-yellow-800 text-xs">⚡ Goes live within 30 minutes after payment verification.</p>
              </div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">Your M-Pesa Number</label>
              <input className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 text-lg focus:outline-none focus:border-green-400 mb-1" placeholder="0712 345 678" value={phone} onChange={e => { setPhone(e.target.value); setError('') }} type="tel" maxLength={12} />
              <p className="text-gray-400 text-xs mb-4">Safaricom number starting with 07 or 01</p>
              {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}
              <button onClick={triggerSTK} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50">
                {loading ? '⏳ Sending prompt...' : `Pay KES ${fee.toLocaleString()} via M-Pesa 📱`}
              </button>
              <p className="text-center text-gray-400 text-xs mt-3">🔒 Secured by IntaSend</p>
            </div>
          )}
          {step === 2 && (
            <div>
              <div className="text-center mb-5">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">📲</div>
                <h3 className="text-xl font-bold mb-2">Check your phone!</h3>
                <p className="text-gray-500 text-sm">Prompt sent to <strong>{phone}</strong>. Enter your PIN.</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5">
                <p className="text-amber-800 font-semibold text-sm mb-1">⚠️ Required — don't skip</p>
                <p className="text-amber-700 text-sm">Enter your M-Pesa code and send proof on WhatsApp. We approve your listing within 30 minutes.</p>
              </div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">M-Pesa Confirmation Code <span className="text-red-500">*</span></label>
              <input className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-lg focus:outline-none focus:border-green-400 mb-2 uppercase" placeholder="e.g. QGH7X8Y9Z0" value={mpesaCode} onChange={e => { setMpesaCode(e.target.value.toUpperCase()); setError('') }} maxLength={12} />
              <p className="text-gray-400 text-xs mb-4">Check your M-Pesa SMS for this code</p>
              {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}
              {!codeSent ? (
                <button onClick={handleConfirmCode} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg mb-3">✅ Confirm Payment Code</button>
              ) : (
                <a href={waLink} target="_blank" rel="noreferrer" onClick={() => setStep(3)} className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg block text-center mb-3">📱 Send Proof on WhatsApp</a>
              )}
            </div>
          )}
          {step === 3 && (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">✅</div>
              <h3 className="text-xl font-bold mb-2">Payment submitted!</h3>
              <p className="text-gray-500 mb-5">Your listing will go live within 30 minutes after payment verification.</p>
              <button onClick={onSuccess} className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg">Submit My Listing 🚀</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Listing Card ──────────────────────────────────────────────────────────────
function ListingCard({ listing }) {
  const [showPayment, setShowPayment] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [imgIndex, setImgIndex] = useState(0)
  const isAirbnb = listing.type === 'airbnb'
  const position = listing.lat && listing.lng ? [listing.lat, listing.lng] : [-0.6831, 37.0]
  const images = Array.isArray(listing.images) ? listing.images.filter(img => typeof img === 'string' && img.trim().length > 0) : []

  return (
    <div className="bg-white rounded-2xl shadow-sm mb-4 border border-gray-100 overflow-hidden">
      {showPayment && <PaymentModal listing={listing} onClose={() => setShowPayment(false)} />}
      {images.length > 0 ? (
        <div className="relative w-full h-52 bg-gray-100">
          <img src={images[imgIndex]} alt={listing.title} className="w-full h-full object-cover" onError={e => e.target.style.display = 'none'} />
          {images.length > 1 && (
            <>
              <button type="button" onClick={e => { e.stopPropagation(); setImgIndex(p => p === 0 ? images.length - 1 : p - 1) }} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center z-10">❮</button>
              <button type="button" onClick={e => { e.stopPropagation(); setImgIndex(p => p === images.length - 1 ? 0 : p + 1) }} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center z-10">❯</button>
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">{imgIndex + 1}/{images.length}</div>
            </>
          )}
          {isAirbnb && <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs px-3 py-1 rounded-full font-medium">🏨 Short Stay</div>}
          {listing.status === 'taken' && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="bg-white text-gray-700 font-bold px-4 py-2 rounded-full">Not Available</span></div>}
        </div>
      ) : (
        <div className="w-full h-36 bg-gradient-to-br from-green-100 to-emerald-50 flex flex-col items-center justify-center">
          <span className="text-5xl mb-1">{isAirbnb ? '🏨' : '🏠'}</span>
          <span className="text-gray-400 text-xs">No photos</span>
        </div>
      )}
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-gray-900 flex-1 pr-3">{listing.title}</h3>
          <div className="text-right flex-shrink-0">
            <p className={isAirbnb ? "text-orange-600 font-black" : "text-green-700 font-black"}>KES {Number(listing.price).toLocaleString()}</p>
            <p className="text-gray-400 text-xs">{isAirbnb ? 'per night' : 'per month'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
          <span>📍 {listing.location}</span>
          <span className="text-gray-300">·</span>
          <span>🛏 {listing.bedrooms} bed{listing.bedrooms > 1 ? 's' : ''}</span>
        </div>
        {listing.amenities && listing.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {listing.amenities.slice(0, 4).map((a, i) => <span key={i} className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-lg">{a}</span>)}
            {listing.amenities.length > 4 && <span className="bg-gray-100 text-gray-400 text-xs px-2 py-1 rounded-lg">+{listing.amenities.length - 4} more</span>}
          </div>
        )}
        {listing.description && (
          <p className="text-gray-500 text-sm mb-3 leading-relaxed">
            {expanded ? listing.description : listing.description.substring(0, 90) + (listing.description.length > 90 ? '...' : '')}
            {listing.description.length > 90 && <button onClick={() => setExpanded(!expanded)} className="text-green-600 font-medium ml-1">{expanded ? 'less' : 'more'}</button>}
          </p>
        )}
        {listing.status !== 'taken' ? (
          <button onClick={() => setShowPayment(true)} className={isAirbnb ? "w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold text-sm" : "w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-sm"}>
            {isAirbnb ? '🏨 Book Now' : '🔍 Request Viewing · KES 250'}
          </button>
        ) : (
          <div className="w-full bg-gray-100 text-gray-400 py-3 rounded-xl text-center text-sm">Not Available</div>
        )}
        <button onClick={() => setExpanded(!expanded)} className="w-full mt-2 text-gray-300 text-xs py-1 hover:text-gray-400">{expanded ? '▲ collapse' : '▼ show map'}</button>
        {expanded && (
          <div style={{ height: '180px', borderRadius: '12px', overflow: 'hidden', marginTop: '8px' }}>
            <MapContainer center={position} zoom={listing.lat ? 15 : 6} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={position}><Popup><strong>{listing.title}</strong><br />📍 {listing.location}</Popup></Marker>
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Admin Panel ───────────────────────────────────────────────────────────────
function AdminPanel({ user, allListings, onUpdate }) {
  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-3">🚫</div>
        <p className="text-gray-700 font-bold">Access Denied</p>
        <p className="text-gray-400 text-sm mt-1">You don't have permission to view this page.</p>
      </div>
    )
  }

  const pending = allListings.filter(l => l.status === 'pending')
  const active = allListings.filter(l => l.status === 'available' && !isExpired(l.createdAt))
  const expired = allListings.filter(l => l.status === 'available' && isExpired(l.createdAt))
  const taken = allListings.filter(l => l.status === 'taken')

  const approve = async (listing) => {
    await updateDoc(doc(db, 'listings', listing.id), { status: 'available' })
    onUpdate()
  }
  const reject = async (listing) => {
    if (window.confirm('Reject and delete this listing?')) {
      await deleteDoc(doc(db, 'listings', listing.id))
      onUpdate()
    }
  }

  return (
    <div className="py-4">
      <div className="mb-6">
        <h2 className="text-xl font-black text-gray-900">Admin Panel</h2>
        <p className="text-gray-400 text-sm">Manage all listings and payments</p>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-6">
        <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-3 text-center">
          <p className="text-2xl font-black text-yellow-600">{pending.length}</p>
          <p className="text-yellow-700 text-xs font-medium">Pending</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-2xl p-3 text-center">
          <p className="text-2xl font-black text-green-600">{active.length}</p>
          <p className="text-green-700 text-xs font-medium">Active</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
          <p className="text-2xl font-black text-red-600">{taken.length}</p>
          <p className="text-red-700 text-xs font-medium">Taken</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 text-center">
          <p className="text-2xl font-black text-gray-500">{expired.length}</p>
          <p className="text-gray-500 text-xs font-medium">Expired</p>
        </div>
      </div>
      {pending.length > 0 ? (
        <div className="mb-6">
          <h3 className="font-bold text-gray-700 mb-3 text-sm">⏳ Awaiting Approval ({pending.length})</h3>
          {pending.map(listing => (
            <div key={listing.id} className="bg-white rounded-2xl border border-yellow-200 p-4 mb-3">
              {Array.isArray(listing.images) && listing.images.length > 0 && (
                <img src={listing.images[0]} alt="house" className="w-full h-32 object-cover rounded-xl mb-3" onError={e => e.target.style.display = 'none'} />
              )}
              <h4 className="font-bold text-gray-900 mb-1">{listing.title}</h4>
              <p className="text-gray-400 text-sm mb-1">📍 {listing.location}{listing.address ? ' · ' + listing.address : ''}</p>
              <p className="text-gray-500 text-sm mb-1">👤 {listing.landlordEmail}</p>
              <p className="text-gray-500 text-sm mb-1">📱 {listing.phone}</p>
              <p className="text-gray-700 font-bold text-sm mb-1">KES {Number(listing.price).toLocaleString()}{listing.type === 'airbnb' ? '/night' : '/month'}</p>
              {listing.description && <p className="text-gray-400 text-xs mb-3 leading-relaxed">{listing.description.substring(0, 150)}{listing.description.length > 150 ? '...' : ''}</p>}
              <div className="flex gap-2">
                <button onClick={() => approve(listing)} className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-bold">✅ Approve</button>
                <button onClick={() => reject(listing)} className="flex-1 bg-red-50 text-red-600 py-2 rounded-xl text-sm font-medium border border-red-200">❌ Reject</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 mb-6">
          <div className="text-3xl mb-2">🎉</div>
          <p className="text-gray-500 text-sm">No pending listings!</p>
        </div>
      )}
      {active.length > 0 && (
        <>
          <h3 className="font-bold text-gray-700 mb-3 text-sm">✅ Active Listings ({active.length})</h3>
          {active.map(listing => (
            <div key={listing.id} className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 text-sm">{listing.title}</h4>
                  <p className="text-gray-400 text-xs">📍 {listing.location} · {listing.landlordEmail}</p>
                  <p className="text-gray-400 text-xs">⏳ {daysLeft(listing.createdAt)} days left · KES {Number(listing.price).toLocaleString()}</p>
                </div>
                <button onClick={() => reject(listing)} className="text-gray-300 text-sm ml-2 hover:text-red-400">🗑</button>
              </div>
            </div>
          ))}
        </>
      )}
      {expired.length > 0 && (
        <>
          <h3 className="font-bold text-gray-500 mb-3 text-sm mt-4">⌛ Expired Listings ({expired.length})</h3>
          {expired.map(listing => (
            <div key={listing.id} className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-3 opacity-60">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-700 text-sm">{listing.title}</h4>
                  <p className="text-gray-400 text-xs">📍 {listing.location} · {listing.landlordEmail}</p>
                  <p className="text-red-400 text-xs font-medium">Expired</p>
                </div>
                <button onClick={() => reject(listing)} className="text-gray-300 text-sm ml-2 hover:text-red-400">🗑</button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ── Landlord Dashboard ────────────────────────────────────────────────────────
function LandlordDashboard({ user, allListings, onUpdate }) {
  const myListings = allListings.filter(l => l.landlordEmail === user.email)
  const waSupport = `https://wa.me/254${MPESA_NUMBER.substring(1)}?text=Hi Kodi254 support, I need help with my listing. My email: ${user.email}`

  const toggleStatus = async (listing) => {
    if (listing.landlordEmail !== user.email) { alert('Unauthorized action.'); return }
    const newStatus = listing.status === 'taken' ? 'available' : 'taken'
    if (newStatus === 'taken') {
      if (!window.confirm('Mark this listing as Taken? Tenants will no longer see it as available.')) return
    }
    await updateDoc(doc(db, 'listings', listing.id), { status: newStatus })
    onUpdate()
  }

  const deleteListing = async (listing) => {
    if (listing.landlordEmail !== user.email) { alert('Unauthorized action.'); return }
    if (window.confirm('Permanently delete this listing? This cannot be undone.')) {
      await deleteDoc(doc(db, 'listings', listing.id))
      onUpdate()
    }
  }

  return (
    <div className="py-4">
      <div className="mb-6">
        <h2 className="text-xl font-black text-gray-900">My Listings</h2>
        <p className="text-gray-400 text-sm">{myListings.length} propert{myListings.length !== 1 ? 'ies' : 'y'} listed</p>
      </div>
      {myListings.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <div className="text-5xl mb-3">🏠</div>
          <p className="text-gray-700 font-medium mb-1">No listings yet</p>
          <p className="text-gray-400 text-sm">Add your first property to start earning</p>
        </div>
      )}
      {myListings.map(listing => {
        const imgs = Array.isArray(listing.images) ? listing.images.filter(img => typeof img === 'string' && img.trim().length > 0) : []
        const days = daysLeft(listing.createdAt)
        const expired = days === 0
        const isPending = listing.status === 'pending'
        return (
          <div key={listing.id} className={`bg-white rounded-2xl shadow-sm mb-4 border overflow-hidden ${expired ? 'border-red-200 opacity-60' : isPending ? 'border-yellow-200' : 'border-gray-100'}`}>
            {imgs.length > 0 ? (
              <img src={imgs[0]} alt="house" className="w-full h-44 object-cover" onError={e => e.target.style.display = 'none'} />
            ) : (
              <div className="w-full h-44 bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center text-4xl">
                {listing.type === 'airbnb' ? '🏨' : '🏠'}
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-gray-900 flex-1 pr-2">{listing.title}</h3>
                <span className={isPending ? 'bg-yellow-100 text-yellow-600 text-xs px-3 py-1 rounded-full font-medium flex-shrink-0' : listing.status === 'taken' ? 'bg-red-100 text-red-600 text-xs px-3 py-1 rounded-full font-medium flex-shrink-0' : 'bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-medium flex-shrink-0'}>
                  {isPending ? '⏳ Pending' : listing.status === 'taken' ? 'Taken' : 'Available'}
                </span>
              </div>
              <p className="text-gray-400 text-sm mb-1">📍 {listing.location}</p>
              <p className="text-gray-700 font-bold text-sm mb-2">KES {Number(listing.price).toLocaleString()}{listing.type === 'airbnb' ? '/night' : '/month'}</p>
              {isPending && (
                <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2 mb-3">
                  <p className="text-yellow-700 text-xs font-medium">⏳ Awaiting payment verification — goes live within 30 min</p>
                  <a href={waSupport} target="_blank" rel="noreferrer" className="text-green-600 text-xs font-medium mt-1 block">Need help? Chat with us on WhatsApp →</a>
                </div>
              )}
              {expired && !isPending && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
                  <p className="text-red-600 text-xs font-medium">⚠️ Listing expired — delete and relist to go live again</p>
                </div>
              )}
              {!expired && !isPending && (
                <div className="bg-gray-50 rounded-xl px-3 py-2 mb-3">
                  <p className="text-gray-400 text-xs">⏳ {days} day{days !== 1 ? 's' : ''} remaining</p>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => toggleStatus(listing)} disabled={expired || isPending} className={listing.status === 'taken' ? 'flex-1 bg-green-50 text-green-700 py-2 rounded-xl text-sm font-medium border border-green-200 disabled:opacity-40' : 'flex-1 bg-red-50 text-red-600 py-2 rounded-xl text-sm font-medium border border-red-200 disabled:opacity-40'}>
                  {listing.status === 'taken' ? '✅ Mark Available' : '❌ Mark Taken'}
                </button>
                <button onClick={() => deleteListing(listing)} className="px-4 bg-gray-50 text-gray-400 py-2 rounded-xl text-sm border border-gray-200 hover:bg-red-50 hover:text-red-400 transition-colors">🗑</button>
              </div>
            </div>
          </div>
        )
      })}
      {myListings.length > 0 && (
        <a href={waSupport} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full bg-green-50 border border-green-100 text-green-700 py-3 rounded-2xl text-sm font-medium mt-2">
          💬 Need help? Chat with Kodi254 support
        </a>
      )}
    </div>
  )
}

// ── Auth Page ─────────────────────────────────────────────────────────────────
function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)

  const handleSubmit = async () => {
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (mode === 'login') { await signInWithEmailAndPassword(auth, email, password); onAuth() }
      else { await createUserWithEmailAndPassword(auth, email, password); onAuth() }
    } catch (e) { setError(e.message.replace('Firebase: ', '')) }
    setLoading(false)
  }

  const handleReset = async () => {
    if (!email) { setError('Enter your email first'); return }
    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email)
      setSuccess('Password reset email sent! Check your inbox.')
      setShowReset(false)
    } catch (e) { setError(e.message.replace('Firebase: ', '')) }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏠</div>
          <h2 className="text-2xl font-black text-gray-900">Landlord Portal</h2>
          <p className="text-gray-400 text-sm mt-1">List your property and start earning</p>
        </div>
        <div className="flex mb-6 bg-gray-100 rounded-2xl p-1">
          <button onClick={() => setMode('login')} className={mode === 'login' ? 'flex-1 py-2 rounded-xl bg-white font-bold text-gray-900 shadow-sm' : 'flex-1 py-2 rounded-xl text-gray-400'}>Login</button>
          <button onClick={() => setMode('register')} className={mode === 'register' ? 'flex-1 py-2 rounded-xl bg-white font-bold text-gray-900 shadow-sm' : 'flex-1 py-2 rounded-xl text-gray-400'}>Register</button>
        </div>
        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm">{success}</div>}
        <input className="w-full border-2 border-gray-100 rounded-2xl px-4 py-4 mb-3 focus:outline-none focus:border-green-300 bg-gray-50" placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="w-full border-2 border-gray-100 rounded-2xl px-4 py-4 mb-2 focus:outline-none focus:border-green-300 bg-gray-50" placeholder="Password (min 6 characters)" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        {mode === 'login' && <button onClick={() => setShowReset(true)} className="text-green-600 text-sm mb-4 block">Forgot password?</button>}
        {showReset && (
          <div className="bg-blue-50 rounded-xl p-3 mb-4">
            <p className="text-blue-700 text-sm mb-2">Enter your email above then click:</p>
            <button onClick={handleReset} disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-xl text-sm font-medium">Send Reset Email</button>
          </div>
        )}
        <button onClick={handleSubmit} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-black text-lg disabled:opacity-50 mt-2">
          {loading ? 'Please wait...' : mode === 'login' ? 'Login →' : 'Create Account →'}
        </button>
      </div>
    </div>
  )
}

// ── Home Page ─────────────────────────────────────────────────────────────────
function HomePage({ listings, setPage, setFilter, onShowTerms }) {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  const activeListings = listings.filter(l => l.status === 'available' && !isExpired(l.createdAt))
  const reviews = [
    { name: "Mike", location: "Chuka", emoji: "😊", rating: 5, text: "Niliamua kutumia Kodi254 baada ya kushindwa kupata nyumba kwa wiki mbili. Siku moja tu, nilikuwa na mawasiliano ya mwenye nyumba mzuri Chuka town. Ilikuwa rahisi sana na bei ya kuona nyumba ilikuwa ya chini kabisa." },
    { name: "Masese", location: "Nairobi", emoji: "🙌", rating: 5, text: "Nilikuwa nikiangalia nyumba Nairobi kwa muda mrefu. Agents walikuwa wananiomba pesa nyingi bila kitu. Kodi254 ilinisaidia kupata nyumba bila agent fees. Highly recommended kwa kila mtu!" },
    { name: "Brandon", location: "Kisii", emoji: "👏", rating: 5, text: "I listed my house on Kodi254 and within 3 days I already had a serious tenant contacting me. The platform is straightforward and the M-Pesa payment system makes everything smooth. Worth every shilling." },
    { name: "Mong'ina", location: "Kisii", emoji: "🎉", rating: 5, text: "Nilikuwa na nyumba yangu ikiwa wazi kwa miezi miwili. Baada ya kuweka kwenye Kodi254, nilipata mpangaji ndani ya wiki moja tu. Bei ya kuweka listing ni ya chini sana ukilinganisha na faida unayopata." },
  ]

  return (
    <div className="bg-gray-50">
      <div className="bg-white border-b border-gray-100 sticky top-16 z-30 overflow-x-auto">
        <div className="flex px-4 py-2 max-w-4xl mx-auto">
          {[['hero','Home'],['how','How it Works'],['features','Features'],['contact','Contact'],['reviews','Reviews']].map(([id, label]) => (
            <button key={id} onClick={() => scrollTo(id)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-green-50 hover:text-green-700 whitespace-nowrap transition-colors">{label}</button>
          ))}
        </div>
      </div>

      <div id="hero" className="bg-green-700 text-white py-16 px-4 text-center">
        <p className="text-green-300 text-sm font-medium mb-3">🇰🇪 Kenya's Property Platform</p>
        <h1 className="text-4xl font-black mb-4 leading-tight">Find Your Perfect<br/>Home in Kenya</h1>
        <p className="text-green-100 text-base mb-10 max-w-sm mx-auto">Connect directly with landlords. No agents, no hidden fees, no stress.</p>
        <div className="flex justify-center gap-3 flex-wrap mb-12">
          <button onClick={() => { setPage('search'); setFilter('rental') }} className="bg-white text-green-700 px-7 py-3 rounded-2xl font-bold shadow-lg hover:bg-green-50 transition-all">🏠 Find Rental</button>
          <button onClick={() => { setPage('search'); setFilter('airbnb') }} className="bg-orange-500 text-white px-7 py-3 rounded-2xl font-bold shadow-lg hover:bg-orange-600 transition-all">🏨 Short Stays</button>
        </div>
        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
          <div className="bg-white rounded-2xl p-4 shadow-md"><p className="text-2xl font-black text-green-700">{activeListings.length}+</p><p className="text-gray-600 text-xs font-medium mt-1">Active Listings</p></div>
          <div className="bg-white rounded-2xl p-4 shadow-md"><p className="text-2xl font-black text-green-700">0%</p><p className="text-gray-600 text-xs font-medium mt-1">Agent Fees</p></div>
          <div className="bg-white rounded-2xl p-4 shadow-md"><p className="text-2xl font-black text-green-700">47</p><p className="text-gray-600 text-xs font-medium mt-1">Counties</p></div>
        </div>
      </div>

      <div id="how" className="py-14 px-4 bg-white scroll-mt-32">
        <div className="max-w-2xl mx-auto">
          <p className="text-green-600 font-semibold text-center text-sm mb-2">Simple & Fast</p>
          <h2 className="text-2xl font-black text-center text-gray-900 mb-10">How Kodi254 Works</h2>
          <div className="space-y-7">
            {[
              ['🔍', 'Search & Browse', 'Browse verified listings across Kenya. Filter by town, price and type.'],
              ['📱', 'Pay via M-Pesa', 'Pay KES 250 via M-Pesa STK Push — a prompt comes straight to your phone.'],
              ['📞', 'Get Landlord Contact', "We send you the landlord's WhatsApp number within 30 minutes. No middlemen."],
            ].map(([icon, title, desc], i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="bg-green-50 rounded-2xl w-14 h-14 flex items-center justify-center text-2xl flex-shrink-0 border border-green-100">{icon}</div>
                <div className="pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-green-600 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">{i + 1}</span>
                    <h3 className="font-bold text-gray-900">{title}</h3>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id="features" className="py-14 px-4 bg-gray-50 scroll-mt-32">
        <div className="max-w-2xl mx-auto">
          <p className="text-green-600 font-semibold text-center text-sm mb-2">Why Us</p>
          <h2 className="text-2xl font-black text-center text-gray-900 mb-10">Built for Kenya 🇰🇪</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['🔒', 'Verified Landlords', 'Every landlord pays to list. No fake listings.'],
              ['💸', 'Zero Agent Fees', 'Talk directly to the owner. Save months of rent.'],
              ['📲', 'M-Pesa STK Push', 'No manual transfers. Prompt comes to your phone.'],
              ['🏨', 'Short Stays Too', 'Weekend getaway? Find Airbnb-style stays.'],
              ['🗺️', 'Accurate Map', 'See the exact property location on the map.'],
              ['⚡', 'Fast & Simple', 'Find a house in under 5 minutes.'],
            ].map(([icon, title, desc]) => (
              <div key={title} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="text-2xl mb-2">{icon}</div>
                <h3 className="font-bold text-gray-900 text-sm mb-1">{title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id="contact" className="py-14 px-4 bg-white scroll-mt-32">
        <div className="max-w-md mx-auto">
          <p className="text-green-600 font-semibold text-center text-sm mb-2">Get in Touch</p>
          <h2 className="text-2xl font-black text-center text-gray-900 mb-3">We Are Here to Help</h2>
          <p className="text-gray-500 text-center text-sm mb-8">Have a question? Reach out directly — we reply fast.</p>
          <div className="bg-green-50 rounded-3xl p-6 border border-green-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black">H</div>
              <div>
                <p className="font-bold text-gray-900">Handson Morara</p>
                <p className="text-gray-500 text-sm">Founder, Kodi254</p>
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <p className="text-green-600 text-xs">Usually replies in 30 min</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <a href="https://wa.me/254724380481" target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-green-600 text-white px-5 py-4 rounded-2xl font-semibold hover:bg-green-700 transition-colors">
                <span className="text-2xl">📱</span>
                <div><p className="font-bold text-sm">Chat on WhatsApp</p><p className="text-green-200 text-xs">0724 380 481</p></div>
              </a>
              <a href="mailto:kodikenya254@gmail.com" className="flex items-center gap-3 bg-white text-gray-700 px-5 py-4 rounded-2xl font-semibold border border-gray-200 hover:bg-gray-50 transition-colors">
                <span className="text-2xl">✉️</span>
                <div><p className="font-bold text-sm">Send an Email</p><p className="text-gray-400 text-xs">kodikenya254@gmail.com</p></div>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div id="reviews" className="py-14 px-4 bg-gray-50 scroll-mt-32">
        <div className="max-w-2xl mx-auto">
          <p className="text-green-600 font-semibold text-center text-sm mb-2">Real Stories</p>
          <h2 className="text-2xl font-black text-center text-gray-900 mb-3">What People Are Saying</h2>
          <p className="text-gray-500 text-center text-sm mb-8">From tenants and landlords across Kenya</p>
          <div className="space-y-4">
            {reviews.map((r, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">{r.name[0]}</div>
                    <div><p className="font-bold text-gray-900 text-sm">{r.name} {r.emoji}</p><p className="text-gray-400 text-xs">📍 {r.location}</p></div>
                  </div>
                  <p className="text-yellow-400 text-sm">{'⭐'.repeat(r.rating)}</p>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gray-900 text-white py-10 px-4 text-center">
        <p className="text-2xl font-black mb-1">Kodi254</p>
        <p className="text-gray-400 text-sm mb-1">Kenya's trusted property platform</p>
        <p className="text-gray-500 text-xs mb-4">kodikenya254@gmail.com · 0724 380 481</p>
        <button onClick={onShowTerms} className="text-gray-500 text-xs underline hover:text-gray-300 mb-6 block mx-auto">Terms & Conditions</button>
        <div className="border-t border-gray-800 pt-4 flex justify-center gap-6 text-gray-500 text-xs">
          <span>© 2026 Kodi254</span>
          <span>Made with ❤️ in Kenya</span>
        </div>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState('home')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ title: '', location: '', address: '', price: '', bedrooms: '1', phone: '', description: '', type: 'rental' })
  const [amenities, setAmenities] = useState([])
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [images, setImages] = useState([])
  const [previews, setPreviews] = useState([])
  const [uploadProgress, setUploadProgress] = useState('')
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [showLandlordPayment, setShowLandlordPayment] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const amenityOptions = ['WiFi', 'Parking', 'Kitchen', 'TV', 'AC', 'Washer', 'Pool', 'Gym', 'Security', 'Water', 'Generator']
  const isAdmin = user?.email === ADMIN_EMAIL

  // Dynamic page titles for SEO
  usePageTitle(page)

  useEffect(() => { onAuthStateChanged(auth, (u) => { setUser(u); setAuthChecked(true) }) }, [])

  const fetchListings = async () => {
    try {
      const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      setListings(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchListings() }, [])

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 5)
    const errors = validateImages(files)
    if (errors.length > 0) { alert(errors.join('\n')); e.target.value = ''; return }
    setImages(files)
    setPreviews(files.map(f => URL.createObjectURL(f)))
  }

  const toggleAmenity = (a) => setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])

  const filtered = listings.filter(l => {
    if (l.status === 'pending') return false
    if (isExpired(l.createdAt)) return false
    const q = normalizeSearch(search)
    if (q) {
      const inLocation = normalizeSearch(l.location).includes(q)
      const inTitle = normalizeSearch(l.title).includes(q)
      const inAddress = normalizeSearch(l.address || '').includes(q)
      if (!inLocation && !inTitle && !inAddress) return false
    }
    const matchFilter = filter === 'all' || (filter === 'rental' && l.type !== 'airbnb') || (filter === 'airbnb' && l.type === 'airbnb')
    return matchFilter
  })

  const handleSubmit = async () => {
    if (!form.title || !form.location || !form.price || !form.phone) { alert('Please fill all required fields!'); return }
    if (!isValidKenyanPhone(form.phone)) { alert('Enter a valid Kenyan WhatsApp number e.g. 0712 345 678'); return }
    if (parseInt(form.price) < 100) { alert('Price must be at least KES 100'); return }
    const myPendingCount = listings.filter(l => l.landlordEmail === user?.email && l.status === 'pending').length
    if (myPendingCount >= 3) { alert('You have too many pending listings. Wait for approval before submitting more.'); return }
    setShowLandlordPayment(true)
  }

  const submitListing = async () => {
    setShowLandlordPayment(false)
    setSubmitting(true)
    try {
      let imageUrls = []
      for (let i = 0; i < images.length; i++) {
        setUploadProgress('Uploading photo ' + (i + 1) + ' of ' + images.length + '...')
        imageUrls.push(await uploadImage(images[i]))
      }
      setUploadProgress('Getting location...')
      const coords = await getCoordinates(form.address || '', form.location || '')
      setUploadProgress('Saving listing...')
      const newListing = {
        title: sanitize(form.title),
        location: sanitize(form.location),
        address: sanitize(form.address),
        price: parseInt(form.price) || 0,
        bedrooms: parseInt(form.bedrooms) || 1,
        phone: form.phone.replace(/\s+/g, ''),
        description: sanitize(form.description),
        type: form.type || 'rental',
        amenities: form.type === 'airbnb' ? amenities : [],
        images: imageUrls,
        lat: Number(coords?.lat) || -0.6831,
        lng: Number(coords?.lng) || 37.0,
        createdAt: new Date(),
        landlordEmail: user?.email || '',
        status: 'pending'
      }
      const docRef = await addDoc(collection(db, 'listings'), newListing)
      setListings(prev => [{ id: docRef.id, ...newListing }, ...prev])
      setForm({ title: '', location: '', address: '', price: '', bedrooms: '1', phone: '', description: '', type: 'rental' })
      setAmenities([]); setImages([]); setPreviews([]); setUploadProgress('')
      setSubmitted(true)
      setTimeout(() => { setSubmitted(false); setPage('dashboard') }, 2000)
    } catch (e) { alert('Error: ' + e.message); console.error(e) }
    setSubmitting(false)
  }

  const navigateTo = (target) => {
    if (target === 'admin' && !isAdmin) return
    if ((target === 'dashboard' || target === 'list') && !user) { setPage('auth'); return }
    setPage(target)
    setMobileMenuOpen(false)
  }

  const KNOWN_PAGES = ['home', 'search', 'list', 'dashboard', 'admin', 'auth']

  if (!authChecked) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center"><div className="text-5xl mb-3">🏠</div><p className="text-gray-400 text-sm">Loading Kodi254...</p></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {showTerms && <TermsPage onClose={() => setShowTerms(false)} />}
      {showLandlordPayment && <LandlordPaymentModal listingType={form.type} formData={form} onSuccess={submitListing} onClose={() => setShowLandlordPayment(false)} />}

      {/* Navbar */}
      <div className="bg-green-700 text-white px-4 py-3 shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button onClick={() => setPage('home')} className="font-black text-xl">Kodi<span className="text-green-300">254</span></button>
          {/* Desktop */}
          <div className="hidden sm:flex gap-1 items-center">
            <button onClick={() => navigateTo('search')} className={page === 'search' ? 'px-4 py-2 rounded-xl text-sm font-bold bg-white text-green-700' : 'px-4 py-2 rounded-xl text-sm font-medium text-green-100 hover:bg-green-600'}>Search</button>
            {user ? (
              <>
                {isAdmin && <button onClick={() => navigateTo('admin')} className={page === 'admin' ? 'px-4 py-2 rounded-xl text-sm font-bold bg-white text-green-700' : 'px-4 py-2 rounded-xl text-sm font-medium text-green-100 hover:bg-green-600'}>⚙️ Admin</button>}
                <button onClick={() => navigateTo('dashboard')} className={page === 'dashboard' ? 'px-4 py-2 rounded-xl text-sm font-bold bg-white text-green-700' : 'px-4 py-2 rounded-xl text-sm font-medium text-green-100 hover:bg-green-600'}>My Listings</button>
                <button onClick={() => navigateTo('list')} className={page === 'list' ? 'px-4 py-2 rounded-xl text-sm font-bold bg-white text-green-700' : 'px-4 py-2 rounded-xl text-sm font-medium text-green-100 hover:bg-green-600'}>+ Add</button>
                <button onClick={() => signOut(auth)} className="px-3 py-2 rounded-xl text-sm font-medium bg-green-800 text-green-200 ml-1 hover:bg-green-900">Exit</button>
              </>
            ) : (
              <button onClick={() => setPage('auth')} className="px-4 py-2 rounded-xl text-sm font-bold bg-white text-green-700 ml-2">Landlord Login</button>
            )}
          </div>
          {/* Mobile */}
          <div className="flex sm:hidden items-center gap-2">
            <button onClick={() => navigateTo('search')} className="px-3 py-2 rounded-xl text-sm font-bold bg-white text-green-700">Search</button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="w-9 h-9 bg-green-600 rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-green-500">
              <span className="w-4 h-0.5 bg-white rounded"></span>
              <span className="w-4 h-0.5 bg-white rounded"></span>
              <span className="w-4 h-0.5 bg-white rounded"></span>
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="sm:hidden mt-2 bg-green-800 rounded-2xl p-3 space-y-1">
            {user ? (
              <>
                {isAdmin && <button onClick={() => navigateTo('admin')} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-green-100 hover:bg-green-700">⚙️ Admin Panel</button>}
                <button onClick={() => navigateTo('dashboard')} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-green-100 hover:bg-green-700">🏠 My Listings</button>
                <button onClick={() => navigateTo('list')} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-green-100 hover:bg-green-700">+ Add Listing</button>
                <div className="border-t border-green-700 pt-1 mt-1">
                  <button onClick={() => { signOut(auth); setMobileMenuOpen(false) }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-green-300 hover:bg-green-700">Exit / Logout</button>
                </div>
              </>
            ) : (
              <button onClick={() => { setPage('auth'); setMobileMenuOpen(false) }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-500">Landlord Login →</button>
            )}
          </div>
        )}
      </div>

      {/* 404 — unknown pages */}
      {!KNOWN_PAGES.includes(page) && <NotFoundPage onGoHome={() => setPage('home')} />}

      {page === 'home' && <HomePage listings={listings} setPage={setPage} setFilter={setFilter} onShowTerms={() => setShowTerms(true)} />}
      {page === 'auth' && <AuthPage onAuth={() => setPage('dashboard')} />}
      {page === 'admin' && <div className="max-w-2xl mx-auto p-4"><AdminPanel user={user} allListings={listings} onUpdate={fetchListings} /></div>}
      {page === 'dashboard' && user && <div className="max-w-2xl mx-auto p-4"><LandlordDashboard user={user} allListings={listings} onUpdate={fetchListings} /></div>}
      {page === 'dashboard' && !user && <AuthPage onAuth={() => setPage('dashboard')} />}

      {page === 'search' && (
        <div className="max-w-2xl mx-auto p-4">
          <h2 className="text-xl font-black text-gray-900 mb-4 mt-2">Find a Property</h2>
          <div className="relative mb-4">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input className="w-full border-2 border-gray-100 rounded-2xl pl-10 pr-4 py-3 focus:outline-none focus:border-green-300 bg-white text-sm" placeholder="Search by town, area or name..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 mb-5">
            {[['all', 'All'], ['rental', '🏠 Rentals'], ['airbnb', '🏨 Short Stay']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)} className={filter === val ? (val === 'airbnb' ? 'px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold' : 'px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold') : 'px-4 py-2 rounded-xl bg-white text-gray-500 text-sm border border-gray-200'}>{label}</button>
            ))}
          </div>
          {loading ? (
            <div>
              <div className="h-4 bg-gray-200 rounded w-24 mb-4 animate-pulse" />
              {[1, 2, 3].map(i => <ListingSkeleton key={i} />)}
            </div>
          ) : (
            <div>
              <p className="text-gray-400 text-xs mb-4">{filtered.length} propert{filtered.length !== 1 ? 'ies' : 'y'} found</p>
              {filtered.map(listing => <ListingCard key={listing.id} listing={listing} />)}
              {filtered.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-gray-700 font-medium">No properties found</p>
                  <p className="text-gray-400 text-sm mt-1">Try a different town or area name</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {page === 'list' && !user && <AuthPage onAuth={() => setPage('list')} />}
      {page === 'list' && user && (
        <div className="max-w-2xl mx-auto p-4 pb-10">
          <h2 className="text-xl font-black text-gray-900 mb-1 mt-2">List Your Property</h2>
          <p className="text-gray-400 text-sm mb-5">Fill in the details and pay a small fee to go live.</p>
          {submitted && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-4 rounded-2xl mb-4 text-center font-medium">🎉 Submitted! Goes live after payment verification.</div>}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex gap-2 mb-5">
              <button onClick={() => setForm({ ...form, type: 'rental' })} className={form.type === 'rental' ? 'flex-1 py-3 rounded-2xl bg-green-600 text-white font-black text-sm' : 'flex-1 py-3 rounded-2xl bg-gray-100 text-gray-400 font-medium text-sm'}>🏠 Long Stay</button>
              <button onClick={() => setForm({ ...form, type: 'airbnb' })} className={form.type === 'airbnb' ? 'flex-1 py-3 rounded-2xl bg-orange-500 text-white font-black text-sm' : 'flex-1 py-3 rounded-2xl bg-gray-100 text-gray-400 font-medium text-sm'}>🏨 Short Stay</button>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-5 flex items-center gap-2">
              <span>💡</span>
              <p className="text-amber-700 text-sm"><strong>Listing fee:</strong> {form.type === 'airbnb' ? 'KES 500' : 'KES 300'} · M-Pesa · 30 days · Goes live after verification</p>
            </div>
            {[
              ['Property title', 'title', 'text', 'e.g. Spacious 2 Bedroom in Kisii Town'],
              ['Town / Area', 'location', 'text', 'e.g. Kilimani, Nairobi'],
              ['Street Address (for accurate map pin)', 'address', 'text', 'e.g. Lumumba Drive, House No. 12'],
              [form.type === 'airbnb' ? 'Price per night (KES)' : 'Rent per month (KES)', 'price', 'number', 'e.g. 8000'],
              ['Your WhatsApp number', 'phone', 'tel', 'e.g. 0712 345 678'],
            ].map(([label, field, type, placeholder]) => (
              <div key={field} className="mb-4">
                <label className="block text-gray-600 font-semibold text-sm mb-2">{label}</label>
                <input className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-green-300 bg-gray-50 text-sm" placeholder={placeholder} type={type} min={type === 'number' ? '100' : undefined} value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} />
                {field === 'phone' && <p className="text-gray-400 text-xs mt-1">Safaricom number starting with 07 or 01</p>}
              </div>
            ))}
            <div className="mb-4">
              <label className="block text-gray-600 font-semibold text-sm mb-2">Bedrooms</label>
              <select className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-green-300 bg-gray-50 text-sm" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })}>
                <option value="1">Bedsitter / 1 Bedroom</option>
                <option value="2">2 Bedrooms</option>
                <option value="3">3 Bedrooms</option>
                <option value="4">4+ Bedrooms</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-gray-600 font-semibold text-sm mb-2">Description</label>
              <textarea className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-green-300 bg-gray-50 h-24 resize-none text-sm" placeholder="Describe the property — size, condition, nearby facilities, water availability..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            {form.type === 'airbnb' && (
              <div className="mb-4">
                <label className="block text-gray-600 font-semibold text-sm mb-2">Amenities</label>
                <div className="flex flex-wrap gap-2">
                  {amenityOptions.map(a => (
                    <button key={a} onClick={() => toggleAmenity(a)} className={amenities.includes(a) ? 'px-3 py-2 rounded-xl bg-orange-500 text-white text-xs font-medium' : 'px-3 py-2 rounded-xl bg-gray-100 text-gray-500 text-xs'}>{a}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-5">
              <label className="block text-gray-600 font-semibold text-sm mb-2">Photos <span className="text-gray-400 font-normal">(up to 5 · JPG/PNG/WEBP · max 5MB each)</span></label>
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                <span className="text-2xl mb-1">📸</span>
                <span className="text-gray-400 text-xs">Tap to upload photos</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImageChange} className="hidden" />
              </label>
              {previews.length > 0 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {previews.map((p, i) => <img key={i} src={p} alt="preview" className="h-20 w-28 object-cover rounded-xl flex-shrink-0" />)}
                </div>
              )}
            </div>
            {uploadProgress && <p className="text-blue-600 text-sm mb-3 text-center">{uploadProgress}</p>}
            <button onClick={handleSubmit} disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-black text-base disabled:opacity-50 transition-all active:scale-95">
              {submitting ? '⏳ Please wait...' : `Continue to Payment · KES ${form.type === 'airbnb' ? '500' : '300'} →`}
            </button>
            <p className="text-center text-xs mt-3">
              By submitting, you agree to our <button onClick={() => setShowTerms(true)} className="text-green-600 underline">Terms & Conditions</button>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}