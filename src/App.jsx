import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, addDoc, getDocs, orderBy, query } from 'firebase/firestore'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

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
        <h3 className="text-xl font-bold text-green-700 mb-1">{listing.title}</h3>
        <p className="text-gray-600 text-sm mb-1">📍 {listing.location}</p>
        <p className="text-gray-600 text-sm mb-1">🛏 {listing.bedrooms} Bedroom(s)</p>
        <p className="text-green-800 font-semibold mb-1">💰 KES {listing.price.toLocaleString()}/month</p>
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

export default function App() {
  const [page, setPage] = useState('home')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ title: '', location: '', price: '', bedrooms: '1', phone: '', description: '' })
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [images, setImages] = useState([])
  const [previews, setPreviews] = useState([])
  const [uploadProgress, setUploadProgress] = useState('')

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

  const filtered = listings.filter(l =>
    l.location?.toLowerCase().includes(search.toLowerCase()) ||
    l.title?.toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = async () => {
    if (!form.title || !form.location || !form.price || !form.phone) {
      alert('Please fill all required fields!')
      return
    }
    setSubmitting(true)
    try {
      let imageUrls = []
      if (images.length > 0) {
        setUploadProgress('Uploading photos...')
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
        images: imageUrls,
        createdAt: new Date()
      }
      const docRef = await addDoc(collection(db, 'listings'), newListing)
      setListings([{ id: docRef.id, ...newListing }, ...listings])
      setForm({ title: '', location: '', price: '', bedrooms: '1', phone: '', description: '' })
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
    <button
      onClick={() => setPage(target)}
      className={page === target ? 'px-4 py-2 rounded-lg text-sm font-medium bg-white text-green-700' : 'px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white'}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-green-700 text-white p-4 text-center shadow-md">
        <h1 className="text-3xl font-bold">🏠 Kodi254</h1>
        <p className="text-green-200 text-sm mb-3">Find your perfect home in Kenya</p>
        <div className="flex justify-center gap-2">
          {navBtn('home', 'Home')}
          {navBtn('search', 'Search')}
          {navBtn('list', 'List a House')}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">

        {page === 'home' && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏘️</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Kodi254</h2>
            <p className="text-gray-500 mb-8">Connecting tenants with landlords across Kenya</p>
            <div className="flex justify-center gap-4">
              <button onClick={() => setPage('search')} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold">🔍 Find a House</button>
              <button onClick={() => setPage('list')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold">➕ List Your House</button>
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
            <h2 className="text-xl font-bold text-gray-800 mb-3">Search for a House</h2>
            <input
              className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Enter town e.g. Kisii, Nairobi..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
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

        {page === 'list' && (
          <div className="py-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">List Your House</h2>
            {submitted && <div className="bg-green-100 text-green-700 px-4 py-3 rounded-xl mb-4 font-medium">Listing saved! Redirecting...</div>}
            <div className="bg-white rounded-xl shadow-md p-5">
              <input className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="Title e.g. 2 Bedroom in Kisii Town" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              <input className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="Location/Town" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              <input className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="Rent per month (KES)" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
              <select className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })}>
                <option value="1">Bedsitter / 1 Bedroom</option>
                <option value="2">2 Bedrooms</option>
                <option value="3">3 Bedrooms</option>
                <option value="4">4+ Bedrooms</option>
              </select>
              <input className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400" placeholder="WhatsApp number e.g. 0712345678" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <textarea className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400 h-24" placeholder="Description of the house..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">📸 Upload House Photos (max 5)</label>
                <input type="file" accept="image/*" multiple onChange={handleImageChange} className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none" />
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