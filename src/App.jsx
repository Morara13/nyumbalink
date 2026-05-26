import { useState, useEffect } from 'react'
import { db } from './firebase'
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { collection, addDoc, getDocs, orderBy, query } from 'firebase/firestore'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const auth = getAuth()
const CLOUD_NAME = "dg4dwedsi"
const UPLOAD_PRESET = "kodi254_preset"

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

function ListingCard({ listing }) {
  const waLink = "https://wa.me/254" + listing.phone.substring(1) + "?text=Hi, I am interested in your listing: " + listing.title + " in " + listing.location
  const position = [-0.6831, 37.0]
  const isAirbnb = listing.type === 'airbnb'
  return (
    <div className="bg-white rounded-xl shadow-md mb-4 border border-gray-100 overflow-hidden">
      {listing.images && listing.images.length > 0 && (
        <div className="flex overflow-x-auto gap-2 p-2 bg-gray-50">
          {listing.images.map((img, i) => (
            <img key={i} src={img} alt="house" className="h-40 w-56 object-cover rounded-lg flex-shrink-0" />
          ))}
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xl font-bold text-green-700">{listing.title}</h3>
          {isAirbnb && <span className="bg-orange-100 text-orange-600 text-xs px-2 py-1 rounded-full font-medium">🏨 Short Stay</span>}
        </div>
        <p className="text-gray-600 text-sm mb-1">📍 {listing.location}</p>
        <p className="text-gray-600 text-sm mb-1">🛏 {listing.bedrooms} Bedroom(s)</p>
        {isAirbnb ? (
          <>
            <p className="text-orange-600 font-semibold mb-1">💰 KES {listing.price.toLocaleString()}/night</p>
            {listing.amenities && listing.amenities.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {listing.amenities.map((a, i) => (
                  <span key={i} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{a}</span>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-green-800 font-semibold mb-1">💰 KES {listing.price.toLocaleString()}/month</p>
        )}
        <p className="text-gray-500 text-sm mb-3">{listing.description}</p>
        <a href={waLink} target="_blank" rel="noreferrer"
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium inline-block mb-3">
          📱 Contact on WhatsApp
        </a>
        <div style={{ height: '150px', borderRadius: '8px', overflow: 'hidden' }}>
          <MapContainer center={position} zoom={6} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={position}>
              <Popup>{listing.title} - {listing.location}</Popup>
            </Marker>
          </MapContainer>
        </div>
      </div>
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

  const amenityOptions = ['WiFi', 'Parking', 'Kitchen', 'TV', 'AC', 'Washer', 'Pool', 'Gym', 'Security', 'Water', 'Generator']

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthChecked(true)
    })
  }, [])

  useEffect(() => {
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
    fetchListings()
  }, [])

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
        landlordEmail: user.email
      }
      const docRef = await addDoc(collection(db, 'listings'), newListing)
      setListings([{ id: docRef.id, ...newListing }, ...listings])
      setForm({ title: '', location: '', price: '', bedrooms: '1', phone: '', description: '', type: 'rental' })
      setAmenities([])
      setImages([])
      setPreviews([])
      setUploadProgress('')
      setSubmitted(true)
      setTimeout(() => { setSubmitted(false); setPage('search') }, 2000)
    } catch (e) {
      alert('Error saving listing. Please try again.')
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
      <div className="bg-green-700 text-white p-4 text-center shadow-md">
        <h1 className="text-3xl font-bold">🏠 Kodi254</h1>
        <p className="text-green-200 text-sm mb-3">Find your perfect home in Kenya</p>
        <div className="flex justify-center gap-2 flex-wrap">
          {navBtn('home', 'Home')}
          {navBtn('search', 'Search')}
          {user ? (
            <>
              {navBtn('list', 'List Property')}
              <button onClick={() => signOut(auth)} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white">Logout</button>
            </>
          ) : (
            <button onClick={() => setPage('auth')} className="px-4 py-2 rounded-lg text-sm font-medium bg-yellow-500 text-white">Landlord Login</button>
          )}
        </div>
        {user && <p className="text-green-200 text-xs mt-1">Logged in as {user.email}</p>}
      </div>

      <div className="max-w-2xl mx-auto p-4">

        {page === 'auth' && <AuthPage onAuth={() => setPage('list')} />}

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
            {submitted && <div className="bg-green-100 text-green-700 px-4 py-3 rounded-xl mb-4 font-medium">Listing saved! Redirecting...</div>}
            <div className="bg-white rounded-xl shadow-md p-5">

              <div className="flex gap-2 mb-4">
                <button onClick={() => setForm({ ...form, type: 'rental' })} className={form.type === 'rental' ? 'flex-1 py-3 rounded-lg bg-green-600 text-white font-medium' : 'flex-1 py-3 rounded-lg bg-gray-100 text-gray-600 font-medium'}>🏠 Long Stay Rental</button>
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
              <input className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="WhatsApp number e.g. 0712345678" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <textarea className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400 h-24" placeholder="Description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

              {form.type === 'airbnb' && (
                <div className="mb-4">
                  <label className="block text-gray-700 font-medium mb-2">Amenities</label>
                  <div className="flex flex-wrap gap-2">
                    {amenityOptions.map(a => (
                      <button key={a} onClick={() => toggleAmenity(a)} className={amenities.includes(a) ? 'px-3 py-1 rounded-full bg-orange-500 text-white text-sm' : 'px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm'}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">📸 Upload Photos (max 5)</label>
                <input type="file" accept="image/*" multiple onChange={handleImageChange} className="w-full border border-gray-300 rounded-lg px-4 py-3" />
                {previews.length > 0 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto">
                    {previews.map((p, i) => (
                      <img key={i} src={p} alt="preview" className="h-24 w-32 object-cover rounded-lg flex-shrink-0" />
                    ))}
                  </div>
                )}
              </div>

              {uploadProgress && <p className="text-blue-600 text-sm mb-3">{uploadProgress}</p>}
              <button onClick={handleSubmit} disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                {submitting ? 'Please wait...' : 'Submit Listing'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}