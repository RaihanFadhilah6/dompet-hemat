import { useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { auth, db, firebaseReady } from './firebase'
import './App.css'

const DEMO_USER = {
  email: 'user@test.com',
  password: '123456',
  name: 'Ayu',
}

const STORAGE_USER = 'dompet-hemat-user'
const STORAGE_TRANSACTIONS = 'dompet-hemat-transactions'

const seedTransactions = [
  {
    id: 1,
    title: 'Gaji Bulan Ini',
    amount: 2500000,
    type: 'income',
    category: 'Gaji',
    date: '2026-09-01',
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 2,
    title: 'Makan Siang',
    amount: 35000,
    type: 'expense',
    category: 'Makanan',
    date: '2026-09-05',
    createdAt: '2026-09-05T12:30:00.000Z',
  },
  {
    id: 3,
    title: 'Transport',
    amount: 20000,
    type: 'expense',
    category: 'Transport',
    date: '2026-09-10',
    createdAt: '2026-09-10T07:45:00.000Z',
  },
]

const getInitialUser = () => {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(STORAGE_USER)
  return stored ? JSON.parse(stored) : null
}

const getInitialTransactions = () => {
  if (typeof window === 'undefined') return seedTransactions
  const stored = localStorage.getItem(STORAGE_TRANSACTIONS)
  if (!stored) return seedTransactions

  try {
    return JSON.parse(stored)
  } catch {
    return seedTransactions
  }
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)

const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const mapFirebaseTransaction = (docSnap) => {
  const data = docSnap.data()
  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString()

  return {
    id: docSnap.id,
    userId: data.userId,
    title: data.title,
    amount: Number(data.amount) || 0,
    type: data.type,
    category: data.category,
    date: data.date || createdAt.slice(0, 10),
    createdAt,
  }
}

const loadTransactionsForUser = async (userId) => {
  if (!db || !userId) return []

  const q = query(
    collection(db, 'transactions'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(mapFirebaseTransaction)
}

const loadUserProfile = async (uid) => {
  if (!db || !uid) return null

  const profileDoc = await getDoc(doc(db, 'users', uid))
  if (!profileDoc.exists()) return null

  return profileDoc.data()
}

function App() {
  const [user, setUser] = useState(getInitialUser)
  const [transactions, setTransactions] = useState(getInitialTransactions)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({
    name: '',
    email: 'user@test.com',
    password: '123456',
  })
  const [transactionForm, setTransactionForm] = useState({
    title: '',
    amount: '',
    type: 'expense',
    category: 'Makanan',
    date: new Date().toISOString().slice(0, 10),
  })
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!firebaseReady || !auth || !db) {
      localStorage.setItem(STORAGE_TRANSACTIONS, JSON.stringify(transactions))
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null)
        setTransactions([])
        localStorage.removeItem(STORAGE_USER)
        return
      }

      try {
        const profile = await loadUserProfile(currentUser.uid)
        const userData = {
          uid: currentUser.uid,
          email: currentUser.email || '',
          name: profile?.nama || profile?.name || currentUser.email?.split('@')[0] || 'User',
        }

        setUser(userData)
        setTransactions(await loadTransactionsForUser(currentUser.uid))
      } catch {
        setError('Gagal mengambil data pengguna dari Firebase.')
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!firebaseReady || !auth) {
      if (user) {
        localStorage.setItem(STORAGE_USER, JSON.stringify(user))
      } else {
        localStorage.removeItem(STORAGE_USER)
      }
    }
  }, [user])

  useEffect(() => {
    if (!firebaseReady || !auth) {
      localStorage.setItem(STORAGE_TRANSACTIONS, JSON.stringify(transactions))
    }
  }, [transactions])

  const summary = useMemo(() => {
    const income = transactions
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + Number(item.amount), 0)

    const expense = transactions
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + Number(item.amount), 0)

    return {
      income,
      expense,
      balance: income - expense,
    }
  }, [transactions])

  const latestTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [transactions],
  )

  const handleAuthInput = (field, value) => {
    setAuthForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()

    const email = authForm.email.trim().toLowerCase()
    const password = authForm.password.trim()

    if (!firebaseReady || !auth || !db) {
      if (authMode === 'login') {
        if (email === DEMO_USER.email && password === DEMO_USER.password) {
          setUser({ email: DEMO_USER.email, name: DEMO_USER.name })
          setError('')
          return
        }

        setError('Email atau password salah. Coba user@test.com / 123456')
        return
      }

      if (!authForm.name.trim()) {
        setError('Nama harus diisi.')
        return
      }

      if (!email || !password) {
        setError('Email dan password wajib diisi.')
        return
      }

      setUser({ email, name: authForm.name.trim() })
      setError('')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (authMode === 'login') {
        const credential = await signInWithEmailAndPassword(auth, email, password)
        const profile = await loadUserProfile(credential.user.uid)

        setUser({
          uid: credential.user.uid,
          email: credential.user.email || '',
          name: profile?.nama || profile?.name || credential.user.email?.split('@')[0] || 'User',
        })
        setTransactions(await loadTransactionsForUser(credential.user.uid))
      } else {
        if (!authForm.name.trim()) {
          setError('Nama harus diisi.')
          return
        }

        const credential = await createUserWithEmailAndPassword(auth, email, password)
        const profile = {
          uid: credential.user.uid,
          email,
          nama: authForm.name.trim(),
        }

        await setDoc(doc(db, 'users', credential.user.uid), profile)
        setUser({
          uid: credential.user.uid,
          email,
          name: profile.nama,
        })
        setTransactions([])
      }
    } catch (submitError) {
      setError('Gagal masuk. Pastikan Firebase sudah diatur dengan benar.')
    } finally {
      setLoading(false)
    }
  }

  const handleTransactionInput = (field, value) => {
    setTransactionForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleAddTransaction = async (event) => {
    event.preventDefault()

    const title = transactionForm.title.trim()
    const amount = Number(transactionForm.amount)

    if (!title || !amount || amount <= 0) {
      setError('Judul dan nominal transaksi harus valid.')
      return
    }

    if (firebaseReady && auth && db && user?.uid) {
      setLoading(true)
      setError('')

      try {
        const payload = {
          userId: user.uid,
          title,
          amount,
          type: transactionForm.type,
          category: transactionForm.category,
          date: transactionForm.date,
          createdAt: serverTimestamp(),
        }

        await addDoc(collection(db, 'transactions'), payload)
        setTransactions(await loadTransactionsForUser(user.uid))
      } catch {
        setError('Transaksi gagal disimpan ke Firestore.')
      } finally {
        setLoading(false)
      }
    } else {
      const newTransaction = {
        id: Date.now(),
        title,
        amount,
        type: transactionForm.type,
        category: transactionForm.category,
        date: transactionForm.date,
        createdAt: new Date().toISOString(),
      }

      setTransactions((prev) => [newTransaction, ...prev])
    }

    setTransactionForm({
      title: '',
      amount: '',
      type: 'expense',
      category: 'Makanan',
      date: new Date().toISOString().slice(0, 10),
    })
    setShowForm(false)
  }

  const logout = async () => {
    if (firebaseReady && auth) {
      await signOut(auth)
    }

    setUser(null)
    setAuthForm({
      name: '',
      email: 'user@test.com',
      password: '123456',
    })
    setAuthMode('login')
    setError('')
  }

  if (!user) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="brand-block">
            <div className="brand-mark">D</div>
            <h1>Dompet Hemat</h1>
            <p>Kelola pemasukan dan pengeluaran dengan lebih mudah.</p>
          </div>

          {!firebaseReady && (
            <div className="status-banner">
              Firebase belum dikonfigurasi, mode demo aktif.
            </div>
          )}

          <div className="auth-toggle">
            <button
              type="button"
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => setAuthMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={authMode === 'register' ? 'active' : ''}
              onClick={() => setAuthMode('register')}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="auth-form">
            {authMode === 'register' && (
              <label>
                <span>Nama</span>
                <input
                  type="text"
                  value={authForm.name}
                  onChange={(event) => handleAuthInput('name', event.target.value)}
                  placeholder="Masukkan nama"
                />
              </label>
            )}

            <label>
              <span>Email</span>
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => handleAuthInput('email', event.target.value)}
                placeholder="user@test.com"
              />
            </label>

            <label>
              <span>Password</span>
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => handleAuthInput('password', event.target.value)}
                placeholder="••••••"
              />
            </label>

            {error && <p className="error-text">{error}</p>}

            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Memproses...' : authMode === 'login' ? 'Masuk' : 'Buat Akun'}
            </button>
          </form>

          <div className="demo-box">
            <strong>Demo Login</strong>
            <p>Email: user@test.com</p>
            <p>Password: 123456</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Halo, {user.name}</p>
          <h2>Dompet Hemat</h2>
        </div>
        <button type="button" className="link-btn" onClick={logout}>
          Keluar
        </button>
      </header>

      <main className="content">
        <section className="summary-grid">
          <article className="summary-card balance-card">
            <span>Total Saldo</span>
            <strong>{formatCurrency(summary.balance)}</strong>
          </article>

          <article className="summary-card income-card">
            <span>Pemasukan</span>
            <strong>{formatCurrency(summary.income)}</strong>
          </article>

          <article className="summary-card expense-card">
            <span>Pengeluaran</span>
            <strong>{formatCurrency(summary.expense)}</strong>
          </article>
        </section>

        <section className="action-row">
          <button type="button" className="primary-btn" onClick={() => setShowForm(true)}>
            + Tambah Transaksi
          </button>
        </section>

        {showForm && (
          <form className="transaction-form" onSubmit={handleAddTransaction}>
            <h3>Tambah Transaksi</h3>

            <label>
              <span>Judul</span>
              <input
                type="text"
                value={transactionForm.title}
                onChange={(event) => handleTransactionInput('title', event.target.value)}
                placeholder="Contoh: Makan Siang"
              />
            </label>

            <label>
              <span>Nominal</span>
              <input
                type="number"
                min="1"
                value={transactionForm.amount}
                onChange={(event) => handleTransactionInput('amount', event.target.value)}
                placeholder="50000"
              />
            </label>

            <div className="double-field">
              <label>
                <span>Jenis</span>
                <select
                  value={transactionForm.type}
                  onChange={(event) => handleTransactionInput('type', event.target.value)}
                >
                  <option value="expense">Pengeluaran</option>
                  <option value="income">Pemasukan</option>
                </select>
              </label>

              <label>
                <span>Kategori</span>
                <select
                  value={transactionForm.category}
                  onChange={(event) => handleTransactionInput('category', event.target.value)}
                >
                  <option value="Makanan">Makanan</option>
                  <option value="Transport">Transport</option>
                  <option value="Tagihan">Tagihan</option>
                  <option value="Gaji">Gaji</option>
                  <option value="Belanja">Belanja</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </label>
            </div>

            <label>
              <span>Tanggal</span>
              <input
                type="date"
                value={transactionForm.date}
                onChange={(event) => handleTransactionInput('date', event.target.value)}
              />
            </label>

            {error && <p className="error-text">{error}</p>}

            <div className="form-actions">
              <button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>
                Batal
              </button>
              <button type="submit" className="primary-btn" disabled={loading}>
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        )}

        <section className="history-section">
          <div className="section-header">
            <h3>Riwayat Transaksi</h3>
          </div>

          <div className="history-list">
            {latestTransactions.length === 0 ? (
              <div className="empty-state">Belum ada transaksi.</div>
            ) : (
              latestTransactions.map((item) => (
                <article className="history-item" key={item.id}>
                  <div className="history-main">
                    <div>
                      <h4>{item.title}</h4>
                      <p>{item.category}</p>
                    </div>
                    <span className={item.type === 'income' ? 'amount income' : 'amount expense'}>
                      {item.type === 'income' ? '+' : '-'}
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                  <div className="history-meta">
                    <span>{formatDate(item.date)}</span>
                    <span className="pill">{item.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
