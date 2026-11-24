import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowDownLeft, ArrowRight, Bell, Check, CheckCheck, ChevronDown, CircleHelp,
  Clock3, Coffee, Heart, Home, LogOut, Moon, MoreHorizontal, Pencil, Plus, Search,
  Settings, ShoppingBag, ShoppingBasket, Sun, Trash2, Users, X, Zap,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { translate } from './lib/i18n'
import { categorySeeds, inferCategory } from './lib/categories'
import {
  addItem, createFamily, createInvite, deleteItem, getActivity, getCategories, getFamilyItems,
  getFamilyMembers, getInvite, getPreferences, getPurchaseHistory, getShoppingSessions,
  getFamilies, joinFamily, savePreferences, saveProfile, setPurchased, startShopping,
  stopShopping, syncOperations, touchShoppingSession, updateItem,
} from './lib/data'
import { cacheItems, queueOperation, queuedOperations, readCachedItems } from './lib/offline'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Category, Family, FamilyMember, Language, Page, Profile, ShoppingItem, ShoppingSession } from './types'

interface ToastMessage {
  text: string
  kind: 'success' | 'error'
}

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])
  return online
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? '').join('')
}

function friendlyDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar' : language === 'en' ? 'en' : 'nl', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [families, setFamilies] = useState<Family[]>([])
  const [family, setFamily] = useState<Family | null>(null)
  const [language, setLanguage] = useState<Language>('nl')
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [booting, setBooting] = useState(true)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)

  const notify = useCallback((text: string, kind: ToastMessage['kind'] = 'success') => {
    setToast({ text, kind })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    if (!supabase) {
      setBooting(false)
      return
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user || !supabase) {
      setBooting(false)
      setProfile(null)
      setFamilies([])
      setFamily(null)
      return
    }
    let active = true
    setBooting(true)
    void (async () => {
      try {
        const [profileResult, familyRows, preferences] = await Promise.all([
          supabase.from('profiles').select('id,display_name,avatar_url').eq('id', user.id).maybeSingle(),
          getFamilies(user.id),
          getPreferences(user.id),
        ])
        if (profileResult.error) throw new Error(profileResult.error.message)
        if (!active) return
        setProfile(profileResult.data as Profile | null)
        setFamilies(familyRows)
        setFamily((current) => familyRows.find((candidate) => candidate.id === current?.id) ?? familyRows[0] ?? null)
        if (preferences?.language === 'nl' || preferences?.language === 'en' || preferences?.language === 'ar') {
          setLanguage(preferences.language)
        }
        if (preferences?.theme === 'light' || preferences?.theme === 'dark' || preferences?.theme === 'system') {
          setTheme(preferences.theme)
        }
      } catch (error) {
        if (active) notify(error instanceof Error ? error.message : t('error'), 'error')
      } finally {
        if (active) setBooting(false)
      }
    })()
    return () => { active = false }
  }, [user, notify])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#151d19' : '#f7f8f3')
  }, [language, theme])

  const onFamilyJoined = async (familyId: string) => {
    if (!user) return
    const rows = await getFamilies(user.id)
    setFamilies(rows)
    setFamily(rows.find((row) => row.id === familyId) ?? rows[0] ?? null)
  }

  if (!isSupabaseConfigured) {
    return <SetupScreen />
  }
  if (booting) return <LoadingScreen />
  if (!user) return <AuthScreen notify={notify} language={language} setLanguage={setLanguage} />
  if (!families.length || !family) {
    return <FamilySetup user={user} language={language} onJoined={onFamilyJoined} notify={notify} onSignOut={() => void supabase?.auth.signOut()} />
  }

  return (
    <>
      <Workspace
        user={user}
        profile={profile}
        family={family}
        families={families}
        language={language}
        theme={theme}
        setLanguage={setLanguage}
        setTheme={setTheme}
        onFamilyChange={setFamily}
        onSignOut={() => void supabase?.auth.signOut()}
        onProfileChange={setProfile}
        notify={notify}
      />
      {toast && <div role="status" className={`toast toast-${toast.kind}`}><span>{toast.kind === 'success' ? <Check size={17} /> : <CircleHelp size={17} />}</span>{toast.text}</div>}
    </>
  )
}

function SetupScreen() {
  return (
    <main className="setup-screen">
      <div className="setup-card">
        <BrandMark />
        <span className="eyebrow">FAMILYCART</span>
        <h1>Verbind je gezin.</h1>
        <p>FamilyCart is klaar om te starten. Configureer eerst een eigen Supabase-project, zodat je gezinsgegevens privé blijven.</p>
        <div className="setup-steps">
          <div><span>1</span><p>Maak een Supabase-project aan en voer de SQL-migratie uit.</p></div>
          <div><span>2</span><p>Kopieer <code>.env.example</code> naar <code>.env.local</code> en vul je projectgegevens in.</p></div>
          <div><span>3</span><p>Herstart de ontwikkelserver. Daarna kun je een account en gezin maken.</p></div>
        </div>
        <div className="notice"><CircleHelp size={17} /><span>Er worden geen demo- of voorbeeldaccounts gebruikt.</span></div>
      </div>
    </main>
  )
}

function AuthScreen({ notify, language, setLanguage }: {
  notify: (text: string, kind?: ToastMessage['kind']) => void
  language: Language
  setLanguage: (language: Language) => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    try {
      const result = mode === 'register'
        ? await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim() } } })
        : await supabase.auth.signInWithPassword({ email, password })
      if (result.error) throw result.error
      if (mode === 'register' && !result.data.session) {
        notify(t('confirmEmail'))
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : t('error'), 'error')
    } finally {
      setBusy(false)
    }
  }
  const tryDemo = async () => {
    if (!supabase || !import.meta.env.VITE_DEMO_EMAIL || !import.meta.env.VITE_DEMO_PASSWORD) return
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: import.meta.env.VITE_DEMO_EMAIL,
        password: import.meta.env.VITE_DEMO_PASSWORD,
      })
      if (error) throw error
    } catch (error) {
      notify(error instanceof Error ? error.message : t('error'), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-visual">
        <div className="visual-brand"><BrandMark /><span>FamilyCart</span></div>
        <div className="visual-copy">
          <span className="eyebrow">{t('authVisualKicker')}</span>
          <h1>{t('authVisualTitle')}</h1>
          <p>{t('authVisualDescription')}</p>
          <div className="visual-card">
            <div className="mini-avatar">M</div><div className="mini-copy"><strong>{t('authCardTitle')}</strong><span>{t('authCardDescription')}</span></div><span className="live-dot" />
          </div>
        </div>
        <span className="visual-footer">{t('authFooter')}</span>
      </section>
      <section className="auth-panel">
        <div className="auth-topline">
          <span>{t('tagline')}</span>
          <select aria-label={t('language')} value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
            <option value="nl">NL</option><option value="en">EN</option><option value="ar">عربي</option>
          </select>
        </div>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <span className="eyebrow">{mode === 'login' ? t('welcomeBack') : t('startTogether')}</span>
          <h2>{mode === 'login' ? t('signIn') : t('signUp')}</h2>
          <p className="muted">{mode === 'login' ? t('loginIntro') : t('registerIntro')}</p>
          {mode === 'register' && <label>{t('name')}<input autoComplete="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>}
          <label>{t('email')}<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>{t('password')}<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button className="button button-primary button-wide" type="submit" disabled={busy}>{busy ? t('loading') : mode === 'login' ? t('signIn') : t('signUp')}<ArrowRight size={17} /></button>
          {import.meta.env.VITE_DEMO_EMAIL && import.meta.env.VITE_DEMO_PASSWORD && <button className="button button-secondary button-wide" type="button" onClick={() => void tryDemo()} disabled={busy}>{t('tryDemo')}<ArrowRight size={17} /></button>}
          <p className="auth-switch">{mode === 'login' ? t('noAccount') : t('existingAccount')} <button type="button" className="text-button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? t('signUp') : t('signIn')}</button></p>
          <span className="auth-secure"><span className="live-dot" /> {t('privacyPromise')}</span>
        </form>
      </section>
    </main>
  )
}

function FamilySetup({ user, language, onJoined, notify, onSignOut }: {
  user: User
  language: Language
  onJoined: (familyId: string) => Promise<void>
  notify: (text: string, kind?: ToastMessage['kind']) => void
  onSignOut: () => void
}) {
  const [familyName, setFamilyName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)
  const create = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const family = await createFamily(familyName, user.id)
      await onJoined(family.id)
    } catch (error) {
      notify(error instanceof Error ? error.message : t('error'), 'error')
    } finally { setBusy(false) }
  }
  const join = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const familyId = await joinFamily(code)
      await onJoined(familyId)
    } catch (error) {
      notify(error instanceof Error ? error.message : t('error'), 'error')
    } finally { setBusy(false) }
  }
  return (
    <main className="onboarding-screen">
      <header className="onboarding-header"><BrandMark /><span>FamilyCart</span><button className="icon-button" aria-label={t('signOut')} onClick={onSignOut}><LogOut size={18} /></button></header>
      <section className="onboarding-content">
      <span className="eyebrow">{t('onboardingEyebrow')}</span>
      <h1>{t('familyQuestion')}</h1>
      <p className="muted">{t('familyPrompt')}</p>
        <div className="onboarding-grid">
          <form className="onboarding-card" onSubmit={(event) => void create(event)}>
            <div className="card-icon"><Users size={20} /></div>
            <h2>{t('createFamily')}</h2><p>{t('familyCreateHint')}</p>
            <label>{t('familyName')}<input required maxLength={80} value={familyName} onChange={(event) => setFamilyName(event.target.value)} placeholder={t('familyExample')} /></label>
            <button className="button button-primary button-wide" disabled={busy}>{t('create')}<ArrowRight size={17} /></button>
          </form>
          <form className="onboarding-card" onSubmit={(event) => void join(event)}>
            <div className="card-icon card-icon-lime"><ShoppingBag size={20} /></div>
            <h2>{t('joinFamily')}</h2><p>{t('familyJoinHint')}</p>
            <label>{t('inviteCode')}<input required minLength={8} maxLength={20} autoCapitalize="characters" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABC123…" /></label>
            <button className="button button-secondary button-wide" disabled={busy}>{t('join')}<ArrowRight size={17} /></button>
          </form>
        </div>
      </section>
    </main>
  )
}

function Workspace({ user, profile, family, families, language, theme, setLanguage, setTheme, onFamilyChange, onSignOut, onProfileChange, notify }: {
  user: User
  profile: Profile | null
  family: Family
  families: Family[]
  language: Language
  theme: 'light' | 'dark' | 'system'
  setLanguage: (language: Language) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  onFamilyChange: (family: Family) => void
  onSignOut: () => void
  onProfileChange: (profile: Profile) => void
  notify: (text: string, kind?: ToastMessage['kind']) => void
}) {
  const online = useOnlineStatus()
  const [page, setPage] = useState<Page>('home')
  const [items, setItems] = useState<ShoppingItem[]>(() => readCachedItems(family.id))
  const [categories, setCategories] = useState<Category[]>(categorySeeds.map((seed) => ({ ...seed, id: seed.name_nl })))
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [sessions, setSessions] = useState<ShoppingSession[]>([])
  const [activity, setActivity] = useState<{ id: string; action: string; item_name: string; created_at: string; actor?: { display_name: string } | null }[]>([])
  const [history, setHistory] = useState<{ id: string; item_name: string; quantity: number; unit: string | null; purchased_at: string; purchaser?: { display_name: string } | null; category?: Category | null }[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ShoppingItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(() => queuedOperations(family.id).length)
  const [realtimeReady, setRealtimeReady] = useState(false)
  const [activeInvite, setActiveInvite] = useState<{ id: string; expires_at: string } | null>(null)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const t = useCallback((key: Parameters<typeof translate>[1]) => translate(language, key), [language])

  const refresh = useCallback(async () => {
    const [itemRows, categoryRows, memberRows, sessionRows, activityRows, historyRows, inviteRow] = await Promise.all([
      getFamilyItems(family.id), getCategories(), getFamilyMembers(family.id), getShoppingSessions(family.id),
      getActivity(family.id), getPurchaseHistory(family.id), getInvite(family.id),
    ])
    setItems(itemRows)
    cacheItems(family.id, itemRows)
    setCategories(categoryRows)
    setMembers(memberRows)
    setSessions(sessionRows)
    setActivity(activityRows)
    setHistory(historyRows)
    setActiveInvite(inviteRow)
    setPendingCount(queuedOperations(family.id).length)
  }, [family.id])

  useEffect(() => {
    setInviteCode('')
    setPendingCount(queuedOperations(family.id).length)
    let active = true
    setItems(readCachedItems(family.id))
    setLoading(true)
    void refresh()
      .catch((error: unknown) => notify(error instanceof Error ? error.message : t('error'), 'error'))
      .finally(() => { if (active) setLoading(false) })
    const channel = supabase?.channel(`family:${family.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items', filter: `family_id=eq.${family.id}` }, () => { void refresh().catch((error) => notify(error instanceof Error ? error.message : t('error'), 'error')) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_sessions', filter: `family_id=eq.${family.id}` }, () => { void refresh().catch((error) => notify(error instanceof Error ? error.message : t('error'), 'error')) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `family_id=eq.${family.id}` }, () => { void refresh().catch((error) => notify(error instanceof Error ? error.message : t('error'), 'error')) })
      .subscribe((status) => setRealtimeReady(status === 'SUBSCRIBED'))
    return () => {
      active = false
      if (channel) void supabase?.removeChannel(channel)
    }
  }, [family.id, refresh, notify, t])

  useEffect(() => {
    if (!online) return
    void syncOperations(family.id)
      .then((duplicates) => {
        if (duplicates > 0) notify(t('duplicate'), 'error')
        return refresh()
      })
      .then(() => setPendingCount(0))
      .catch((error: unknown) => notify(error instanceof Error ? error.message : t('error'), 'error'))
  }, [online, family.id, refresh, notify, t])

  useEffect(() => {
    if (!online || !sessions.some((session) => session.user_id === user.id)) return
    const timer = window.setInterval(() => {
      void touchShoppingSession(family.id, user.id).catch((error: unknown) => notify(error instanceof Error ? error.message : t('error'), 'error'))
    }, 5 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [online, sessions, family.id, user.id, notify, t])

  useEffect(() => {
    if (!online || sessions.length === 0) return
    const timer = window.setInterval(() => {
      void getShoppingSessions(family.id).then(setSessions).catch((error: unknown) => notify(error instanceof Error ? error.message : t('error'), 'error'))
    }, 3 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [online, sessions.length, family.id, notify, t])

  const activeItems = useMemo(() => items.filter((item) => !item.purchased_at), [items])
  const boughtItems = useMemo(() => items.filter((item) => item.purchased_at), [items])
  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return activeItems.filter((item) => !query || item.name.toLocaleLowerCase().includes(query) || item.note?.toLocaleLowerCase().includes(query))
      .sort((a, b) => Number(b.is_urgent) - Number(a.is_urgent) || (a.category?.sort_order ?? 99) - (b.category?.sort_order ?? 99) || a.name.localeCompare(b.name))
  }, [activeItems, search])
  const percentBought = items.length ? Math.round((boughtItems.length / items.length) * 100) : 0

  const applyOptimistic = (next: ShoppingItem[]) => {
    setItems(next)
    cacheItems(family.id, next)
  }

  const addProduct = async (name: string, quantity = 1, unit = '', note = '', urgent = false) => {
    const normalized = name.trim()
    if (!normalized) return
    if (activeItems.some((item) => item.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) {
      notify(t('duplicate'), 'error')
      return
    }
    const category = inferCategory(normalized, categories.length ? categories : categorySeeds.map((seed) => ({ ...seed, id: seed.name_nl })))
    const item: ShoppingItem = {
      id: crypto.randomUUID(),
      family_id: family.id,
      name: normalized,
      quantity,
      unit: unit.trim() || null,
      note: note.trim() || null,
      category_id: category.id,
      category,
      is_urgent: urgent,
      is_favorite: false,
      created_by: user.id,
      created_at: new Date().toISOString(),
      purchased_at: null,
      purchased_by: null,
      creator: profile ?? undefined,
      pending: !online,
    }
    if (!online) {
      queueOperation(family.id, { id: crypto.randomUUID(), type: 'add', item })
      const next = [item, ...items]
      applyOptimistic(next)
      setPendingCount((count) => count + 1)
      notify(t('syncPending'))
      return
    }
    try {
      await addItem(item)
      await refresh()
      notify(`${item.name} ${t('addedToast')}`)
    } catch (error) {
      if (error instanceof Error && error.message === 'DUPLICATE_ACTIVE_ITEM') notify(t('duplicate'), 'error')
      else notify(error instanceof Error ? error.message : t('error'), 'error')
    }
  }

  const togglePurchased = async (item: ShoppingItem) => {
    const bought = !item.purchased_at
    const next = items.map((row) => row.id === item.id ? {
      ...row,
      purchased_at: bought ? new Date().toISOString() : null,
      purchased_by: bought ? user.id : null,
      purchaser: bought ? profile : null,
      pending: !online || row.pending,
    } : row)
    applyOptimistic(next)
    if (!online) {
      queueOperation(family.id, { id: crypto.randomUUID(), type: 'purchase', itemId: item.id, purchased: bought })
      setPendingCount((count) => count + 1)
      return
    }
    try {
      await setPurchased(item.id, bought)
      await refresh()
    } catch (error) {
      applyOptimistic(items)
      notify(error instanceof Error ? error.message : t('error'), 'error')
    }
  }

  const removeProduct = async (item: ShoppingItem) => {
    const previous = items
    applyOptimistic(items.filter((row) => row.id !== item.id))
    if (!online) {
      queueOperation(family.id, { id: crypto.randomUUID(), type: 'delete', itemId: item.id })
      setPendingCount((count) => count + 1)
      return
    }
    try {
      await deleteItem(item.id)
      await refresh()
    } catch (error) {
      applyOptimistic(previous)
      notify(error instanceof Error ? error.message : t('error'), 'error')
    }
  }

  const changeItem = async (item: ShoppingItem, changes: Partial<ShoppingItem>) => {
    const updated = { ...item, ...changes }
    applyOptimistic(items.map((row) => row.id === item.id ? updated : row))
    setEditing(null)
    if (!online) {
      queueOperation(family.id, { id: crypto.randomUUID(), type: 'update', itemId: item.id, changes })
      setPendingCount((count) => count + 1)
      return
    }
    try {
      await updateItem(item.id, changes)
      await refresh()
    } catch (error) {
      await refresh().catch(() => undefined)
      notify(error instanceof Error ? error.message : t('error'), 'error')
    }
  }

  const toggleFavorite = (item: ShoppingItem) => void changeItem(item, { is_favorite: !item.is_favorite })
  const quickAdd = (name: string) => void addProduct(name)
  const invite = async () => {
    setInviteBusy(true)
    try {
      const code = await createInvite(family.id)
      setInviteCode(code)
      const inviteMeta = await getInvite(family.id)
      setActiveInvite(inviteMeta)
      await navigator.clipboard.writeText(code)
      notify(t('copied'))
    } catch (error) {
      notify(error instanceof Error ? error.message : t('error'), 'error')
    } finally { setInviteBusy(false) }
  }

  const navItems: { id: Page; label: string; icon: typeof Home }[] = [
    { id: 'home', label: t('home'), icon: Home },
    { id: 'list', label: t('list'), icon: ShoppingBasket },
    { id: 'shop', label: t('shop'), icon: ShoppingBag },
    { id: 'history', label: t('history'), icon: Clock3 },
    { id: 'family', label: t('family'), icon: Users },
    { id: 'settings', label: t('settings'), icon: Settings },
  ]

  const handleProfileSaved = async (name: string, avatar: string) => {
    try {
      await saveProfile(user.id, name, avatar)
      const { data, error } = await supabase!.from('profiles').select('id,display_name,avatar_url').eq('id', user.id).single()
      if (error) throw new Error(error.message)
      notify(t('profileSaved'))
      onProfileChange(data as Profile)
      return data as Profile
    } catch (error) {
      notify(error instanceof Error ? error.message : t('error'), 'error')
      return null
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand-lockup" href="#" onClick={(event) => { event.preventDefault(); setPage('home') }}><BrandMark /><span>FamilyCart</span></a>
        <div className="family-switcher">
          <div className="family-avatar">{initials(family.name)}</div>
          <div className="family-switcher-copy"><span>{t('yourFamily')}</span>
            {families.length > 1
                ? <select aria-label={t('chooseFamily')} value={family.id} onChange={(event) => { const selected = families.find((row) => row.id === event.target.value); if (selected) onFamilyChange(selected) }}>{families.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
              : <strong>{family.name}</strong>}
          </div><ChevronDown size={15} className="muted-icon" />
        </div>
        <nav className="side-nav" aria-label="Hoofdnavigatie">
          <span className="nav-caption">{t('sideMenu')}</span>
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-link ${page === id ? 'selected' : ''}`} onClick={() => setPage(id)}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{id === 'list' && activeItems.length > 0 && <span className="nav-count">{activeItems.length}</span>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-card">
            <span className={`connection-indicator ${online && realtimeReady ? 'is-online' : ''}`} />
            <div><strong>{online ? realtimeReady ? t('synced') : t('connecting') : t('offline')}</strong><span>{pendingCount ? `${pendingCount} · ${t('syncPending')}` : online ? realtimeReady ? t('realtimeConnected') : t('realtimeRestoring') : t('localChangesSaved')}</span></div>
          </div>
          <button className="profile-menu" onClick={() => setPage('settings')}>
            <Avatar profile={profile} name={profile?.display_name ?? user.email ?? 'FC'} />
            <span><strong>{profile?.display_name ?? user.email}</strong><small>{user.email}</small></span><MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-family"><span className="family-avatar family-avatar-small">{initials(family.name)}</span>{families.length > 1 ? <select aria-label={t('chooseFamily')} value={family.id} onChange={(event) => { const selected = families.find((row) => row.id === event.target.value); if (selected) onFamilyChange(selected) }}>{families.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select> : <strong>{family.name}</strong>}<span className="topbar-dot">·</span><span>{members.length} {t('members').toLocaleLowerCase()}</span></div>
          <div className="topbar-actions"><span className={`live-badge ${online && realtimeReady ? '' : 'offline-badge'}`}><span className="live-dot" />{online ? realtimeReady ? 'Live' : t('connecting') : t('offline')}</span><button className="avatar-button" onClick={() => setPage('settings')} aria-label={t('profile')}><Avatar profile={profile} name={profile?.display_name ?? 'FC'} /></button></div>
        </header>
        <div className="page-container">
          {page === 'home' && <Dashboard family={family} profile={profile} items={items} history={history} activity={activity} sessions={sessions} members={members} loading={loading} percentBought={percentBought} onNavigate={setPage} onToggle={togglePurchased} onAdd={quickAdd} t={t} language={language} />}
          {page === 'list' && <ListPage items={visibleItems} allItems={items} categories={categories} history={history} loading={loading} search={search} setSearch={setSearch} onAdd={addProduct} onToggle={togglePurchased} onEdit={setEditing} onDelete={removeProduct} onFavorite={toggleFavorite} onQuickAdd={quickAdd} t={t} language={language} />}
          {page === 'shop' && <ShopPage items={visibleItems} allItems={items} sessions={sessions} userId={user.id} onToggle={togglePurchased} onStart={() => void startShopping(family.id, user.id).then(refresh).catch((error) => notify(error.message, 'error'))} onStop={() => void stopShopping(family.id, user.id).then(refresh).catch((error) => notify(error.message, 'error'))} t={t} language={language} />}
          {page === 'history' && <HistoryPage history={history} onAdd={quickAdd} t={t} language={language} />}
          {page === 'family' && <FamilyPage family={family} members={members} sessions={sessions} user={user} inviteCode={inviteCode} activeInvite={activeInvite} inviteBusy={inviteBusy} onInvite={() => void invite()} t={t} />}
          {page === 'settings' && <SettingsPage profile={profile} language={language} theme={theme} onLanguage={(value) => { setLanguage(value); void savePreferences(user.id, { language: value, theme }).catch((error) => notify(error.message, 'error')) }} onTheme={(value) => { setTheme(value); void savePreferences(user.id, { language, theme: value }).catch((error) => notify(error.message, 'error')) }} onSaveProfile={handleProfileSaved} onSignOut={onSignOut} t={t} />}
        </div>
        <footer className="mobile-nav">
          {navItems.slice(0, 5).map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)} aria-current={page === id ? 'page' : undefined}><Icon size={20} /><span>{label}</span>{id === 'list' && activeItems.length > 0 && <i>{activeItems.length}</i>}</button>)}
        </footer>
      </main>
      {editing && <ItemEditor item={editing} categories={categories} language={language} onClose={() => setEditing(null)} onSave={(changes) => void changeItem(editing, changes)} onDelete={() => void removeProduct(editing)} t={t} />}
      <div className="mobile-sync"><span className={`connection-indicator ${online ? 'is-online' : ''}`} />{pendingCount ? t('syncPending') : online ? t('synced') : t('offline')}</div>
    </div>
  )
}

function Dashboard({ family, profile, items, history, activity, sessions, members, loading, percentBought, onNavigate, onToggle, onAdd, t, language }: {
  family: Family
  profile: Profile | null
  items: ShoppingItem[]
  history: { id: string; item_name: string; quantity: number; unit: string | null; purchased_at: string; purchaser?: { display_name: string } | null }[]
  activity: { id: string; action: string; item_name: string; created_at: string; actor?: { display_name: string } | null }[]
  sessions: ShoppingSession[]
  members: FamilyMember[]
  loading: boolean
  percentBought: number
  onNavigate: (page: Page) => void
  onToggle: (item: ShoppingItem) => void
  onAdd: (name: string) => void
  t: (key: Parameters<typeof translate>[1]) => string
  language: Language
}) {
  const active = items.filter((item) => !item.purchased_at)
  const name = profile?.display_name?.split(' ')[0] || 'daar'
  return (
    <section className="dashboard-page">
      <div className="welcome-row">
        <div><span className="eyebrow">{t('today')}</span><h1>{t('welcome')}, {name}<span className="wave"> ✨</span></h1><p className="muted">{family.name} · {t('homeSubtitle')}</p></div>
        <button className="button button-primary" onClick={() => onNavigate('list')}><Plus size={17} />{t('addItem')}</button>
      </div>
      {sessions.length > 0 && <div className="shopping-live-strip"><span className="live-dot" /><ShoppingBag size={18} /><div>{sessions.map((session) => <strong key={session.id}>{session.profile?.display_name ?? t('member')} {t('shoppingNow')}</strong>)}</div><span className="live-avatar-stack">{sessions.slice(0, 3).map((session) => <Avatar key={session.id} name={session.profile?.display_name ?? 'FC'} profile={session.profile} />)}</span></div>}
      <div className="stats-grid">
        <button className="stat-card stat-card-primary" onClick={() => onNavigate('list')}><span className="stat-icon"><ShoppingBasket size={19} /></span><span className="stat-label">{t('needed')}</span><strong>{loading ? '—' : active.length}</strong><span className="stat-foot">{t('itemsLeft')}</span><span className="stat-arrow"><ArrowRight size={16} /></span></button>
        <button className="stat-card" onClick={() => onNavigate('history')}><span className="stat-icon stat-icon-lime"><CheckCheck size={19} /></span><span className="stat-label">{t('bought')}</span><strong>{loading ? '—' : history.length}</strong><span className="stat-foot">{t('itemsBought')}</span><span className="stat-arrow"><ArrowRight size={16} /></span></button>
        <button className="stat-card" onClick={() => onNavigate('family')}><span className="stat-icon stat-icon-peach"><Users size={19} /></span><span className="stat-label">{t('members')}</span><strong>{members.length}</strong><span className="stat-foot">{family.name}</span><span className="stat-arrow"><ArrowRight size={16} /></span></button>
      </div>
      <div className="dashboard-columns">
        <section className="content-card list-preview-card">
          <div className="section-heading"><div><span className="eyebrow">{t('today')}</span><h2>{t('needed')}</h2></div><button className="quiet-button" onClick={() => onNavigate('list')}>{t('list')}<ArrowRight size={15} /></button></div>
          {loading ? <ListSkeleton /> : active.length === 0 ? <EmptyState title={t('emptyList')} detail={t('emptyHint')} icon={<ShoppingBasket size={22} />} /> : <div className="preview-items">{active.slice(0, 5).map((item) => <ShoppingRow key={item.id} item={item} language={language} t={t} onToggle={onToggle} compact />)}{active.length > 5 && <button className="show-more" onClick={() => onNavigate('list')}>+ {active.length - 5} meer bekijken</button>}</div>}
          <div className="progress-card"><div className="progress-copy"><span>{t('progress')}</span><strong>{percentBought}%</strong></div><div className="progress-track"><span style={{ width: `${percentBought}%` }} /></div><button className="button button-secondary button-wide" onClick={() => onNavigate('shop')}><ShoppingBag size={17} />{t('shop')}</button></div>
        </section>
        <div className="dashboard-side">
          <section className="content-card quick-card"><div className="section-heading"><div><span className="eyebrow">{t('quickAdd')}</span><h2>{t('suggestion')}</h2></div><Zap size={18} className="accent-icon" /></div>
            <div className="quick-products">{[...new Set(history.map((item) => item.item_name))].slice(0, 4).map((item) => <button key={item} className="quick-product" onClick={() => onAdd(item)}><span className="quick-plus"><Plus size={14} /></span><span>{item}</span></button>)}</div>
            {history.length === 0 && <p className="muted small">{t('noFrequentProducts')}</p>}
          </section>
          <section className="content-card activity-card"><div className="section-heading"><div><span className="eyebrow">{t('sharedLive')}</span><h2>{t('recentActivity')}</h2></div><span className="live-dot" /></div>
            {activity.length === 0 ? <p className="muted small">{t('newUpdatesHere')}</p> : activity.slice(0, 5).map((entry) => <div className="activity-row" key={entry.id}><span className={`activity-icon ${entry.action === 'item_purchased' ? 'is-done' : ''}`}>{entry.action === 'item_purchased' ? <Check size={14} /> : <Plus size={14} />}</span><div><strong>{entry.actor?.display_name ?? t('member')}</strong><span> {entry.action === 'item_purchased' ? t('actionBought') : entry.action === 'item_added' ? t('actionAdded') : t('actionUpdated')} <b>{entry.item_name}</b></span></div><time>{new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(new Date(entry.created_at))}</time></div>)}
          </section>
        </div>
      </div>
    </section>
  )
}

function ListPage({ items, allItems, categories, history, loading, search, setSearch, onAdd, onToggle, onEdit, onDelete, onFavorite, onQuickAdd, t, language }: {
  items: ShoppingItem[]
  allItems: ShoppingItem[]
  categories: Category[]
  history: { item_name: string }[]
  loading: boolean
  search: string
  setSearch: (value: string) => void
  onAdd: (name: string, quantity?: number, unit?: string, note?: string, urgent?: boolean) => Promise<void>
  onToggle: (item: ShoppingItem) => void
  onEdit: (item: ShoppingItem) => void
  onDelete: (item: ShoppingItem) => void
  onFavorite: (item: ShoppingItem) => void
  onQuickAdd: (name: string) => void
  t: (key: Parameters<typeof translate>[1]) => string
  language: Language
}) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('')
  const [note, setNote] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [showBought, setShowBought] = useState(false)
  const active = allItems.filter((item) => !item.purchased_at)
  const bought = allItems.filter((item) => item.purchased_at)
  const favorites = [...new Set(allItems.filter((item) => item.is_favorite).map((item) => item.name))].slice(0, 6)
  const purchaseCounts = new Map<string, number>()
  for (const purchase of history) purchaseCounts.set(purchase.item_name.toLocaleLowerCase(), (purchaseCounts.get(purchase.item_name.toLocaleLowerCase()) ?? 0) + 1)
  const suggestions = [...new Set(history.map((item) => item.item_name))]
    .sort((a, b) => (purchaseCounts.get(b.toLocaleLowerCase()) ?? 0) - (purchaseCounts.get(a.toLocaleLowerCase()) ?? 0))
    .filter((name) => !active.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
    .slice(0, 6)
  const grouped = categories.map((category) => ({ category, items: items.filter((item) => item.category_id === category.id || item.category?.name_nl === category.name_nl) })).filter((group) => group.items.length)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await onAdd(name, Math.max(0.01, Number(quantity) || 1), unit, note, urgent)
    setName('')
    setQuantity('1')
    setUnit('')
    setNote('')
    setUrgent(false)
    setShowOptions(false)
  }
  return (
    <section className="list-page">
      <PageHeading eyebrow="DE GEDEELDE LIJST" title={t('list')} subtitle={`${active.length} ${t('itemsLeft')}`} action={<button className="button button-secondary" onClick={() => setShowBought(!showBought)}><CheckCheck size={16} />{showBought ? t('needed') : `${t('bought')} (${bought.length})`}</button>} />
      <form className="add-product-form" onSubmit={(event) => void submit(event)}>
        <div className="add-form-main"><span className="add-form-plus"><Plus size={19} /></span><input aria-label={t('addItem')} placeholder={t('addItem')} value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} /><button type="button" className={`urgent-toggle ${urgent ? 'selected' : ''}`} onClick={() => setUrgent(!urgent)} aria-pressed={urgent}><Zap size={15} /><span>{t('urgent')}</span></button><button className="button button-primary add-submit" type="submit"><Plus size={16} /><span>{t('add')}</span></button></div>
        <div className="add-form-foot"><button type="button" className="quiet-button" onClick={() => setShowOptions(!showOptions)}>{showOptions ? <X size={14} /> : <MoreHorizontal size={15} />}{showOptions ? t('cancel') : t('addDetails')}</button>{showOptions && <div className="add-extra-fields"><label>{t('quantity')}<input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>{t('unit')}<input maxLength={24} placeholder={t('unitsExample')} value={unit} onChange={(event) => setUnit(event.target.value)} /></label><label>{t('note')}<input maxLength={500} placeholder={t('optional')} value={note} onChange={(event) => setNote(event.target.value)} /></label></div>}</div>
      </form>
      {favorites.length > 0 && <div className="favorite-strip"><span className="eyebrow"><Heart size={13} /> {t('favorites')}</span>{favorites.map((favorite) => <button key={favorite} onClick={() => onQuickAdd(favorite)}><Plus size={13} />{favorite}</button>)}</div>}
      {suggestions.length > 0 && <div className="favorite-strip"><span className="eyebrow"><Zap size={13} /> {t('suggestion')}</span>{suggestions.map((suggestion) => <button key={suggestion} onClick={() => onQuickAdd(suggestion)}><Plus size={13} />{suggestion}</button>)}</div>}
      <div className="list-toolbar"><div className="list-tabs"><button className={!showBought ? 'active' : ''} onClick={() => setShowBought(false)}>{t('needed')}<span>{active.length}</span></button><button className={showBought ? 'active' : ''} onClick={() => setShowBought(true)}>{t('bought')}<span>{bought.length}</span></button></div><label className="search-field"><Search size={16} /><input placeholder={t('search')} value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      {loading ? <ListSkeleton /> : showBought
        ? bought.length === 0 ? <EmptyState title={t('noResults')} detail="" icon={<CheckCheck size={22} />} /> : <div className="items-list bought-list">{bought.map((item) => <div className="bought-row" key={item.id}><span className="bought-check"><Check size={15} /></span><div className="bought-info"><strong>{item.name}</strong><span>{item.quantity} {item.unit ?? ''} · {item.purchaser?.display_name ?? t('member')} · {item.purchased_at && friendlyDate(item.purchased_at, language)}</span></div><button className="icon-button" aria-label={t('undo')} title={t('undo')} onClick={() => onToggle(item)}><ArrowDownLeft size={17} /></button><button className="icon-button" aria-label={t('addAgain')} title={t('addAgain')} onClick={() => onQuickAdd(item.name)}><Plus size={17} /></button></div>)}</div>
        : items.length === 0 ? <EmptyState title={search ? t('noResults') : t('emptyList')} detail={search ? '' : t('emptyHint')} icon={<ShoppingBasket size={22} />} /> : <div className="categorized-list">{grouped.map(({ category, items: groupItems }) => <section key={category.id} className="category-group"><h3><span>{category.emoji}</span>{language === 'en' ? category.name_en : language === 'ar' ? category.name_ar : category.name_nl}<i>{groupItems.length}</i></h3><div className="items-list">{groupItems.map((item) => <ShoppingRow key={item.id} item={item} language={language} t={t} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onFavorite={onFavorite} />)}</div></section>)}</div>}
    </section>
  )
}

function ShopPage({ items, allItems, sessions, userId, onToggle, onStart, onStop, t, language }: {
  items: ShoppingItem[]
  allItems: ShoppingItem[]
  sessions: ShoppingSession[]
  userId: string
  onToggle: (item: ShoppingItem) => void
  onStart: () => void
  onStop: () => void
  t: (key: Parameters<typeof translate>[1]) => string
  language: Language
}) {
  const needed = items.filter((item) => !item.purchased_at)
  const boughtCount = allItems.filter((item) => item.purchased_at).length
  const mine = sessions.some((session) => session.user_id === userId)
  const groups = new Map<string, ShoppingItem[]>()
  for (const item of needed) {
    const key = item.category?.name_nl ?? 'Overige'
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return (
    <section className="shop-page">
      <div className="shop-hero"><div className="shop-hero-top"><span className="eyebrow">{t('storeHeader')}</span><span className="shop-live"><span className="live-dot" /> {t('sharedLive')}</span></div><h1>{t('shop')}</h1><p>{t('shopHint')}</p><div className="shop-progress"><div className="shop-progress-copy"><span>{t('progress')}</span><strong>{boughtCount} / {allItems.length}</strong></div><div className="progress-track"><span style={{ width: `${allItems.length ? (boughtCount / allItems.length) * 100 : 0}%` }} /></div></div><button className="button shop-start-button" onClick={mine ? onStop : onStart}><ShoppingBag size={17} />{mine ? t('stopShopping') : t('startShopping')}</button></div>
      {sessions.length > 0 && <div className="shopping-live-strip shop-session-strip"><span className="live-dot" /><div>{sessions.map((session) => <strong key={session.id}>{session.profile?.display_name ?? t('member')} {t('shoppingNow')}</strong>)}</div></div>}
      <div className="shop-items">{needed.length === 0 ? <EmptyState title={t('emptyList')} detail={t('emptyHint')} icon={<CheckCheck size={22} />} /> : [...groups.entries()].map(([category, rows]) => <section key={category} className="shop-category"><h2><span>{rows[0].category?.emoji ?? '🛒'}</span>{language === 'en' ? rows[0].category?.name_en ?? category : language === 'ar' ? rows[0].category?.name_ar ?? category : category}<i>{rows.length}</i></h2>{rows.map((item) => <button className={`shop-item ${item.is_urgent ? 'urgent-item' : ''}`} key={item.id} onClick={() => onToggle(item)}><span className="shop-checkbox"><Check size={19} /></span><span className="shop-item-copy"><strong>{item.name}</strong><small>{item.quantity} {item.unit ?? ''}{item.note ? ` · ${item.note}` : ''}</small></span>{item.is_urgent && <Zap size={15} className="urgent-icon" />}</button>)}</section>)}</div>
    </section>
  )
}

function HistoryPage({ history, onAdd, t, language }: {
  history: { id: string; item_name: string; quantity: number; unit: string | null; purchased_at: string; purchaser?: { display_name: string } | null; category?: Category | null }[]
  onAdd: (name: string) => void
  t: (key: Parameters<typeof translate>[1]) => string
  language: Language
}) {
  const grouped = history.reduce<Record<string, typeof history>>((groups, item) => {
    const date = new Date(item.purchased_at).toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    groups[date] = [...(groups[date] ?? []), item]
    return groups
  }, {})
  return <section className="history-page"><PageHeading eyebrow={t('purchases')} title={t('history')} subtitle={`${history.length} ${t('purchaseCount')}`} />
    {history.length === 0 ? <EmptyState title={t('history')} detail={t('historyEmpty')} icon={<Clock3 size={22} />} /> : <div className="history-groups">{Object.entries(grouped).map(([date, rows]) => <section className="history-group" key={date}><h2>{date}<span>{rows.length}</span></h2>{rows.map((item) => <div className="history-row" key={item.id}><span className="history-emoji">{item.category?.emoji ?? '🛒'}</span><div><strong>{item.item_name}</strong><small>{item.quantity} {item.unit ?? ''} · {item.purchaser?.display_name ?? t('member')}</small></div><button className="quick-add-icon" title={t('addAgain')} aria-label={t('addAgain')} onClick={() => onAdd(item.item_name)}><Plus size={17} /></button></div>)}</section>)}</div>}
  </section>
}

function FamilyPage({ family, members, sessions, user, inviteCode, activeInvite, inviteBusy, onInvite, t }: {
  family: Family
  members: FamilyMember[]
  sessions: ShoppingSession[]
  user: User
  inviteCode: string
  activeInvite: { id: string; expires_at: string } | null
  inviteBusy: boolean
  onInvite: () => void
  t: (key: Parameters<typeof translate>[1]) => string
}) {
  return <section className="family-page"><PageHeading eyebrow={t('inviteEyebrow')} title={t('family')} subtitle={family.name} />
    <div className="family-overview">
      <section className="content-card members-card"><div className="section-heading"><div><span className="eyebrow">{t('household')}</span><h2>{t('members')} <span className="title-count">{members.length}</span></h2></div><Users size={19} className="muted-icon" /></div>
        <div className="member-list">{members.map((member, index) => <div className="member-row" key={member.user_id}><Avatar profile={member.profile} name={member.profile.display_name} className={`member-avatar avatar-tone-${index % 4}`} /><div className="member-info"><strong>{member.profile.display_name}{member.user_id === user.id ? ` (${t('you')})` : ''}</strong><span>{sessions.some((session) => session.user_id === member.user_id) ? <><span className="live-dot" /> {t('shoppingNow')}</> : member.role === 'owner' ? t('owner') : t('member')}</span></div><span className={`role-chip ${member.role === 'owner' ? 'role-owner' : ''}`}>{member.role === 'owner' ? t('owner') : t('member')}</span></div>)}</div>
      </section>
      <section className="content-card invite-card"><div className="invite-illustration"><Users size={28} /><span>+</span></div><span className="eyebrow">{t('inviteEyebrow')}</span><h2>{t('inviteHeading')}</h2><p className="muted">{t('inviteDescription')}</p>{inviteCode ? <div className="invite-code"><code>{inviteCode}</code><span className="live-dot" /></div> : activeInvite ? <div className="invite-existing"><span>{t('inviteExists')}</span></div> : null}<button className="button button-primary button-wide" onClick={onInvite} disabled={inviteBusy}><Plus size={17} />{inviteBusy ? t('loading') : t('newInvite')}</button><small>{t('inviteSafety')}</small></section>
    </div>
  </section>
}

function SettingsPage({ profile, language, theme, onLanguage, onTheme, onSaveProfile, onSignOut, t }: {
  profile: Profile | null
  language: Language
  theme: 'light' | 'dark' | 'system'
  onLanguage: (language: Language) => void
  onTheme: (theme: 'light' | 'dark' | 'system') => void
  onSaveProfile: (name: string, avatar: string) => Promise<Profile | null>
  onSignOut: () => void
  t: (key: Parameters<typeof translate>[1]) => string
}) {
  const [name, setName] = useState(profile?.display_name ?? '')
  const [avatar, setAvatar] = useState(profile?.avatar_url ?? '')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setName(profile?.display_name ?? ''); setAvatar(profile?.avatar_url ?? '') }, [profile])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    const updated = await onSaveProfile(name, avatar)
    if (updated) setName(updated.display_name)
    setSaving(false)
  }
  return <section className="settings-page"><PageHeading eyebrow={t('profile')} title={t('settings')} subtitle={t('settingsDescription')} />
    <div className="settings-layout">
      <form className="content-card settings-card" onSubmit={(event) => void submit(event)}><div className="section-heading"><div><span className="eyebrow">{t('profile')}</span><h2>{t('profile')}</h2></div><Avatar name={name || 'FC'} profile={{ ...profile, display_name: name, avatar_url: avatar } as Profile} /></div><label>{t('name')}<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label><label>{t('avatarUrl')} <input type="url" maxLength={2048} placeholder="https://…" value={avatar} onChange={(event) => setAvatar(event.target.value)} /><small>{t('avatarHint')}</small></label><button className="button button-primary" disabled={saving}>{t('save')}<Check size={16} /></button></form>
      <section className="content-card settings-card"><div className="eyebrow">{t('settings')}</div><label>{t('language')}<select value={language} onChange={(event) => onLanguage(event.target.value as Language)}><option value="nl">Nederlands</option><option value="en">English</option><option value="ar">العربية</option></select></label><label>{t('theme')}<select value={theme} onChange={(event) => onTheme(event.target.value as typeof theme)}><option value="system">{t('system')}</option><option value="light">{t('light')}</option><option value="dark">{t('dark')}</option></select></label><div className="theme-previews"><button type="button" className={`theme-preview ${theme === 'light' ? 'is-selected' : ''}`} onClick={() => onTheme('light')}><Sun size={16} />{t('light')}</button><button type="button" className={`theme-preview ${theme === 'dark' ? 'is-selected' : ''}`} onClick={() => onTheme('dark')}><Moon size={16} />{t('dark')}</button><button type="button" className={`theme-preview ${theme === 'system' ? 'is-selected' : ''}`} onClick={() => onTheme('system')}><Coffee size={16} />{t('system')}</button></div><div className="settings-info"><Bell size={17} /><span>{t('notificationPending')}</span></div></section>
      <section className="signout-card"><div><strong>{t('takeBreak')}</strong><span>{t('dataSafe')}</span></div><button className="button button-danger" onClick={onSignOut}><LogOut size={16} />{t('signOut')}</button></section>
    </div>
  </section>
}

function ItemEditor({ item, categories, language, onClose, onSave, onDelete, t }: {
  item: ShoppingItem
  categories: Category[]
  language: Language
  onClose: () => void
  onSave: (changes: Partial<ShoppingItem>) => void
  onDelete: () => void
  t: (key: Parameters<typeof translate>[1]) => string
}) {
  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(String(item.quantity))
  const [unit, setUnit] = useState(item.unit ?? '')
  const [note, setNote] = useState(item.note ?? '')
  const [categoryId, setCategoryId] = useState(item.category_id)
  const [urgent, setUrgent] = useState(item.is_urgent)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSave({ name: name.trim(), quantity: Math.max(0.01, Number(quantity) || 1), unit: unit.trim() || null, note: note.trim() || null, category_id: categoryId, is_urgent: urgent })
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="edit-modal" onSubmit={submit}><div className="modal-heading"><div><span className="eyebrow">{t('editProduct')}</span><h2>{t('edit')}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label={t('cancel')}><X size={19} /></button></div><label>{t('productName')}<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label><div className="modal-fields"><label>{t('quantity')}<input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>{t('unit')}<input maxLength={24} value={unit} onChange={(event) => setUnit(event.target.value)} /></label></div><label>{t('category')}<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.emoji} {language === 'en' ? category.name_en : language === 'ar' ? category.name_ar : category.name_nl}</option>)}</select></label><label>{t('note')}<textarea maxLength={500} rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></label><button type="button" className={`urgent-toggle modal-urgent ${urgent ? 'selected' : ''}`} onClick={() => setUrgent(!urgent)} aria-pressed={urgent}><Zap size={15} />{t('urgent')}</button><div className="modal-actions"><button type="button" className="button button-danger" onClick={onDelete}><Trash2 size={16} />{t('remove')}</button><button type="submit" className="button button-primary">{t('save')}<Check size={16} /></button></div></form></div>
}

function ShoppingRow({ item, language, t, onToggle, onEdit, onDelete, onFavorite, compact = false }: {
  item: ShoppingItem
  language: Language
  t: (key: Parameters<typeof translate>[1]) => string
  onToggle: (item: ShoppingItem) => void
  onEdit?: (item: ShoppingItem) => void
  onDelete?: (item: ShoppingItem) => void
  onFavorite?: (item: ShoppingItem) => void
  compact?: boolean
}) {
  return <div className={`shopping-row ${item.is_urgent ? 'is-urgent' : ''} ${compact ? 'is-compact' : ''} ${item.pending ? 'is-pending' : ''}`}>
    <button className={`item-checkbox ${item.purchased_at ? 'checked' : ''}`} aria-label={item.purchased_at ? t('undo') : t('bought')} onClick={() => onToggle(item)}>{item.purchased_at && <Check size={13} />}</button>
    <div className="item-category-icon">{item.category?.emoji ?? '🛒'}</div>
    <div className="item-main"><div className="item-title-line"><strong>{item.name}</strong>{item.is_urgent && <span className="urgent-tag"><Zap size={11} />{t('urgent')}</span>}{item.pending && <span className="pending-tag">{t('syncPending')}</span>}</div><div className="item-subtitle"><span>{item.quantity} {item.unit ?? ''}</span><span className="meta-dot">·</span><span>{item.creator?.display_name ?? t('member')}</span><span className="meta-dot">·</span><span>{friendlyDate(item.created_at, language)}</span></div>{item.note && !compact && <p className="item-note">{item.note}</p>}</div>
    {!compact && <div className="item-row-actions">{onFavorite && <button className={`item-action favorite-action ${item.is_favorite ? 'favorite-active' : ''}`} title={t('favorites')} aria-label={t('favorites')} onClick={() => onFavorite(item)}><Heart size={16} fill={item.is_favorite ? 'currentColor' : 'none'} /></button>}{onEdit && <button className="item-action" title={t('edit')} aria-label={t('edit')} onClick={() => onEdit(item)}><Pencil size={16} /></button>}{onDelete && <button className="item-action delete-action" title={t('remove')} aria-label={t('remove')} onClick={() => onDelete(item)}><Trash2 size={16} /></button>}</div>}
  </div>
}

function Avatar({ profile, name, className = '' }: { profile?: Partial<Profile> | null; name: string; className?: string }) {
  return profile?.avatar_url
    ? <img className={`avatar ${className}`} src={profile.avatar_url} alt="" referrerPolicy="no-referrer" />
    : <span className={`avatar avatar-initials ${className}`}>{initials(profile?.display_name ?? name)}</span>
}

function BrandMark() {
  return <span className="brand-mark"><ShoppingBasket size={19} strokeWidth={2.2} /></span>
}

function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>{action}</div>
}

function EmptyState({ title, detail, icon }: { title: string; detail: string; icon: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><h3>{title}</h3>{detail && <p>{detail}</p>}</div>
}

function ListSkeleton() {
  return <div className="skeleton-list" aria-label="Laden"><span /><span /><span /></div>
}

function LoadingScreen() {
  return <main className="loading-screen"><BrandMark /><span className="loading-pulse">FamilyCart</span></main>
}

export default App
