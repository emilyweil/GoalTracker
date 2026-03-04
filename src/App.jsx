import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const getWeekInfo = (date = new Date()) => {
  const d = new Date(date)
  const day = d.getDay()
  const sunday = new Date(d)
  sunday.setDate(d.getDate() - day)
  sunday.setHours(0, 0, 0, 0)
  const saturday = new Date(sunday)
  saturday.setDate(sunday.getDate() + 6)
  const pad = (n) => String(n).padStart(2, '0')
  const weekId = sunday.getFullYear() + '-' + pad(sunday.getMonth() + 1) + '-' + pad(sunday.getDate())
  const fmt = (dt) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const dateRange = fmt(sunday) + ' - ' + fmt(saturday) + ', ' + sunday.getFullYear()
  return { weekId, dateRange, sunday, saturday }
}

const parseWeekId = (weekId) => {
  const [year, month, day] = weekId.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const formatDateId = (date) => {
  const pad = (n) => String(n).padStart(2, '0')
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
}

const getTodayId = () => formatDateId(new Date())

const goalColors = ['#fff4d4', '#ddf4ff', '#d7ffb8', '#ffdfe0', '#f3e5ff']

function Confetti({ active }) {
  const [particles, setParticles] = useState([])
  
  useEffect(() => {
    if (active) {
      const colors = ['#58cc02', '#ffc800', '#1cb0f6', '#ff4b4b', '#ce82ff']
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.3,
        size: Math.random() * 8 + 4
      }))
      setParticles(newParticles)
      const timer = setTimeout(() => setParticles([]), 1000)
      return () => clearTimeout(timer)
    }
  }, [active])

  if (particles.length === 0) return null

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1000, overflow: 'hidden' }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: p.x + '%',
          top: -20,
          width: p.size,
          height: p.size,
          background: p.color,
          borderRadius: p.size > 8 ? '50%' : '2px',
          animation: 'confetti-fall 1s ease-out forwards',
          animationDelay: p.delay + 's'
        }} />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState('calendar')
  const [authMode, setAuthMode] = useState('login')
  const [authError, setAuthError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deadlines, setDeadlines] = useState([])
  const [weeklyGoals, setWeeklyGoals] = useState([])
  const [weeklyTasks, setWeeklyTasks] = useState({})
  const [dailyChecks, setDailyChecks] = useState({})
  const [weeklyChecks, setWeeklyChecks] = useState({})
  const [meetingDate, setMeetingDate] = useState(null)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [showModal, setShowModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [editingDeadline, setEditingDeadline] = useState(null)
  const [expandedGoal, setExpandedGoal] = useState(null)
  const [planStep, setPlanStep] = useState(0)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [isNewUser, setIsNewUser] = useState(true)
  const [editMode, setEditMode] = useState(false)

  const currentWeekId = getWeekInfo().weekId
  const { dateRange } = getWeekInfo()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadUserData(session.user.id)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadUserData(session.user.id)
      else { setDataLoaded(false); setDeadlines([]); setWeeklyGoals([]); setWeeklyTasks({}); setDailyChecks({}); setWeeklyChecks({}); setMeetingDate(null); setIsNewUser(true) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadUserData = async (userId) => {
    const { data } = await supabase.from('user_data').select('data').eq('user_id', userId).single()
    if (data && data.data) {
      setDeadlines(data.data.deadlines || [])
      setWeeklyGoals(data.data.weeklyGoals || [])
      setWeeklyTasks(data.data.weeklyTasks || {})
      setDailyChecks(data.data.dailyChecks || {})
      setWeeklyChecks(data.data.weeklyChecks || {})
      setMeetingDate(data.data.meetingDate || null)
      const currentTasks = data.data.weeklyTasks ? data.data.weeklyTasks[currentWeekId] : []
      if (currentTasks && currentTasks.length > 0) {
        setScreen('daily')
        setIsNewUser(false)
      } else if (data.data.deadlines && data.data.deadlines.length > 0) {
        setIsNewUser(false)
      }
    }
    setDataLoaded(true)
  }

  const saveUserData = async () => {
    if (!session || !dataLoaded) return
    await supabase.from('user_data').upsert({ user_id: session.user.id, data: { deadlines, weeklyGoals, weeklyTasks, dailyChecks, weeklyChecks, meetingDate }, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  }

  useEffect(() => {
    if (dataLoaded && session) { const timer = setTimeout(saveUserData, 500); return () => clearTimeout(timer) }
  }, [deadlines, weeklyGoals, weeklyTasks, dailyChecks, weeklyChecks, meetingDate])

  const handleLogin = async (e) => { e.preventDefault(); setAuthError(''); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setAuthError(error.message) }
  const handleSignup = async (e) => { e.preventDefault(); setAuthError(''); if (password !== confirmPassword) { setAuthError('Passwords do not match'); return } if (password.length < 6) { setAuthError('Password must be at least 6 characters'); return } const { error } = await supabase.auth.signUp({ email, password }); if (error) setAuthError(error.message) }
  const handleLogout = async () => { await supabase.auth.signOut(); setShowUserMenu(false) }

  const saveDeadline = (form) => { if (!form.title.trim()) return; const deadline = { id: editingDeadline ? editingDeadline.id : Date.now(), date: formatDateId(selectedDate), title: form.title, notes: form.notes, isMeeting: form.isMeeting || false }; if (editingDeadline) { setDeadlines(deadlines.map(d => d.id === editingDeadline.id ? deadline : d)) } else { setDeadlines([...deadlines, deadline]) } setShowModal(false); setEditingDeadline(null); setIsNewUser(false) }
  const deleteDeadline = (id) => { const dl = deadlines.find(d => d.id === id); if (dl && dl.isMeeting) { setMeetingDate(null) } setDeadlines(deadlines.filter(d => d.id !== id)); setShowModal(false); setEditingDeadline(null) }
  const addGoal = (text) => { if (!text.trim()) return; setWeeklyGoals([...weeklyGoals, { id: Date.now(), text: text.trim(), weekId: currentWeekId }]) }
  const removeGoal = (id) => { setWeeklyGoals(weeklyGoals.filter(g => g.id !== id)); const updated = { ...weeklyTasks }; Object.keys(updated).forEach(wk => { updated[wk] = (updated[wk] || []).filter(t => t.goalId !== id) }); setWeeklyTasks(updated) }
  const addTask = (goalId, text, type) => { if (!text.trim()) return; const tasks = weeklyTasks[currentWeekId] || []; setWeeklyTasks({ ...weeklyTasks, [currentWeekId]: [...tasks, { id: Date.now(), text: text.trim(), type, goalId }] }) }
  const removeTask = (id) => { setWeeklyTasks({ ...weeklyTasks, [currentWeekId]: (weeklyTasks[currentWeekId] || []).filter(t => t.id !== id) }) }
  
  const setMeeting = (dateStr) => {
    // Remove old meeting from deadlines if exists
    const newDeadlines = deadlines.filter(d => !d.isMeeting)
    // Add new meeting
    if (dateStr) {
      const meetingDeadline = { id: Date.now(), date: dateStr, title: 'Progress Review Meeting', notes: 'Weekly check-in to review goals and progress', isMeeting: true }
      setDeadlines([...newDeadlines, meetingDeadline])
      setMeetingDate(dateStr)
    } else {
      setDeadlines(newDeadlines)
      setMeetingDate(null)
    }
  }
  
  const triggerConfetti = () => { setShowConfetti(false); setTimeout(() => setShowConfetti(true), 10) }
  
  const toggleDaily = (taskId) => { 
    const key = getTodayId() + '-' + taskId
    const wasChecked = dailyChecks[key]
    setDailyChecks({ ...dailyChecks, [key]: !dailyChecks[key] })
    if (!wasChecked) triggerConfetti()
  }
  const toggleWeekly = (taskId) => { 
    const key = currentWeekId + '-' + taskId
    const wasChecked = weeklyChecks[key]
    setWeeklyChecks({ ...weeklyChecks, [key]: !weeklyChecks[key] })
    if (!wasChecked) triggerConfetti()
  }
  const isDailyDone = (taskId) => dailyChecks[getTodayId() + '-' + taskId] || false
  const isWeeklyDone = (taskId) => weeklyChecks[currentWeekId + '-' + taskId] || false

  const currentGoals = weeklyGoals.filter(g => g.weekId === currentWeekId)
  const currentTasks = weeklyTasks[currentWeekId] || []
  const dailyTasks = currentTasks.filter(t => t.type === 'daily')
  const weeklyTaskList = currentTasks.filter(t => t.type === 'weekly')
  const dailyProgress = dailyTasks.length > 0 ? Math.round((dailyTasks.filter(t => isDailyDone(t.id)).length / dailyTasks.length) * 100) : 0
  const weeklyProgress = weeklyTaskList.length > 0 ? Math.round((weeklyTaskList.filter(t => isWeeklyDone(t.id)).length / weeklyTaskList.length) * 100) : 0

  const goToEditPlan = () => {
    setEditMode(true)
    setPlanStep(3) // Go directly to tasks step
    setScreen('planning')
  }

  if (loading) return <div style={styles.authContainer}><div style={{ fontSize: 48 }}>🎓</div><p style={{ marginTop: 16, color: '#777' }}>Loading...</p></div>

  if (!session) return (
    <div style={styles.authContainer}>
      <div style={styles.authCard}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}><span style={{ fontSize: 48 }}>🎓</span><h1 style={styles.authTitle}>{authMode === 'login' ? 'Welcome back!' : 'Get started!'}</h1><p style={{ color: '#777' }}>Track your college deadlines</p></div>
        <form onSubmit={authMode === 'login' ? handleLogin : handleSignup}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.authInput} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.authInput} />
          {authMode === 'signup' && <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={styles.authInput} />}
          {authError && <p style={styles.authError}>{authError}</p>}
          <button type="submit" style={styles.primaryBtn}>{authMode === 'login' ? 'Sign In' : 'Create Account'}</button>
        </form>
        <div style={styles.authDivider}><span style={styles.dividerLine}></span><span style={{ color: '#aaa', fontSize: 13 }}>OR</span><span style={styles.dividerLine}></span></div>
        <button style={styles.secondaryBtn} onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>{authMode === 'login' ? 'Create Account' : 'Back to Sign In'}</button>
      </div>
    </div>
  )

  return (
    <div style={styles.app}>
      <Confetti active={showConfetti} />
      <div style={styles.userHeader}>
        <div style={styles.userBadge} onClick={() => setShowUserMenu(!showUserMenu)}><div style={styles.avatar}>{session.user.email[0].toUpperCase()}</div><span>{session.user.email.split('@')[0]}</span></div>
        {showUserMenu && <div style={styles.userMenu}><div style={{ padding: '10px 14px', fontSize: 12, color: '#777', borderBottom: '1px solid #e5e5e5' }}>{session.user.email}</div><button style={styles.logoutBtn} onClick={handleLogout}>Sign Out</button></div>}
      </div>
      <div style={styles.content}>
        {screen === 'calendar' && <CalendarScreen calendarDate={calendarDate} setCalendarDate={setCalendarDate} deadlines={deadlines} isNewUser={isNewUser} onSelectDate={(date, dl) => { setSelectedDate(date); setEditingDeadline(dl || null); setShowModal(true) }} onDone={() => { setEditMode(false); setPlanStep(0); setScreen('planning'); setIsNewUser(false) }} />}
        {screen === 'planning' && <PlanningScreen dateRange={dateRange} deadlines={deadlines} currentGoals={currentGoals} currentTasks={currentTasks} currentWeekId={currentWeekId} expandedGoal={expandedGoal} setExpandedGoal={setExpandedGoal} addGoal={addGoal} removeGoal={removeGoal} addTask={addTask} removeTask={removeTask} planStep={planStep} setPlanStep={setPlanStep} onNavigate={setScreen} editMode={editMode} setEditMode={setEditMode} meetingDate={meetingDate} setMeeting={setMeeting} />}
        {screen === 'daily' && <CheckinScreen type="daily" dateRange={dateRange} tasks={dailyTasks} goals={currentGoals} progress={dailyProgress} isChecked={isDailyDone} onToggle={toggleDaily} onNavigate={setScreen} goToEditPlan={goToEditPlan} />}
        {screen === 'weekly' && <CheckinScreen type="weekly" dateRange={dateRange} tasks={weeklyTaskList} goals={currentGoals} progress={weeklyProgress} isChecked={isWeeklyDone} onToggle={toggleWeekly} onNavigate={setScreen} goToEditPlan={goToEditPlan} />}
        {screen === 'history' && <HistoryScreen weeklyGoals={weeklyGoals} weeklyTasks={weeklyTasks} dailyChecks={dailyChecks} weeklyChecks={weeklyChecks} currentWeekId={currentWeekId} onNavigate={setScreen} />}
      </div>
      <nav style={styles.bottomNav}>
        {[{ id: 'calendar', icon: '📅', label: 'Calendar' }, { id: 'planning', icon: '📋', label: 'This Week' }, { id: 'daily', icon: '☀️', label: 'Daily Tasks' }, { id: 'weekly', icon: '🏆', label: 'Weekly Tasks' }, { id: 'history', icon: '📊', label: 'History' }].map(nav => <button key={nav.id} style={{ ...styles.navBtn, color: screen === nav.id ? '#58cc02' : '#aaa' }} onClick={() => { if (nav.id === 'planning') { setEditMode(false); setPlanStep(0) } setScreen(nav.id) }}><span style={{ fontSize: 22 }}>{nav.icon}</span><span>{nav.label}</span></button>)}
      </nav>
      {showModal && <DeadlineModal date={selectedDate} deadline={editingDeadline} onSave={saveDeadline} onDelete={deleteDeadline} onClose={() => { setShowModal(false); setEditingDeadline(null) }} />}
    </div>
  )
}

function CalendarScreen({ calendarDate, setCalendarDate, deadlines, isNewUser, onSelectDate, onDone }) {
  const today = new Date()
  const year = calendarDate.getFullYear()
  const month = calendarDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const days = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const getDeadlinesForDay = (day) => day ? deadlines.filter(d => d.date === formatDateId(new Date(year, month, day))) : []
  const isToday = (day) => day && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
  const upcoming = deadlines.filter(d => new Date(d.date) >= new Date(getTodayId())).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)

  return (
    <div>
      <div style={styles.header}><span style={{ fontSize: 48 }}>📅</span><h1 style={styles.title}>Your Deadlines</h1><p style={{ color: '#58cc02', fontWeight: 700, fontSize: 18, marginTop: 8 }}>Add any upcoming deadlines</p></div>
      
      {isNewUser && <div style={styles.welcomeBox}><p style={{ fontSize: 16, lineHeight: 1.5 }}>Welcome! Let's set up a plan so we can keep track of our goals. First let's put any important dates in our calendar.</p></div>}
      
      <div style={styles.calendarCard}>
        <div style={styles.calendarHeader}><button style={styles.calNavBtn} onClick={() => setCalendarDate(new Date(year, month - 1, 1))}>←</button><h2 style={styles.calMonth}>{monthNames[month]} {year}</h2><button style={styles.calNavBtn} onClick={() => setCalendarDate(new Date(year, month + 1, 1))}>→</button></div>
        <div style={styles.calGrid}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} style={styles.calDayHeader}>{d}</div>)}
          {days.map((day, i) => { const dayDeadlines = getDeadlinesForDay(day); return <div key={i} style={{ ...styles.calDay, ...(isToday(day) ? styles.calDayToday : {}), visibility: day ? 'visible' : 'hidden', cursor: day ? 'pointer' : 'default' }} onClick={() => day && onSelectDate(new Date(year, month, day), dayDeadlines[0])}><span style={{ fontWeight: isToday(day) ? 700 : 500 }}>{day}</span>{dayDeadlines.length > 0 && <div style={styles.calDots}>{dayDeadlines.slice(0, 3).map((d, j) => <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: d.isMeeting ? '#1cb0f6' : '#58cc02' }} />)}</div>}</div> })}
        </div>
      </div>
      
      <div style={{ marginTop: 24 }}><h3 style={styles.sectionTitle}>Upcoming Events</h3>
        {upcoming.length === 0 ? <div style={styles.emptyState}><p style={{ fontSize: 32 }}>📝</p><p style={{ color: '#777' }}>No events yet</p><p style={{ color: '#58cc02', fontWeight: 600, fontSize: 14, marginTop: 8 }}>Click any date above to add one!</p></div> : upcoming.map(deadline => { const date = new Date(deadline.date + 'T00:00:00'); const daysLeft = Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24)); return <div key={deadline.id} style={{ ...styles.deadlineCard, background: deadline.isMeeting ? '#ddf4ff' : '#d7ffb8' }} onClick={() => onSelectDate(date, deadline)}><div style={{ flex: 1 }}>{deadline.isMeeting && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#1cb0f6' }}>Meeting</span>}<h4 style={{ fontSize: 16, fontWeight: 700 }}>{deadline.title}</h4>{deadline.notes && <p style={{ fontSize: 14, color: '#777', marginTop: 4 }}>{deadline.notes}</p>}</div><div style={{ textAlign: 'right' }}><p style={{ fontSize: 14, fontWeight: 600 }}>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p><p style={{ fontSize: 12, color: daysLeft <= 7 ? '#ff4b4b' : '#777', fontWeight: daysLeft <= 7 ? 700 : 400 }}>{daysLeft} days</p></div></div> })}
      </div>
      
      <div style={{ marginTop: 24 }}><button style={styles.primaryBtn} onClick={onDone}>Done - Set Up Weekly Plan</button></div>
    </div>
  )
}

function DeadlineModal({ date, deadline, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({ title: deadline ? deadline.title : '', notes: deadline ? (deadline.notes || '') : '', isMeeting: deadline ? (deadline.isMeeting || false) : false })
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontFamily: 'Nunito, sans-serif', fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{deadline ? 'Edit Event' : 'Add Event'}</h2>
        <p style={{ fontSize: 14, color: '#777', marginBottom: 20 }}>{date ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''}</p>
        <input style={styles.modalInput} placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoFocus />
        <textarea style={{ ...styles.modalInput, height: 80, resize: 'none' }} placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        <div style={{ display: 'flex', gap: 12 }}>
          {deadline && <button style={{ ...styles.secondaryBtn, flex: 1, color: '#ff4b4b' }} onClick={() => onDelete(deadline.id)}>Delete</button>}
          <button style={{ ...styles.secondaryBtn, flex: 1 }} onClick={onClose}>Cancel</button>
          <button style={{ ...styles.primaryBtn, flex: 1 }} onClick={() => onSave(form)}>Save</button>
        </div>
      </div>
    </div>
  )
}

function PlanningScreen({ dateRange, deadlines, currentGoals, currentTasks, currentWeekId, expandedGoal, setExpandedGoal, addGoal, removeGoal, addTask, removeTask, planStep, setPlanStep, onNavigate, editMode, setEditMode, meetingDate, setMeeting }) {
  const [newGoal, setNewGoal] = useState('')
  const [newTaskText, setNewTaskText] = useState({})
  const [newTaskType, setNewTaskType] = useState({})
  const [showMeetingPicker, setShowMeetingPicker] = useState(false)
  const [tempMeetingDate, setTempMeetingDate] = useState(meetingDate || '')
  const { sunday, saturday } = getWeekInfo(parseWeekId(currentWeekId))
  const thisWeekDeadlines = deadlines.filter(d => { const date = new Date(d.date); return date >= sunday && date <= saturday && !d.isMeeting })
  const upcomingDeadlines = deadlines.filter(d => new Date(d.date) > saturday && !d.isMeeting).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
  
  const steps = editMode 
    ? [{ title: "Edit Your Plan", subtitle: "Update your goals and tasks" }]
    : [{ title: "Let's make a plan!", subtitle: "Review deadlines and set goals" }, { title: "Your deadlines", subtitle: "This week and upcoming" }, { title: "Set goals", subtitle: "What to accomplish?" }, { title: "Add tasks", subtitle: "Let's list tasks to achieve your goals." }, { title: "Schedule check-in", subtitle: "When should we review your progress?" }]
  
  const actualStep = editMode ? 0 : planStep

  const saveMeetingDate = () => {
    setMeeting(tempMeetingDate)
    setShowMeetingPicker(false)
  }

  const formatMeetingDisplay = (dateStr) => {
    if (!dateStr) return null
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  // Get min date for meeting picker (today)
  const today = new Date()
  const minDate = formatDateId(today)

  return (
    <div>
      <div style={styles.header}><span style={{ fontSize: 48 }}>📋</span><h1 style={styles.title}>{editMode ? 'Edit Weekly Plan' : "This Week's Plan"}</h1><div style={styles.weekBadge}>📅 {dateRange}</div></div>
      
      {!editMode && <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>{steps.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= planStep ? '#58cc02' : '#e5e5e5', cursor: 'pointer' }} onClick={() => setPlanStep(i)} />)}</div>}
      
      <div style={{ background: '#f7f7f7', borderRadius: 16, padding: 20, marginBottom: 24 }}><h3 style={{ fontFamily: 'Nunito, sans-serif', fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{steps[actualStep].title}</h3><p style={{ fontSize: 14, color: '#777' }}>{steps[actualStep].subtitle}</p></div>
      
      {!editMode && planStep <= 1 && <>{thisWeekDeadlines.length > 0 && <div style={{ marginBottom: 20 }}><h3 style={{ fontSize: 12, fontWeight: 700, color: '#ff4b4b', textTransform: 'uppercase', marginBottom: 10 }}>This Week</h3>{thisWeekDeadlines.map(d => <div key={d.id} style={{ ...styles.chip, background: '#d7ffb8', border: '2px solid #58cc02' }}><span style={{ color: '#46a302', fontWeight: 700 }}>{d.title}</span><span style={{ color: '#46a302', fontSize: 12 }}>{new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</span></div>)}</div>}{upcomingDeadlines.length > 0 && <div style={{ marginBottom: 20 }}><h3 style={{ fontSize: 12, fontWeight: 700, color: '#777', textTransform: 'uppercase', marginBottom: 10 }}>Upcoming</h3>{upcomingDeadlines.map(d => <div key={d.id} style={{ ...styles.chip, background: '#f7f7f7' }}><span style={{ color: '#777', fontWeight: 600 }}>{d.title}</span><span style={{ color: '#777', fontSize: 12 }}>{new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>)}</div>}{deadlines.filter(d => !d.isMeeting).length === 0 && <div style={styles.emptyState}><p style={{ color: '#777' }}>No deadlines. Add some on Calendar!</p></div>}</>}
      
      {((!editMode && planStep === 2) || editMode) && <div style={{ marginBottom: 20 }}><h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Your Goals</h3>{currentGoals.map((goal, i) => <div key={goal.id} style={{ ...styles.goalCard, background: goalColors[i % goalColors.length] }}><span style={{ flex: 1, fontWeight: 600 }}>{goal.text}</span><button style={styles.removeBtn} onClick={() => removeGoal(goal.id)}>x</button></div>)}<div style={{ display: 'flex', gap: 12, marginTop: 16 }}><input style={styles.input} placeholder="Add a goal..." value={newGoal} onChange={e => setNewGoal(e.target.value)} onKeyPress={e => { if (e.key === 'Enter') { addGoal(newGoal); setNewGoal('') } }} /><button style={styles.addBtn} onClick={() => { addGoal(newGoal); setNewGoal('') }}>+</button></div></div>}
      
      {((!editMode && planStep === 3) || editMode) && <div style={{ marginBottom: 20 }}><h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Tasks for Each Goal</h3>{currentGoals.length === 0 ? <div style={styles.emptyState}><p style={{ color: '#777' }}>{editMode ? 'Add goals above first!' : 'No goals. Go back and add some!'}</p></div> : currentGoals.map((goal, i) => <div key={goal.id} style={styles.goalSection}><div style={{ ...styles.goalHeader, background: goalColors[i % goalColors.length] }} onClick={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}><span>🎯</span><span style={{ flex: 1, fontWeight: 700 }}>{goal.text}</span><span style={{ fontWeight: 700, color: '#777' }}>{expandedGoal === goal.id ? '-' : '+'}</span></div>{expandedGoal === goal.id && <div style={{ padding: 16 }}>{currentTasks.filter(t => t.goalId === goal.id).map(task => <div key={task.id} style={styles.taskItem}><span style={{ ...styles.taskBadge, background: task.type === 'daily' ? '#ddf4ff' : '#fff4d4', color: task.type === 'daily' ? '#1cb0f6' : '#b8860b' }}>{task.type === 'daily' ? 'Daily Task' : 'Weekly Task'}</span><span style={{ flex: 1 }}>{task.text}</span><button style={styles.removeBtn} onClick={() => removeTask(task.id)}>x</button></div>)}<div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}><input style={{ ...styles.input, flex: '1 1 150px' }} placeholder="Add task..." value={newTaskText[goal.id] || ''} onChange={e => setNewTaskText({ ...newTaskText, [goal.id]: e.target.value })} onKeyPress={e => { if (e.key === 'Enter') { addTask(goal.id, newTaskText[goal.id] || '', newTaskType[goal.id] || 'daily'); setNewTaskText({ ...newTaskText, [goal.id]: '' }) } }} /><select style={styles.select} value={newTaskType[goal.id] || 'daily'} onChange={e => setNewTaskType({ ...newTaskType, [goal.id]: e.target.value })}><option value="daily">Daily Task</option><option value="weekly">Weekly Task</option></select><button style={styles.smallBtn} onClick={() => { addTask(goal.id, newTaskText[goal.id] || '', newTaskType[goal.id] || 'daily'); setNewTaskText({ ...newTaskText, [goal.id]: '' }) }}>Add</button></div></div>}</div>)}</div>}
      
      {!editMode && planStep === 4 && <div style={{ marginBottom: 20 }}>
        <div style={{ background: '#ddf4ff', border: '2px solid #1cb0f6', borderRadius: 16, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#1cb0f6' }}>📅 Progress Review Meeting</h3>
          <p style={{ fontSize: 14, color: '#555', marginBottom: 16 }}>Schedule a day to review your progress and plan for next week.</p>
          
          {meetingDate ? (
            <div>
              <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <p style={{ fontSize: 14, color: '#777' }}>Scheduled for:</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#1cb0f6' }}>{formatMeetingDisplay(meetingDate)}</p>
              </div>
              <button style={{ ...styles.secondaryBtn, background: '#fff' }} onClick={() => setShowMeetingPicker(true)}>Change Date</button>
            </div>
          ) : (
            <button style={styles.primaryBtn} onClick={() => { setTempMeetingDate(''); setShowMeetingPicker(true) }}>Pick a Meeting Day</button>
          )}
        </div>
        
        {showMeetingPicker && (
          <div style={{ marginTop: 16, background: '#fff', border: '2px solid #e5e5e5', borderRadius: 16, padding: 20 }}>
            <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>Select meeting date:</label>
            <input type="date" min={minDate} value={tempMeetingDate} onChange={e => setTempMeetingDate(e.target.value)} style={{ ...styles.input, marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={styles.secondaryBtn} onClick={() => setShowMeetingPicker(false)}>Cancel</button>
              <button style={styles.primaryBtn} onClick={saveMeetingDate} disabled={!tempMeetingDate}>Save</button>
            </div>
          </div>
        )}
      </div>}
      
      {editMode && <div style={{ marginBottom: 20 }}>
        <div style={{ background: '#ddf4ff', border: '2px solid #1cb0f6', borderRadius: 16, padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#1cb0f6' }}>📅 Progress Review Meeting</h3>
          {meetingDate ? (
            <div>
              <p style={{ fontSize: 14, color: '#555', marginBottom: 8 }}>Scheduled for: <strong>{formatMeetingDisplay(meetingDate)}</strong></p>
              {!showMeetingPicker && <button style={{ ...styles.secondaryBtn, background: '#fff' }} onClick={() => { setTempMeetingDate(meetingDate); setShowMeetingPicker(true) }}>Change Date</button>}
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 14, color: '#555', marginBottom: 12 }}>No meeting scheduled yet.</p>
              {!showMeetingPicker && <button style={{ ...styles.secondaryBtn, background: '#fff' }} onClick={() => { setTempMeetingDate(''); setShowMeetingPicker(true) }}>Schedule Meeting</button>}
            </div>
          )}
          {showMeetingPicker && (
            <div style={{ marginTop: 12 }}>
              <input type="date" min={minDate} value={tempMeetingDate} onChange={e => setTempMeetingDate(e.target.value)} style={{ ...styles.input, marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 12 }}>
                <button style={styles.secondaryBtn} onClick={() => setShowMeetingPicker(false)}>Cancel</button>
                <button style={styles.primaryBtn} onClick={saveMeetingDate} disabled={!tempMeetingDate}>Save</button>
              </div>
            </div>
          )}
        </div>
      </div>}
      
      <div style={{ display: 'flex', gap: 12 }}>
        {editMode ? (
          <button style={styles.primaryBtn} onClick={() => { setEditMode(false); onNavigate('daily') }}>Done Editing</button>
        ) : (
          <>
            {planStep > 0 ? <button style={styles.secondaryBtn} onClick={() => setPlanStep(planStep - 1)}>Back</button> : <button style={styles.secondaryBtn} onClick={() => onNavigate('calendar')}>Calendar</button>}
            {planStep < 4 ? <button style={styles.primaryBtn} onClick={() => setPlanStep(planStep + 1)}>Continue</button> : currentTasks.length > 0 ? <button style={styles.primaryBtn} onClick={() => onNavigate('daily')}>Start Daily Tasks</button> : null}
          </>
        )}
      </div>
    </div>
  )
}

function CheckinScreen({ type, dateRange, tasks, goals, progress, isChecked, onToggle, onNavigate, goToEditPlan }) {
  const isDaily = type === 'daily'
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  return (
    <div>
      <div style={styles.header}><span style={{ fontSize: 48 }}>{isDaily ? '☀️' : '🏆'}</span><h1 style={styles.title}>{isDaily ? 'Daily Check-in' : 'Weekly Check-in'}</h1>{isDaily ? <><p style={{ color: '#777' }}>{today}</p><p style={{ fontSize: 13, color: '#777', marginTop: 4 }}>Week of {dateRange}</p></> : <div style={styles.weekBadge}>📅 {dateRange}</div>}</div>
      <div style={styles.progressContainer}><div style={styles.progressBar}><div style={{ ...styles.progressFill, width: progress + '%', background: isDaily ? '#1cb0f6' : '#ffc800' }} /></div><span style={{ fontSize: 14, color: '#777', textAlign: 'right', display: 'block', fontWeight: 600 }}>{progress}% complete</span></div>
      <div style={{ marginBottom: 24 }}>{tasks.length === 0 ? <p style={styles.emptyText}>No {isDaily ? 'daily' : 'weekly'} tasks. Add some in your Weekly Plan!</p> : tasks.map(task => { const goal = goals.find(g => g.id === task.goalId); const checked = isChecked(task.id); return <div key={task.id} style={{ ...styles.checkItem, background: checked ? '#f7f7f7' : '#fff' }}><div style={{ ...styles.checkbox, background: checked ? (isDaily ? '#1cb0f6' : '#ffc800') : '#fff', borderColor: checked ? (isDaily ? '#1cb0f6' : '#ffc800') : '#ccc' }} onClick={() => onToggle(task.id)}>{checked && <span style={{ color: '#fff', fontSize: 14 }}>✓</span>}</div><div style={{ flex: 1 }}><span style={{ fontSize: 16, fontWeight: 600, textDecoration: checked ? 'line-through' : 'none', color: checked ? '#aaa' : '#3c3c3c' }}>{task.text}</span>{goal && <span style={{ display: 'block', fontSize: 13, color: '#aaa', fontStyle: 'italic', marginTop: 4 }}>{goal.text}</span>}</div></div> })}</div>
      <div style={{ display: 'flex', gap: 12 }}><button style={styles.secondaryBtn} onClick={goToEditPlan}>Edit Weekly Plan</button><button style={styles.secondaryBtn} onClick={() => onNavigate(isDaily ? 'weekly' : 'daily')}>{isDaily ? 'Weekly Tasks' : 'Daily Tasks'}</button></div>
    </div>
  )
}

function HistoryScreen({ weeklyGoals, weeklyTasks, dailyChecks, weeklyChecks, currentWeekId, onNavigate }) {
  const weeks = [...new Set([...Object.keys(weeklyTasks), ...weeklyGoals.map(g => g.weekId)])].filter(w => w <= currentWeekId).sort((a, b) => b.localeCompare(a))
  const getProgress = (weekId) => { const tasks = weeklyTasks[weekId] || []; const daily = tasks.filter(t => t.type === 'daily'); const weekly = tasks.filter(t => t.type === 'weekly'); const { sunday } = getWeekInfo(parseWeekId(weekId)); let dailyDone = 0; for (let i = 0; i < 7; i++) { const dayDate = new Date(sunday); dayDate.setDate(sunday.getDate() + i); daily.forEach(t => { if (dailyChecks[formatDateId(dayDate) + '-' + t.id]) dailyDone++ }) }; const weeklyDone = weekly.filter(t => weeklyChecks[weekId + '-' + t.id]).length; const totalDaily = daily.length * 7; const total = totalDaily + weekly.length; return { daily: totalDaily > 0 ? Math.round((dailyDone / totalDaily) * 100) : 0, weekly: weekly.length > 0 ? Math.round((weeklyDone / weekly.length) * 100) : 0, overall: total > 0 ? Math.round(((dailyDone + weeklyDone) / total) * 100) : 0 } }
  return (
    <div>
      <div style={styles.header}><span style={{ fontSize: 48 }}>📊</span><h1 style={styles.title}>Your Progress</h1></div>
      <div style={{ marginBottom: 24 }}>{weeks.length === 0 ? <p style={styles.emptyText}>No history yet!</p> : weeks.map(weekId => { const { dateRange } = getWeekInfo(parseWeekId(weekId)); const progress = getProgress(weekId); const isCurrent = weekId === currentWeekId; return <div key={weekId} style={{ ...styles.historyCard, borderColor: isCurrent ? '#58cc02' : '#e5e5e5', borderWidth: isCurrent ? 3 : 2 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><div><span style={{ fontWeight: 700 }}>{dateRange}</span>{isCurrent && <span style={styles.currentBadge}>Current</span>}</div></div><div style={{ display: 'flex', gap: 16, marginBottom: 12 }}><div style={{ flex: 1 }}><div style={styles.miniProgressBar}><div style={{ height: '100%', width: progress.daily + '%', background: '#1cb0f6', borderRadius: 4 }} /></div><span style={{ fontSize: 12, color: '#777' }}>Daily Tasks {progress.daily}%</span></div><div style={{ flex: 1 }}><div style={styles.miniProgressBar}><div style={{ height: '100%', width: progress.weekly + '%', background: '#ffc800', borderRadius: 4 }} /></div><span style={{ fontSize: 12, color: '#777' }}>Weekly Tasks {progress.weekly}%</span></div></div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '2px solid #f7f7f7' }}><span style={{ color: '#777', fontWeight: 600 }}>Overall</span><span style={{ fontSize: 24, fontWeight: 800, color: '#58cc02', fontFamily: 'Nunito, sans-serif' }}>{progress.overall}%</span></div></div> })}</div>
      <button style={styles.secondaryBtn} onClick={() => onNavigate('weekly')}>Back</button>
    </div>
  )
}

const styles = { app: { minHeight: '100vh', background: '#fff' }, authContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f7f7f7' }, authCard: { width: '100%', maxWidth: 400, background: '#fff', borderRadius: 16, padding: '40px 32px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: '2px solid #e5e5e5' }, authTitle: { fontFamily: 'Nunito, sans-serif', fontSize: 28, fontWeight: 800, marginBottom: 8 }, authInput: { width: '100%', padding: '14px 18px', fontSize: 16, border: '2px solid #e5e5e5', borderRadius: 12, marginBottom: 12 }, authError: { color: '#ff4b4b', fontSize: 14, textAlign: 'center', marginBottom: 16, padding: 12, background: '#ffe0e0', borderRadius: 10 }, authDivider: { display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0' }, dividerLine: { flex: 1, height: 2, background: '#e5e5e5' }, primaryBtn: { width: '100%', padding: '14px 24px', fontSize: 15, fontWeight: 700, fontFamily: 'Nunito, sans-serif', textTransform: 'uppercase', letterSpacing: 0.8, background: '#58cc02', color: '#fff', border: 'none', borderRadius: 12, boxShadow: '0 4px 0 #46a302', cursor: 'pointer' }, secondaryBtn: { width: '100%', padding: '12px 20px', fontSize: 14, fontWeight: 700, fontFamily: 'Nunito, sans-serif', background: '#fff', color: '#4b4b4b', border: '2px solid #e5e5e5', borderRadius: 12, boxShadow: '0 4px 0 #ccc', cursor: 'pointer' }, userHeader: { position: 'fixed', top: 16, right: 16, zIndex: 200 }, userBadge: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', padding: '8px 14px 8px 8px', borderRadius: 24, cursor: 'pointer', border: '2px solid #e5e5e5', fontSize: 14, fontWeight: 600 }, avatar: { width: 32, height: 32, borderRadius: '50%', background: '#58cc02', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }, userMenu: { position: 'absolute', top: '100%', right: 0, marginTop: 8, background: '#fff', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '2px solid #e5e5e5', overflow: 'hidden', minWidth: 180 }, logoutBtn: { width: '100%', padding: '14px 20px', fontSize: 14, fontWeight: 600, background: 'transparent', color: '#ff4b4b', border: 'none', textAlign: 'left', cursor: 'pointer' }, content: { maxWidth: 520, margin: '0 auto', padding: '80px 24px 120px' }, header: { textAlign: 'center', marginBottom: 32 }, title: { fontFamily: 'Nunito, sans-serif', fontSize: 28, fontWeight: 800, marginBottom: 8 }, weekBadge: { display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f7f7f7', padding: '10px 18px', borderRadius: 24, fontSize: 14, fontWeight: 600, marginTop: 16, border: '2px solid #e5e5e5' }, sectionTitle: { fontSize: 16, fontWeight: 700, marginBottom: 12, fontFamily: 'Nunito, sans-serif' }, emptyState: { textAlign: 'center', padding: '40px 20px', background: '#f7f7f7', borderRadius: 16, border: '2px dashed #e5e5e5' }, emptyText: { textAlign: 'center', color: '#aaa', fontStyle: 'italic', padding: '40px 20px' }, welcomeBox: { background: '#d7ffb8', border: '2px solid #58cc02', borderRadius: 16, padding: 20, marginBottom: 24, color: '#2d5a1d' }, calendarCard: { background: '#fff', borderRadius: 16, padding: 20, border: '2px solid #e5e5e5' }, calendarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }, calNavBtn: { width: 36, height: 36, borderRadius: 8, border: '2px solid #e5e5e5', background: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }, calMonth: { fontFamily: 'Nunito, sans-serif', fontSize: 18, fontWeight: 800 }, calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }, calDayHeader: { textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#aaa', padding: '8px 0', textTransform: 'uppercase' }, calDay: { aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 8, fontSize: 14, position: 'relative', gap: 2 }, calDayToday: { background: '#d7ffb8' }, calDots: { display: 'flex', gap: 2, position: 'absolute', bottom: 4 }, deadlineCard: { display: 'flex', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 8, cursor: 'pointer' }, chip: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 10, marginBottom: 8, fontSize: 14 }, goalCard: { borderRadius: 16, padding: '18px 20px', marginBottom: 12, display: 'flex', alignItems: 'center' }, goalSection: { background: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden', border: '2px solid #e5e5e5' }, goalHeader: { padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }, input: { flex: 1, padding: '14px 18px', fontSize: 16, border: '2px solid #e5e5e5', borderRadius: 12 }, addBtn: { width: 52, height: 52, borderRadius: 12, border: 'none', background: '#58cc02', color: '#fff', fontSize: 24, fontWeight: 700, boxShadow: '0 4px 0 #46a302', cursor: 'pointer' }, removeBtn: { background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer', padding: '4px 8px' }, taskItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '2px solid #f7f7f7' }, taskBadge: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '5px 10px', borderRadius: 20 }, select: { padding: '12px 16px', fontSize: 14, border: '2px solid #e5e5e5', borderRadius: 10, background: '#f7f7f7' }, smallBtn: { padding: '12px 20px', fontSize: 13, fontWeight: 700, fontFamily: 'Nunito, sans-serif', textTransform: 'uppercase', background: '#58cc02', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }, progressContainer: { marginBottom: 28 }, progressBar: { height: 16, background: '#e5e5e5', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }, progressFill: { height: '100%', borderRadius: 8, transition: 'width 0.5s ease' }, checkItem: { borderRadius: 16, padding: '18px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', border: '2px solid #e5e5e5' }, checkbox: { width: 28, height: 28, borderRadius: 8, border: '3px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginRight: 16 }, historyCard: { background: '#fff', borderRadius: 16, padding: 20, marginBottom: 12, border: '2px solid #e5e5e5' }, currentBadge: { display: 'inline-block', marginLeft: 10, padding: '4px 10px', background: '#d7ffb8', color: '#46a302', fontSize: 10, fontWeight: 700, borderRadius: 12, textTransform: 'uppercase' }, miniProgressBar: { height: 8, background: '#e5e5e5', borderRadius: 4, overflow: 'hidden', marginBottom: 4 }, bottomNav: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '2px solid #e5e5e5', display: 'flex', justifyContent: 'space-around', padding: '8px 0 16px', zIndex: 100 }, navBtn: { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '8px 12px', cursor: 'pointer' }, modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 300 }, modal: { width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16, padding: 24, maxHeight: '90vh', overflow: 'auto' }, modalInput: { width: '100%', padding: '14px 18px', fontSize: 16, border: '2px solid #e5e5e5', borderRadius: 12, marginBottom: 16 } }
