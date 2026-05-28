import { useState, useEffect } from 'react'
import { db } from './firebase'
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { collection, addDoc, getDocs, orderBy, query, updateDoc, deleteDoc, doc, where } from 'firebase/firestore'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const auth = getAuth()
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const MPESA_NUMBER = import.meta.env.VITE_MPESA_NUMBER

async function uploadImage(file) {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", UPLOAD_PRESET)
  const res = await fetch("https://api.cloudinary.com/v1_1/" + CLOUD_NAME + "/image/upload", {
    method: "POST",
    body: formData
  })
  const data = await res.json()
  return data.secure_url
}

function PaymentModal({ listing, onClose }) {
  const isAirbnb = listing.type === 'airbnb'
  const fee = isAirbnb ? listing.price : 250
  const [step, setStep] = useState(1)
  const [code, setCode] = useState('')
  const [mpesa, setMpesa] = useState('')
  const waLink = "https://wa.me/254" + MPESA_NUMBER.substring(1) + "?text=Hi Kodi254, I have paid KES " + fee + " for listing: " + listing.title + " in " + listing.location + ". My M-Pesa code is: " + code
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">{isAirbnb ? 'Book Now' : 'Request Viewing'}</h3>
          <button onClick={onClose} className="text-gray-500 text-xl font-bold">✕</button>
        </div>
        {step === 1 && (
          <div>
            <div className="bg-green-50 rounded-xl p-4 mb-4">
              <p className="text-green-800 font-semibold text-lg mb-1">{listing.title}</p>
              <p className="text-gray-600 text-sm">📍 {listing.location}</p>
              <p className="text-gray-600 text-sm">🛏 {listing.bedrooms} Bedroom(s)</p>
              {isAirbnb ? <p className="text-orange-600 font-bold mt-2">KES {listing.price.toLocaleString()}/night</p> : <p className="text-green-700 font-bold mt-2">Viewing Fee: KES 250</p>}
            </div>
            <div className="bg-blue-50 rounded-xl p-4 mb-4">
              <p className="text-blue-800 font-semibold mb-2">📱 Pay via M-Pesa</p>
              <p className="text-gray-700 text-sm mb-1">1. Go to M-Pesa → Send Money</p>
              <p className="text-gray-700 text-sm mb-1">2. Send <strong>KES {fee}</strong> to:</p>
              <p className="text-2xl font-bold text-blue-700 text-center my-2">{MPESA_NUMBER}</p>
              <p className="text-gray-700 text-sm">3. Save your confirmation code</p>
            </div>
            <button onClick={() => setStep(2)} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold">I have paid ✓</button>
          </div>
        )}
        {step === 2 && (
          <div>
            <input className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="M-Pesa code e.g. QGH7X8Y9Z0" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
            <input className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="Your M-Pesa number" value={mpesa} onChange={e => setMpesa(e.target.value)} />
            <a href={waLink} target="_blank" rel="noreferrer" onClick={() => setStep(3)} className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold block text-center mb-3">📱 Send Payment Proof on WhatsApp</a>
            <button onClick={() => setStep(3)} className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-semibold">Skip</button>
          </div>
        )}
        {step === 3 && (
          <div className="text-center">
            <div className="text-5xl mb-4">⏳</div>
            <h3 className="text-xl font-bold mb-2">Payment Under Review</h3>
            <p className="text-gray-500 mb-4">We will send landlord contact to your WhatsApp within <strong>30 minutes</strong>.</p>
            <button onClick={onClose} className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold">Done</button>
          </div>
        )}
      </div>
    </div>
  )
}

function LandlordPaymentModal({ listingType, onSuccess, onClose }) {
  const fee = listingType === 'airbnb' ? 500 : 300
  const [step, setStep] = useState(1)
  const [code, setCode] = useState('')
  const waLink = "https://wa.me/254" + MPESA_NUMBER.substring(1) + "?text=Hi Kodi254, I have paid KES " + fee + " listing fee. My M-Pesa code is: " + code
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Listing Payment</h3>
          <button onClick={onClose} className="text-gray-500 text-xl font-bold">✕</button>
        </div>
        {step === 1 && (
          <div>
            <div className="bg-blue-50 rounded-xl p-4 mb-4">
              <p className="text-blue-800 font-semibold mb-1">Listing Fee</p>
              <p className="text-gray-600 text-sm mb-2">{listingType === 'airbnb' ? 'Short Stay — 30 days' : 'Rental — 30 days'}</p>
              <p className="text-3xl font-bold text-blue-700">KES {fee}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 mb-4">
              <p className="text-green-800 font-semibold mb-2">📱 Pay via M-Pesa</p>
              <p className="text-gray-700 text-sm mb-1">Send <strong>KES {fee}</strong> to:</p>
              <p className="text-2xl font-bold text-green-700 text-center my-2">{MPESA_NUMBER}</p>
            </div>
            <button onClick={() => setStep(2)} className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold">I have paid ✓</button>
          </div>
        )}
        {step === 2 && (
          <div>
            <input className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="M-Pesa code e.g. QGH7X8Y9Z0" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
            <a href={waLink} target="_blank" rel="noreferrer" className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold block text-center mb-3" onClick={() => setStep(3)}>📱 Send Payment Proof</a>
            <button onClick={() => setStep(3)} className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-semibold">Skip</button>
          </div>
        )}
        {step === 3 && (
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-bold mb-2">Payment Submitted!</h3>
            <p className="text-gray-500 mb-4">Your listing goes live after payment verification.</p>
            <button onClick={onSuccess} className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold">Submit My Listing</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ListingCard({ listing }) {
  const [showPayment, setShowPayment] = useState(false)
  const isAirbnb = listing.type === 'airbnb'
  const position = [-0.6831, 37.0]
  return (
    <div className="bg-white rounded-xl shadow-md mb-4 border border-gray-100 overflow-hidden">
      {showPayment && <PaymentModal listing={listing} onClose={() => setShowPayment(false)} />}
      {listing.images && listing.images.length > 0 && (
        <div className="flex overflow-x-auto gap-2 p-2 bg-gray-50">
          {listing.images.map((img, i) => <img key={i} src={img} alt="house" className="h-40 w-56 object-cover rounded-lg flex-shrink-0" />)}
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xl font-bold text-green-700">{listing.title}</h3>
          {isAirbnb && <span className="bg-orange-100 text-orange-600 text-xs px-2 py-1 rounded-full">🏨 Short Stay</span>}
          {listing.status === 'taken' && <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">❌ Taken</span>}
        </div>
        <p className="text-gray-600 text-sm mb-1">📍 {listing.location}</p>
        <p className="text-gray-600 text-sm mb-1">🛏 {listing.bedrooms} Bedroom(s)</p>
        {isAirbnb ? <p className="text-orange-600 font-semibold mb-1">💰 KES {listing.price.toLocaleString()}/night</p> : <p className="text-green-800 font-semibold mb-1">💰 KES {listing.price.toLocaleString()}/month</p>}
        {listing.amenities && listing.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {listing.amenities.map((a, i) => <span key={i} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{a}</span>)}
          </div>
        )}
        <p className="text-gray-500 text-sm mb-3">{listing.description}</p>
        {listing.status !== 'taken' && (
          <>
            <div className="bg-yellow-50 rounded-lg px-3 py-2 mb-3 text-sm text-yellow-800">🔒 Contact revealed after payment</div>
            <button onClick={() => setShowPayment(true)} className={isAirbnb ? "w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium" : "w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium"}>
              {isAirbnb ? '🏨 Book Now — KES ' + listing.price.toLocaleString() + '/night' : '🔍 Request Viewing — KES 250'}
            </button>
          </>
        )}
        <div style={{ height: '150px', borderRadius: '8px', overflow: 'hidden', marginTop: '12px' }}>
          <MapContainer center={position} zoom={6} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={position}><Popup>{listing.title} - {listing.location}</Popup></Marker>
          </MapContainer>
        </div>
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
      <h2 className="text-xl font-bold text-gray-800 mb-4">My Listings ({myListings.length})</h2>
      {myListings.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl">
          <div className="text-4xl mb-3">🏠</div>
          <p className="text-gray-500">You have no listings yet.</p>
        </div>
      )}
      {myListings.map(listing => (
        <div key={listing.id} className="bg-white rounded-xl shadow-md mb-4 p-4 border border-gray-100">
          {listing.images && listing.images.length > 0 && (
            <img src={listing.images[0]} alt="house" className="w-full h-40 object-cover rounded-lg mb-3" />
          )}
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-green-700">{listing.title}</h3>
            <span className={listing.status === 'taken' ? 'bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full' : 'bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full'}>
              {listing.status === 'taken' ? '❌ Taken' : '✅ Available'}
            </span>
          </div>
          <p className="text-gray-600 text-sm mb-1">📍 {listing.location}</p>
          <p className="text-gray-600 text-sm mb-3">{listing.type === 'airbnb' ? '💰 KES ' + listing.price.toLocaleString() + '/night' : '💰 KES ' + listing.price.toLocaleString() + '/month'}</p>
          <div className="flex gap-2">
            <button onClick={() => toggleStatus(listing)} className={listing.status === 'taken' ? 'flex-1 bg-green-100 text-green-700 py-2 rounded-lg text-sm font-medium' : 'flex-1 bg-red-100 text-red-700 py-2 rounded-lg text-sm font-medium'}>
              {listing.status === 'taken' ? '✅ Mark Available' : '❌ Mark as Taken'}
            </button>
            <button onClick={() => deleteListing(listing)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium">🗑 Delete</button>
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
    <div className="py-8">
      <div className="bg-white rounded-xl shadow-md p-6 w-full max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-green-700 text-center mb-2">Landlord Portal</h2>
        <p className="text-gray-500 text-center text-sm mb-6">Login or register to list your property</p>
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setMode('login')} className={mode === 'login' ? 'flex-1 py-2 rounded-lg bg-white font-medium text-green-700 shadow-sm' : 'flex-1 py-2 rounded-lg text-gray-500'}>Login</button>
          <button onClick={() => setMode('register')} className={mode === 'register' ? 'flex-1 py-2 rounded-lg bg-white font-medium text-green-700 shadow-sm' : 'flex-1 py-2 rounded-lg text-gray-500'}>Register</button>
        </div>
        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
        <input className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button onClick={handleSubmit} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
          {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
        </button>
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
    onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthChecked(true)
    })
  }, [])

  const fetchListings = async () => {
    try {
      const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setListings(data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { fetchListings() }, [])

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 5)
    setImages(files)
    setPreviews(files.map(f => URL.createObjectURL(f)))
  }

  const toggleAmenity = (a) => {
    setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

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
      if (images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          setUploadProgress('Uploading photo ' + (i + 1) + ' of ' + images.length + '...')
          const url = await uploadImage(images[i])
          imageUrls.push(url)
        }
      }
      setUploadProgress('Saving listing...')
      const newListing = {
        title: form.title,
        location: form.location,
        price: parseInt(form.price),
        bedrooms: parseInt(form.bedrooms),
        phone: form.phone,
        description: form.description,
        type: form.type,
        amenities: form.type === 'airbnb' ? amenities : [],
        images: imageUrls,
        createdAt: new Date(),
        landlordEmail: user.email,
        status: 'available'
      }
      const docRef = await addDoc(collection(db, 'listings'), newListing)
      setListings([{ id: docRef.id, ...newListing }, ...listings])
      setForm({ title: '', location: '', price: '', bedrooms: '1', phone: '', description: '', type: 'rental' })
      setAmenities([])
      setImages([])
      setPreviews([])
      setUploadProgress('')
      setSubmitted(true)
      setTimeout(() => { setSubmitted(false); setPage('dashboard') }, 2000)
    } catch (e) {
      alert('Error saving listing.')
      console.error(e)
    }
    setSubmitting(false)
  }

  const navBtn = (target, label) => (
    <button onClick={() => setPage(target)} className={page === target ? 'px-4 py-2 rounded-lg text-sm font-medium bg-white text-green-700' : 'px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white'}>
      {label}
    </button>
  )

  if (!authChecked) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>

  return (
    <div className="min-h-screen bg-gray-100">
      {showLandlordPayment && <LandlordPaymentModal listingType={form.type} onSuccess={submitListing} onClose={() => setShowLandlordPayment(false)} />}
      <div className="bg-green-700 text-white p-4 text-center shadow-md">
        <h1 className="text-3xl font-bold">🏠 Kodi254</h1>
        <p className="text-green-200 text-sm mb-3">Find your perfect home in Kenya</p>
        <div className="flex justify-center gap-2 flex-wrap">
          {navBtn('home', 'Home')}
          {navBtn('search', 'Search')}
          {user ? (
            <>
              {navBtn('dashboard', 'My Listings')}
              {navBtn('list', 'Add Listing')}
              <button onClick={() => signOut(auth)} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white">Logout</button>
            </>
          ) : (
            <button onClick={() => setPage('auth')} className="px-4 py-2 rounded-lg text-sm font-medium bg-yellow-500 text-white">Landlord Login</button>
          )}
        </div>
        {user && <p className="text-green-200 text-xs mt-1">Logged in as {user.email}</p>}
      </div>

      <div className="max-w-2xl mx-auto p-4">

        {page === 'auth' && <AuthPage onAuth={() => setPage('dashboard')} />}

        {page === 'dashboard' && user && <LandlordDashboard user={user} allListings={listings} onUpdate={fetchListings} />}

        {page === 'home' && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏘️</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Kodi254</h2>
            <p className="text-gray-500 mb-8">Rentals and short stays across Kenya</p>
            <div className="flex justify-center gap-4 flex-wrap">
              <button onClick={() => { setPage('search'); setFilter('rental') }} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold">🏠 Find Rental</button>
              <button onClick={() => { setPage('search'); setFilter('airbnb') }} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold">🏨 Short Stays</button>
              <button onClick={() => setPage(user ? 'list' : 'auth')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold">➕ List Property</button>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-4 text-center">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-2xl font-bold text-green-700">{listings.length}</div>
                <div className="text-gray-500 text-sm">Listings</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-2xl font-bold text-green-700">0%</div>
                <div className="text-gray-500 text-sm">Agent Fees</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-2xl font-bold text-green-700">🇰🇪</div>
                <div className="text-gray-500 text-sm">Kenya Wide</div>
              </div>
            </div>
          </div>
        )}

        {page === 'search' && (
          <div className="py-4">
            <h2 className="text-xl font-bold text-gray-800 mb-3">Search Properties</h2>
            <input className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="Enter town e.g. Kisii, Nairobi..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="flex gap-2 mb-4">
              <button onClick={() => setFilter('all')} className={filter === 'all' ? 'px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium' : 'px-4 py-2 rounded-lg bg-white text-gray-600 text-sm border'}>All</button>
              <button onClick={() => setFilter('rental')} className={filter === 'rental' ? 'px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium' : 'px-4 py-2 rounded-lg bg-white text-gray-600 text-sm border'}>🏠 Rentals</button>
              <button onClick={() => setFilter('airbnb')} className={filter === 'airbnb' ? 'px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium' : 'px-4 py-2 rounded-lg bg-white text-gray-600 text-sm border'}>🏨 Short Stay</button>
            </div>
            {loading ? (
              <p className="text-center text-gray-400 py-8">Loading listings...</p>
            ) : (
              <div>
                <p className="text-gray-500 text-sm mb-3">{filtered.length} listing(s) found</p>
                {filtered.map(listing => <ListingCard key={listing.id} listing={listing} />)}
                {filtered.length === 0 && <p className="text-center text-gray-400 py-8">No listings found.</p>}
              </div>
            )}
          </div>
        )}

        {page === 'list' && !user && <AuthPage onAuth={() => setPage('list')} />}

        {page === 'list' && user && (
          <div className="py-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">List Your Property</h2>
            <div className="bg-yellow-50 rounded-xl p-4 mb-4">
              <p className="text-yellow-800 font-medium">💡 Listing Fees</p>
              <p className="text-yellow-700 text-sm">Rental — KES 300 | Short Stay — KES 500 (30 days)</p>
            </div>
            {submitted && <div className="bg-green-100 text-green-700 px-4 py-3 rounded-xl mb-4 font-medium">Listing submitted! Redirecting...</div>}
            <div className="bg-white rounded-xl shadow-md p-5">
              <div className="flex gap-2 mb-4">
                <button onClick={() => setForm({ ...form, type: 'rental' })} className={form.type === 'rental' ? 'flex-1 py-3 rounded-lg bg-green-600 text-white font-medium' : 'flex-1 py-3 rounded-lg bg-gray-100 text-gray-600 font-medium'}>🏠 Long Stay</button>
                <button onClick={() => setForm({ ...form, type: 'airbnb' })} className={form.type === 'airbnb' ? 'flex-1 py-3 rounded-lg bg-orange-500 text-white font-medium' : 'flex-1 py-3 rounded-lg bg-gray-100 text-gray-600 font-medium'}>🏨 Short Stay</button>
              </div>
              <input className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="Property title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <input className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="Location/Town" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              <input className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400" placeholder={form.type === 'airbnb' ? 'Price per night (KES)' : 'Rent per month (KES)'} type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
              <select className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })}>
                <option value="1">Bedsitter / 1 Bedroom</option>
                <option value="2">2 Bedrooms</option>
                <option value="3">3 Bedrooms</option>
                <option value="4">4+ Bedrooms</option>
              </select>
              <input className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="Your WhatsApp number e.g. 0712345678" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <textarea className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400 h-24" placeholder="Description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              {form.type === 'airbnb' && (
                <div className="mb-4">
                  <label className="block text-gray-700 font-medium mb-2">Amenities</label>
                  <div className="flex flex-wrap gap-2">
                    {amenityOptions.map(a => (
                      <button key={a} onClick={() => toggleAmenity(a)} className={amenities.includes(a) ? 'px-3 py-1 rounded-full bg-orange-500 text-white text-sm' : 'px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm'}>{a}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">📸 Upload Photos (max 5)</label>
                <input type="file" accept="image/*" multiple onChange={handleImageChange} className="w-full border border-gray-300 rounded-lg px-4 py-3" />
                {previews.length > 0 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto">
                    {previews.map((p, i) => <img key={i} src={p} alt="preview" className="h-24 w-32 object-cover rounded-lg flex-shrink-0" />)}
                  </div>
                )}
              </div>
              {uploadProgress && <p className="text-blue-600 text-sm mb-3">{uploadProgress}</p>}
              <button onClick={handleSubmit} disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                {submitting ? 'Please wait...' : 'Proceed to Payment — KES ' + (form.type === 'airbnb' ? '500' : '300')}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}