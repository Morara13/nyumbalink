import { useState, useEffect } from 'react'
import { db } from './firebase'
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { collection, addDoc, getDocs, orderBy, query, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const auth = getAuth()
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dg4dwedsi"
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "kodi254_preset"
const MPESA_NUMBER = "0724380481"

async function uploadImage(file) {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", UPLOAD_PRESET)
  const res = await fetch("https://api.cloudinary.com/v1_1/" + CLOUD_NAME + "/image/upload", { method: "POST", body: formData })
  const data = await res.json()
  return data.secure_url
}

function PaymentModal({ listing, onClose }) {
  const isAirbnb = listing.type === 'airbnb'
  const fee = isAirbnb ? listing.price : 250
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const triggerSTK = async () => {
    if (!phone || phone.length < 10) {
      setError('Please enter a valid M-Pesa number')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/mpesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount: fee, reference: 'Kodi254 - ' + listing.title })
      })
      const data = await res.json()
      if (data.success) {
        setStep(2)
      } else {
        setError(data.error || 'Payment failed. Please try again.')
      }
    } catch (e) {
      setError('Network error: ' + e.message)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{isAirbnb ? '🏨 Book Your Stay' : '🏠 Request Viewing'}</h3>
              <p className="text-gray-500 text-sm mt-1">{listing.title} · {listing.location}</p>
            </div>
            <button onClick={onClose} className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-200">✕</button>
          </div>

          {step === 1 && (
            <div>
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-2xl p-4 mb-5">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-600 text-sm">Amount to pay</p>
                    <p className="text-3xl font-bold text-green-700">KES {fee.toLocaleString()}</p>
                  </div>
                  <div className="bg-green-100 rounded-xl p-3">
                    <p className="text-green-700 text-2xl">📱</p>
                  </div>
                </div>
                <p className="text-green-600 text-xs mt-2">{isAirbnb ? 'Full booking amount' : 'One-time viewing fee — refunded if house not as described'}</p>
              </div>

              <label className="block text-gray-700 font-medium mb-2 text-sm">Your M-Pesa Number</label>
              <input
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 text-lg focus:outline-none focus:border-green-400 mb-4"
                placeholder="0712 345 678"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                type="tel"
              />
              {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}
              <button onClick={triggerSTK} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50 transition-all">
                {loading ? '⏳ Sending prompt...' : `Pay KES ${fee.toLocaleString()} via M-Pesa`}
              </button>
              <p className="text-center text-gray-400 text-xs mt-3">🔒 Secured by IntaSend · M-Pesa STK Push</p>
            </div>
          )}

          {step === 2 && (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📲</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Check your phone!</h3>
              <p className="text-gray-500 mb-2">We sent an M-Pesa prompt to</p>
              <p className="text-green-700 font-bold text-lg mb-4">{phone}</p>
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5 text-left">
                <p className="text-amber-700 text-sm font-medium mb-1">⏱ What happens next?</p>
                <p className="text-amber-600 text-sm">Enter your M-Pesa PIN → We verify payment → Landlord contact sent to your WhatsApp within 30 minutes.</p>
              </div>
              <button onClick={() => setStep(3)} className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg">I have paid ✓</button>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">⏳</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">You're all set!</h3>
              <p className="text-gray-500 mb-4">Your payment is being verified. Landlord contact will be sent to your WhatsApp within 30 minutes.</p>
              <div className="bg-green-50 border border-green-100 rounded-2xl p-4 mb-5">
                <p className="text-green-700 text-sm">Need help? WhatsApp us at <strong>{MPESA_NUMBER}</strong></p>
              </div>
              <button onClick={onClose} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-lg">Done 👍</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LandlordPaymentModal({ listingType, onSuccess, onClose }) {
  const fee = listingType === 'airbnb' ? 500 : 300
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const triggerSTK = async () => {
    if (!phone || phone.length < 10) {
      setError('Please enter a valid M-Pesa number')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/mpesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount: fee, reference: 'Kodi254 Listing Fee' })
      })
      const data = await res.json()
      if (data.success) {
        setStep(2)
      } else {
        setError(data.error || 'Payment failed. Please try again.')
      }
    } catch (e) {
      setError('Network error: ' + e.message)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-xl font-bold text-gray-900">💳 Listing Fee</h3>
              <p className="text-gray-500 text-sm mt-1">{listingType === 'airbnb' ? 'Short Stay listing · 30 days' : 'Rental listing · 30 days'}</p>
            </div>
            <button onClick={onClose} className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center text-gray-500">✕</button>
          </div>

          {step === 1 && (
            <div>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 mb-5">
                <p className="text-gray-600 text-sm">One-time listing fee</p>
                <p className="text-3xl font-bold text-blue-700">KES {fee.toLocaleString()}</p>
                <p className="text-blue-600 text-xs mt-1">Your listing stays live for 30 days</p>
              </div>
              <label className="block text-gray-700 font-medium mb-2 text-sm">Your M-Pesa Number</label>
              <input
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 text-lg focus:outline-none focus:border-green-400 mb-4"
                placeholder="0712 345 678"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                type="tel"
              />
              {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}
              <button onClick={triggerSTK} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50">
                {loading ? '⏳ Sending prompt...' : `Pay KES ${fee.toLocaleString()} via M-Pesa`}
              </button>
              <p className="text-center text-gray-400 text-xs mt-3">🔒 Secured by IntaSend · M-Pesa STK Push</p>
            </div>
          )}

          {step === 2 && (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📲</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Check your phone!</h3>
              <p className="text-gray-500 mb-4">M-Pesa prompt sent to <strong>{phone}</strong>. Enter your PIN to complete.</p>
              <button onClick={() => setStep(3)} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg">I have paid ✓</button>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">✅</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Payment received!</h3>
              <p className="text-gray-500 mb-5">Your listing will go live once we verify your payment. Usually within 30 minutes.</p>
              <button onClick={onSuccess} className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg">Submit My Listing 🚀</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ListingCard({ listing }) {
  const [showPayment, setShowPayment] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const isAirbnb = listing.type === 'airbnb'
  const position = [-0.6831, 37.0]

  return (
    <div className="bg-white rounded-2xl shadow-sm mb-4 border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      {showPayment && <PaymentModal listing={listing} onClose={() => setShowPayment(false)} />}

      {listing.images && listing.images.length > 0 ? (
        <div className="relative">
          <img src={listing.images[0]} alt="house" className="w-full h-52 object-cover" />
          {listing.images.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full">
              +{listing.images.length - 1} photos
            </div>
          )}
          {isAirbnb && (
            <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs px-3 py-1 rounded-full font-medium">
              🏨 Short Stay
            </div>
          )}
          {listing.status === 'taken' && (
            <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-3 py-1 rounded-full font-medium">
              Not Available
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-32 bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
          <span className="text-4xl">{isAirbnb ? '🏨' : '🏠'}</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-gray-900 flex-1 pr-2">{listing.title}</h3>
          {isAirbnb ? (
            <div className="text-right">
              <p className="text-orange-600 font-bold">KES {listing.price.toLocaleString()}</p>
              <p className="text-gray-400 text-xs">per night</p>
            </div>
          ) : (
            <div className="text-right">
              <p className="text-green-700 font-bold">KES {listing.price.toLocaleString()}</p>
              <p className="text-gray-400 text-xs">per month</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-gray-500 text-sm mb-2">
          <span>📍 {listing.location}</span>
          <span>·</span>
          <span>🛏 {listing.bedrooms} bed{listing.bedrooms > 1 ? 's' : ''}</span>
        </div>

        {listing.amenities && listing.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {listing.amenities.slice(0, 4).map((a, i) => <span key={i} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{a}</span>)}
            {listing.amenities.length > 4 && <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">+{listing.amenities.length - 4}</span>}
          </div>
        )}

        {listing.description && (
          <p className="text-gray-500 text-sm mb-3 leading-relaxed">
            {expanded ? listing.description : listing.description.substring(0, 80) + (listing.description.length > 80 ? '...' : '')}
            {listing.description.length > 80 && (
              <button onClick={() => setExpanded(!expanded)} className="text-green-600 font-medium ml-1">{expanded ? 'less' : 'more'}</button>
            )}
          </p>
        )}

        {listing.status !== 'taken' ? (
          <button
            onClick={() => setShowPayment(true)}
            className={isAirbnb
              ? "w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
              : "w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
            }>
            {isAirbnb ? '🏨 Book Now' : '🔍 Request Viewing · KES 250'}
          </button>
        ) : (
          <div className="w-full bg-gray-100 text-gray-400 py-3 rounded-xl text-center text-sm font-medium">
            Not Available
          </div>
        )}

        <button onClick={() => setExpanded(!expanded)} className="w-full mt-2 text-gray-400 text-xs py-1">
          {expanded ? '▲ Show less' : '▼ Show map'}
        </button>

        {expanded && (
          <div style={{ height: '150px', borderRadius: '12px', overflow: 'hidden', marginTop: '8px' }}>
            <MapContainer center={position} zoom={6} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={position}><Popup>{listing.title}</Popup></Marker>
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  )
}

function LandlordDashboard({ user, allListings, onUpdate }) {
  const myListings = allListings.filter(l => l.landlordEmail === user.email)
  const toggleStatus = async (listing) => {
    const newStatus = listing.status === 'taken' ? 'available' : 'taken'
    await updateDoc(doc(db, 'listings', listing.id), { status: newStatus })
    onUpdate()
  }
  const deleteListing = async (listing) => {
    if (window.confirm('Delete this listing?')) {
      await deleteDoc(doc(db, 'listings', listing.id))
      onUpdate()
    }
  }
  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">My Listings</h2>
          <p className="text-gray-500 text-sm">{myListings.length} propert{myListings.length !== 1 ? 'ies' : 'y'}</p>
        </div>
      </div>
      {myListings.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <div className="text-5xl mb-3">🏠</div>
          <p className="text-gray-700 font-medium mb-1">No listings yet</p>
          <p className="text-gray-400 text-sm">Add your first property to get started</p>
        </div>
      )}
      {myListings.map(listing => (
        <div key={listing.id} className="bg-white rounded-2xl shadow-sm mb-4 border border-gray-100 overflow-hidden">
          {listing.images && listing.images.length > 0 && <img src={listing.images[0]} alt="house" className="w-full h-44 object-cover" />}
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold text-gray-900">{listing.title}</h3>
              <span className={listing.status === 'taken' ? 'bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-medium' : 'bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full font-medium'}>
                {listing.status === 'taken' ? 'Taken' : 'Available'}
              </span>
            </div>
            <p className="text-gray-500 text-sm mb-1">📍 {listing.location}</p>
            <p className="text-gray-700 text-sm font-medium mb-4">{listing.type === 'airbnb' ? 'KES ' + listing.price.toLocaleString() + '/night' : 'KES ' + listing.price.toLocaleString() + '/month'}</p>
            <div className="flex gap-2">
              <button onClick={() => toggleStatus(listing)} className={listing.status === 'taken' ? 'flex-1 bg-green-50 text-green-700 py-2 rounded-xl text-sm font-medium border border-green-200' : 'flex-1 bg-red-50 text-red-600 py-2 rounded-xl text-sm font-medium border border-red-200'}>
                {listing.status === 'taken' ? '✅ Mark Available' : '❌ Mark Taken'}
              </button>
              <button onClick={() => deleteListing(listing)} className="px-4 bg-gray-50 text-gray-500 py-2 rounded-xl text-sm font-medium border border-gray-200">🗑</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        await createUserWithEmailAndPassword(auth, email, password)
      }
      onAuth()
    } catch (e) {
      setError(e.message.replace('Firebase: ', ''))
    }
    setLoading(false)
  }
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏠</div>
          <h2 className="text-2xl font-bold text-gray-900">Landlord Portal</h2>
          <p className="text-gray-500 text-sm mt-1">List your property and start earning</p>
        </div>
        <div className="flex mb-6 bg-gray-100 rounded-2xl p-1">
          <button onClick={() => setMode('login')} className={mode === 'login' ? 'flex-1 py-2 rounded-xl bg-white font-medium text-gray-900 shadow-sm' : 'flex-1 py-2 rounded-xl text-gray-500'}>Login</button>
          <button onClick={() => setMode('register')} className={mode === 'register' ? 'flex-1 py-2 rounded-xl bg-white font-medium text-gray-900 shadow-sm' : 'flex-1 py-2 rounded-xl text-gray-500'}>Register</button>
        </div>
        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}
        <input className="w-full border-2 border-gray-100 rounded-2xl px-4 py-4 mb-3 focus:outline-none focus:border-green-300 bg-gray-50" placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="w-full border-2 border-gray-100 rounded-2xl px-4 py-4 mb-5 focus:outline-none focus:border-green-300 bg-gray-50" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button onClick={handleSubmit} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50">
          {loading ? 'Please wait...' : mode === 'login' ? 'Login →' : 'Create Account →'}
        </button>
      </div>
    </div>
  )
}

function HomePage({ listings, setPage, setFilter }) {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  const reviews = [
    {
      name: "Mike",
      location: "Chuka",
      text: "Niliamua kutumia Kodi254 baada ya kushindwa kupata nyumba kwa wiki mbili. Siku moja tu, nilikuwa na mawasiliano ya mwenye nyumba mzuri Chuka town. Ilikuwa rahisi sana na bei ya kuona nyumba ilikuwa ya chini sana.",
      rating: 5,
      emoji: "😊"
    },
    {
      name: "Masese",
      location: "Nairobi",
      text: "Nilikuwa nikiangalia nyumba Nairobi kwa muda mrefu. Agents walikuwa wananiomba pesa nyingi bila kitu. Kodi254 ilinisaidia kupata nyumba bila agent fees. Highly recommended!",
      rating: 5,
      emoji: "🙌"
    },
    {
      name: "Brandon",
      location: "Kisii",
      text: "I listed my house on Kodi254 and within 3 days I already had a serious tenant. The platform is straightforward and the M-Pesa payment system makes everything smooth. Worth every shilling.",
      rating: 5,
      emoji: "👏"
    },
    {
      name: "Mong'ina",
      location: "Kisii",
      text: "Nilikuwa na nyumba yangu ikiwa wazi kwa miezi miwili. Baada ya kuweka kwenye Kodi254, nilipata mpangaji ndani ya wiki moja. Bei ya kuweka listing ni ya chini sana ukilinganisha na faida unayopata.",
      rating: 5,
      emoji: "🎉"
    },
  ]

  return (
    <div className="bg-gray-50">
      {/* Anchor Nav */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-30 overflow-x-auto">
        <div className="flex gap-1 px-4 py-2 max-w-4xl mx-auto">
          {[['hero','🏠 Home'],['how','📋 How it Works'],['features','✨ Features'],['contact','📞 Contact'],['reviews','⭐ Reviews']].map(([id, label]) => (
            <button key={id} onClick={() => scrollTo(id)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-green-50 hover:text-green-700 whitespace-nowrap transition-colors">{label}</button>
          ))}
        </div>
      </div>

      {/* Hero */}
      <div id="hero" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-600 via-green-700 to-emerald-800"></div>
        <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px'}}></div>
        <div className="relative text-white py-20 px-4 text-center">
          <div className="inline-block bg-white bg-opacity-20 rounded-full px-4 py-2 text-sm font-medium mb-6">
            🇰🇪 Kenya's #1 House Hunting Platform
          </div>
          <h1 className="text-4xl font-black mb-4 leading-tight">Find Your Perfect<br/>Home in Kenya</h1>
          <p className="text-green-100 text-lg mb-10 max-w-md mx-auto leading-relaxed">Connect directly with landlords. No agents, no hidden fees, no stress.</p>
          <div className="flex justify-center gap-3 flex-wrap mb-14">
            <button onClick={() => { setPage('search'); setFilter('rental') }} className="bg-white text-green-700 px-7 py-3 rounded-2xl font-bold hover:bg-green-50 shadow-lg transition-all active:scale-95">
              🏠 Find Rental
            </button>
            <button onClick={() => { setPage('search'); setFilter('airbnb') }} className="bg-orange-500 text-white px-7 py-3 rounded-2xl font-bold hover:bg-orange-600 shadow-lg transition-all active:scale-95">
              🏨 Short Stays
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
            {[
              [listings.length + '+', 'Active Listings'],
              ['0%', 'Agent Fees'],
              ['47', 'Counties'],
            ].map(([val, label]) => (
              <div key={label} className="bg-white bg-opacity-15 backdrop-blur rounded-2xl p-4 border border-white border-opacity-20">
                <div className="text-2xl font-black">{val}</div>
                <div className="text-green-200 text-xs mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it Works */}
      <div id="how" className="py-14 px-4 bg-white scroll-mt-32">
        <div className="max-w-2xl mx-auto">
          <p className="text-green-600 font-medium text-center text-sm mb-2">Simple & Fast</p>
          <h2 className="text-2xl font-black text-center text-gray-900 mb-10">How Kodi254 Works</h2>
          <div className="space-y-6">
            {[
              ['🔍', 'Search & Browse', 'Browse verified listings across Kenya. Filter by town, price and type. No fake listings.'],
              ['📱', 'Pay via M-Pesa', 'Pay KES 250 via M-Pesa STK Push — a prompt comes directly to your phone. Quick and secure.'],
              ['📞', 'Get Landlord Contact', 'We send you the landlord\'s WhatsApp number within 30 minutes. Talk directly, no middlemen.'],
            ].map(([icon, title, desc], i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="bg-green-50 rounded-2xl w-14 h-14 flex items-center justify-center text-2xl flex-shrink-0">{icon}</div>
                <div className="pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-green-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{i+1}</span>
                    <h3 className="font-bold text-gray-900">{title}</h3>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div id="features" className="py-14 px-4 bg-gray-50 scroll-mt-32">
        <div className="max-w-2xl mx-auto">
          <p className="text-green-600 font-medium text-center text-sm mb-2">Why Us</p>
          <h2 className="text-2xl font-black text-center text-gray-900 mb-10">Built for Kenya 🇰🇪</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['🔒', 'Verified Landlords', 'Every landlord pays to list — no fake or abandoned listings.'],
              ['💸', 'Zero Agent Fees', 'Talk directly to the owner. Save months of rent in commissions.'],
              ['📲', 'M-Pesa STK Push', 'No manual transfers. Payment prompt comes straight to your phone.'],
              ['🏨', 'Short Stays Too', 'Weekend getaway? Find Airbnb-style stays across Kenya.'],
              ['🗺️', 'Map View', 'See exactly where the property is before you even call.'],
              ['⚡', 'Fast & Simple', 'List or find a house in under 5 minutes. No complicated forms.'],
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

      {/* Contact */}
      <div id="contact" className="py-14 px-4 bg-white scroll-mt-32">
        <div className="max-w-md mx-auto">
          <p className="text-green-600 font-medium text-center text-sm mb-2">Get in Touch</p>
          <h2 className="text-2xl font-black text-center text-gray-900 mb-3">We are Here to Help</h2>
          <p className="text-gray-500 text-center text-sm mb-8">Have a question about a listing or need help? Reach out directly.</p>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-6 border border-green-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center text-white text-xl font-black">H</div>
              <div>
                <p className="font-bold text-gray-900">Handson Morara</p>
                <p className="text-gray-500 text-sm">Founder, Kodi254</p>
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <p className="text-green-600 text-xs">Usually replies in 30 minutes</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <a href="https://wa.me/254724380481" target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-green-600 text-white px-5 py-4 rounded-2xl font-semibold hover:bg-green-700 transition-colors">
                <span className="text-xl">📱</span>
                <div>
                  <p className="font-bold">Chat on WhatsApp</p>
                  <p className="text-green-200 text-xs">0724 380 481</p>
                </div>
              </a>
              <a href="mailto:kodikenya254@gmail.com" className="flex items-center gap-3 bg-white text-gray-700 px-5 py-4 rounded-2xl font-semibold border border-gray-200 hover:bg-gray-50 transition-colors">
                <span className="text-xl">✉️</span>
                <div>
                  <p className="font-bold">Send an Email</p>
                  <p className="text-gray-400 text-xs">kodikenya254@gmail.com</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div id="reviews" className="py-14 px-4 bg-gray-50 scroll-mt-32">
        <div className="max-w-2xl mx-auto">
          <p className="text-green-600 font-medium text-center text-sm mb-2">Real Stories</p>
          <h2 className="text-2xl font-black text-center text-gray-900 mb-3">What People Are Saying</h2>
          <p className="text-gray-500 text-center text-sm mb-8">From tenants and landlords across Kenya</p>
          <div className="space-y-4">
            {reviews.map((r, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold">{r.name[0]}</div>
                    <div>
                      <p className="font-bold text-gray-900">{r.name} {r.emoji}</p>
                      <p className="text-gray-400 text-xs">📍 {r.location}</p>
                    </div>
                  </div>
                  <div className="text-yellow-400 text-sm">{'⭐'.repeat(r.rating)}</div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 text-white py-10 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-3xl mb-3">🏠</div>
          <h3 className="text-xl font-black mb-1">Kodi254</h3>
          <p className="text-gray-400 text-sm mb-2">Kenya's trusted property platform</p>
          <p className="text-gray-500 text-xs mb-6">kodikenya254@gmail.com · 0724 380 481</p>
          <div className="border-t border-gray-800 pt-4 flex justify-center gap-6 text-gray-500 text-xs">
            <span>© 2026 Kodi254</span>
            <span>Made with ❤️ in Kenya</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('home')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ title: '', location: '', price: '', bedrooms: '1', phone: '', description: '', type: 'rental' })
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

  const amenityOptions = ['WiFi', 'Parking', 'Kitchen', 'TV', 'AC', 'Washer', 'Pool', 'Gym', 'Security', 'Water', 'Generator']

  useEffect(() => {
    onAuthStateChanged(auth, (u) => { setUser(u); setAuthChecked(true) })
  }, [])

  const fetchListings = async () => {
    try {
      const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      setListings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchListings() }, [])

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 5)
    setImages(files)
    setPreviews(files.map(f => URL.createObjectURL(f)))
  }

  const toggleAmenity = (a) => setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])

  const filtered = listings.filter(l => {
    const matchSearch = l.location?.toLowerCase().includes(search.toLowerCase()) || l.title?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'rental' && l.type !== 'airbnb') || (filter === 'airbnb' && l.type === 'airbnb')
    return matchSearch && matchFilter
  })

  const handleSubmit = async () => {
    if (!form.title || !form.location || !form.price || !form.phone) {
      alert('Please fill all required fields!')
      return
    }
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
      setUploadProgress('Saving...')
      const newListing = {
        title: form.title, location: form.location, price: parseInt(form.price),
        bedrooms: parseInt(form.bedrooms), phone: form.phone, description: form.description,
        type: form.type, amenities: form.type === 'airbnb' ? amenities : [],
        images: imageUrls, createdAt: new Date(), landlordEmail: user.email, status: 'available'
      }
      const docRef = await addDoc(collection(db, 'listings'), newListing)
      setListings([{ id: docRef.id, ...newListing }, ...listings])
      setForm({ title: '', location: '', price: '', bedrooms: '1', phone: '', description: '', type: 'rental' })
      setAmenities([]); setImages([]); setPreviews([]); setUploadProgress('')
      setSubmitted(true)
      setTimeout(() => { setSubmitted(false); setPage('dashboard') }, 2000)
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setSubmitting(false)
  }

  const navBtn = (target, label) => (
    <button onClick={() => setPage(target)} className={page === target ? 'px-4 py-2 rounded-xl text-sm font-medium bg-white text-green-700' : 'px-4 py-2 rounded-xl text-sm font-medium text-green-100 hover:bg-green-600'}>
      {label}
    </button>
  )

  if (!authChecked) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-center"><div className="text-4xl mb-3">🏠</div><p className="text-gray-400">Loading Kodi254...</p></div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      {showLandlordPayment && <LandlordPaymentModal listingType={form.type} onSuccess={submitListing} onClose={() => setShowLandlordPayment(false)} />}

      {/* Navbar */}
      <div className="bg-green-700 text-white px-4 py-3 shadow-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button onClick={() => setPage('home')} className="font-black text-xl tracking-tight">Kodi<span className="text-green-300">254</span></button>
          <div className="flex gap-1 items-center">
            {navBtn('search', 'Search')}
            {user ? (
              <>
                {navBtn('dashboard', 'My Listings')}
                {navBtn('list', '+ Add')}
                <button onClick={() => signOut(auth)} className="px-3 py-2 rounded-xl text-sm font-medium bg-red-500 text-white ml-1">Exit</button>
              </>
            ) : (
              <button onClick={() => setPage('auth')} className="px-4 py-2 rounded-xl text-sm font-bold bg-white text-green-700 ml-1">Landlord Login</button>
            )}
          </div>
        </div>
      </div>

      {page === 'home' && <HomePage listings={listings} setPage={setPage} setFilter={setFilter} />}

      {page === 'auth' && <AuthPage onAuth={() => setPage('dashboard')} />}

      {page === 'dashboard' && user && (
        <div className="max-w-2xl mx-auto p-4">
          <LandlordDashboard user={user} allListings={listings} onUpdate={fetchListings} />
        </div>
      )}

      {page === 'search' && (
        <div className="max-w-2xl mx-auto p-4">
          <h2 className="text-xl font-black text-gray-900 mb-4 mt-2">Search Properties</h2>
          <div className="relative mb-4">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input className="w-full border-2 border-gray-100 rounded-2xl pl-10 pr-4 py-3 focus:outline-none focus:border-green-300 bg-white" placeholder="Town, location..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 mb-5">
            {[['all','All'],['rental','🏠 Rentals'],['airbnb','🏨 Short Stay']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)} className={filter === val ? (val === 'airbnb' ? 'px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium' : 'px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium') : 'px-4 py-2 rounded-xl bg-white text-gray-600 text-sm border border-gray-200'}>{label}</button>
            ))}
          </div>
          {loading ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🏠</div>
              <p className="text-gray-400">Loading listings...</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-400 text-sm mb-4">{filtered.length} propert{filtered.length !== 1 ? 'ies' : 'y'} found</p>
              {filtered.map(listing => <ListingCard key={listing.id} listing={listing} />)}
              {filtered.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-gray-700 font-medium">No properties found</p>
                  <p className="text-gray-400 text-sm mt-1">Try searching a different town</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {page === 'list' && !user && <AuthPage onAuth={() => setPage('list')} />}

      {page === 'list' && user && (
        <div className="max-w-2xl mx-auto p-4">
          <h2 className="text-xl font-black text-gray-900 mb-1 mt-2">List Your Property</h2>
          <p className="text-gray-500 text-sm mb-5">Fill in the details below and pay a small listing fee to go live.</p>

          {submitted && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-4 rounded-2xl mb-4 font-medium text-center">
              🎉 Listing submitted! Redirecting to dashboard...
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex gap-2 mb-5">
              <button onClick={() => setForm({ ...form, type: 'rental' })} className={form.type === 'rental' ? 'flex-1 py-3 rounded-2xl bg-green-600 text-white font-bold text-sm' : 'flex-1 py-3 rounded-2xl bg-gray-100 text-gray-500 font-medium text-sm'}>🏠 Long Stay Rental</button>
              <button onClick={() => setForm({ ...form, type: 'airbnb' })} className={form.type === 'airbnb' ? 'flex-1 py-3 rounded-2xl bg-orange-500 text-white font-bold text-sm' : 'flex-1 py-3 rounded-2xl bg-gray-100 text-gray-500 font-medium text-sm'}>🏨 Short Stay</button>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
              <span>💡</span>
              <p className="text-amber-700 text-sm"><strong>Listing fee:</strong> {form.type === 'airbnb' ? 'KES 500' : 'KES 300'} · 30 days · Pay via M-Pesa</p>
            </div>

            {[
              ['Property title', 'title', 'text', 'e.g. Spacious 2 Bedroom in Kisii Town'],
              ['Location / Town', 'location', 'text', 'e.g. Kisii, Nairobi, Nakuru...'],
              [form.type === 'airbnb' ? 'Price per night (KES)' : 'Rent per month (KES)', 'price', 'number', 'e.g. 8000'],
              ['Your WhatsApp number', 'phone', 'tel', 'e.g. 0712 345 678'],
            ].map(([label, field, type, placeholder]) => (
              <div key={field} className="mb-4">
                <label className="block text-gray-700 font-medium text-sm mb-2">{label}</label>
                <input className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-green-300 bg-gray-50" placeholder={placeholder} type={type} value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} />
              </div>
            ))}

            <div className="mb-4">
              <label className="block text-gray-700 font-medium text-sm mb-2">Bedrooms</label>
              <select className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-green-300 bg-gray-50" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })}>
                <option value="1">Bedsitter / 1 Bedroom</option>
                <option value="2">2 Bedrooms</option>
                <option value="3">3 Bedrooms</option>
                <option value="4">4+ Bedrooms</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 font-medium text-sm mb-2">Description</label>
              <textarea className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 focus:outline-none focus:border-green-300 bg-gray-50 h-24 resize-none" placeholder="Describe the property — size, condition, nearby facilities..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>

            {form.type === 'airbnb' && (
              <div className="mb-4">
                <label className="block text-gray-700 font-medium text-sm mb-2">Amenities</label>
                <div className="flex flex-wrap gap-2">
                  {amenityOptions.map(a => (
                    <button key={a} onClick={() => toggleAmenity(a)} className={amenities.includes(a) ? 'px-3 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium' : 'px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm'}>{a}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5">
              <label className="block text-gray-700 font-medium text-sm mb-2">📸 Photos <span className="text-gray-400 font-normal">(up to 5)</span></label>
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-4 text-center bg-gray-50">
                <input type="file" accept="image/*" multiple onChange={handleImageChange} className="w-full opacity-0 absolute" id="photos" />
                <label htmlFor="photos" className="cursor-pointer">
                  <p className="text-gray-400 text-sm">Tap to upload photos</p>
                </label>
              </div>
              {previews.length > 0 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {previews.map((p, i) => <img key={i} src={p} alt="preview" className="h-20 w-28 object-cover rounded-xl flex-shrink-0" />)}
                </div>
              )}
            </div>

            {uploadProgress && <p className="text-blue-600 text-sm mb-3 text-center">{uploadProgress}</p>}

            <button onClick={handleSubmit} disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-black text-lg disabled:opacity-50 transition-all active:scale-95">
              {submitting ? '⏳ Please wait...' : `Continue to Payment · KES ${form.type === 'airbnb' ? '500' : '300'} →`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}