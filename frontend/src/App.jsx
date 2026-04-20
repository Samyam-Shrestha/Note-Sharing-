import { useMemo, useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

// Standard tag colors matching the CSS vars
const TAG_COLORS = {
  Finance: "var(--tag-finance)",
  Health: "var(--tag-health)",
  Ideas: "var(--tag-ideas)",
  Personal: "var(--tag-personal)",
  Recipes: "var(--tag-recipes)",
  Shopping: "var(--tag-shopping)",
  Travel: "var(--tag-travel)",
  Work: "var(--tag-work)"
};

export default function App() {
  const [view, setView] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [token, setToken] = useState("");
  const [userRole, setUserRole] = useState(null);
  const [sessionUser, setSessionUser] = useState(null);
  const [notes, setNotes] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Dashboard UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [navFilter, setNavFilter] = useState("all"); // all, archive, trash, tag:...
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("viewer");

  const authHeaders = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  }), [token]);

  useEffect(() => {
    if (token) {
      if (userRole === "admin") {
        setView("admin-dashboard");
        loadAdminUsers(token);
      } else {
        setView("dashboard");
        loadNotes(token);
      }
    } else if (!["login", "signup", "verify-email", "admin-login"].includes(view)) {
      setView("login");
    }
  }, [token, userRole]);

  // Auth Functions
  async function login() {
    setError(""); setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.unverified) {
          setView("verify-email");
          return setError("Please verify your email first.");
        }
        return setError(body.error || "Login failed");
      }
      if (view === "admin-login" && body.user.role !== "admin") return setError("Access denied.");
      setUserRole(body.user.role);
      setSessionUser(body.user);
      setToken(body.accessToken);
      setEmail(""); setPassword("");
    } catch (err) {
      setError("Network error. Please check your connection or CORS settings.");
    }
  }

  async function signup() {
    setError(""); setSuccess("");
    const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!pwdRegex.test(password)) {
      return setError("Password must be at least 8 chars with uppercase, lowercase, number, and special character.");
    }
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const body = await res.json();
      if (!res.ok) return setError(body.error || "Signup failed");
      setView("verify-email");
      setSuccess(body.message);
    } catch (err) {
      setError("Network error. Please check your connection or CORS settings.");
    }
  }

  async function verifyEmail() {
    setError(""); setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: verificationCode })
      });
      const body = await res.json();
      if (!res.ok) return setError(body.error || "Verification failed");
      setUserRole(body.user.role);
      setSessionUser(body.user);
      setToken(body.accessToken);
      setEmail(""); setPassword(""); setVerificationCode("");
    } catch (err) {
      setError("Network error during verification.");
    }
  }

  function logout() {
    setToken(""); setUserRole(null); setSessionUser(null); setNotes([]); setAdminUsers([]); setView("login");
  }

  // Data Functions
  async function loadNotes(activeToken = token) {
    const res = await fetch(`${API_BASE}/notes`, { headers: { Authorization: `Bearer ${activeToken}` } });
    if (res.ok) setNotes((await res.json()).notes);
  }

  async function loadAdminUsers(activeToken = token) {
    const res = await fetch(`${API_BASE}/admin/users`, { headers: { Authorization: `Bearer ${activeToken}` } });
    if (res.ok) setAdminUsers((await res.json()).users);
  }

  async function saveNote() {
    setError("");
    const url = editingNote ? `${API_BASE}/notes/${editingNote.id}` : `${API_BASE}/notes`;
    const method = editingNote ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: authHeaders,
      body: JSON.stringify({ title, content, tags })
    });
    if (!res.ok) return setError((await res.json()).error || "Save failed");
    closeModal();
    await loadNotes();
  }

  async function togglePin(e, note) {
    e.stopPropagation();
    await fetch(`${API_BASE}/notes/${note.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ is_pinned: !note.is_pinned })
    });
    await loadNotes();
  }

  async function toggleArchive(note) {
    await fetch(`${API_BASE}/notes/${note.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ is_archived: !note.is_archived, is_trashed: false })
    });
    closeModal();
    await loadNotes();
  }

  async function toggleTrash(note) {
    if (note.is_trashed) {
      // Actually delete
      await fetch(`${API_BASE}/notes/${note.id}`, { method: "DELETE", headers: authHeaders });
    } else {
      // Move to trash
      await fetch(`${API_BASE}/notes/${note.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ is_trashed: true, is_archived: false, is_pinned: false })
      });
    }
    closeModal();
    await loadNotes();
  }

  async function shareNoteWithUser() {
    setError(""); setSuccess("");
    if (!shareEmail) return setError("Please enter an email to share with.");
    
    try {
      const res = await fetch(`${API_BASE}/notes/${editingNote.id}/share`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ targetEmail: shareEmail, role: shareRole })
      });
      const body = await res.json();
      if (!res.ok) return setError(body.error || "Failed to share note");
      setSuccess("Note shared successfully!");
      setShareEmail("");
      await loadNotes();
    } catch (err) {
      setError("Network error. Failed to share note.");
    }
  }

  // UI Helpers
  function openNewNoteModal() {
    setEditingNote(null); setTitle(""); setContent(""); setTags([]); setError(""); setIsModalOpen(true);
  }
  function openEditModal(note) {
    setEditingNote(note); setTitle(note.title); setContent(note.content); setTags(note.tags || []); setError(""); setIsModalOpen(true);
  }
  function closeModal() { setIsModalOpen(false); }

  function addTag(e) {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      if (!tags.includes(newTag.trim())) setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  }
  function removeTag(tagToRemove) {
    setTags(tags.filter(t => t !== tagToRemove));
  }

  // Formatting helpers
  function formatDate(isoString) {
    return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getTagColor(tag) {
    return TAG_COLORS[tag] || "var(--text-muted)";
  }

  // Render Views
  if (["login", "signup", "verify-email", "admin-login"].includes(view)) {
    return (
      <div className="app-layout" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <main className="container">
          <div className="text-center">
            <h1>{view === "admin-login" ? "Admin Portal" : "Anchor"}</h1>
            <p className="password-hint">
              {view === "login" && "Login to access your encrypted notes."}
              {view === "signup" && "Create a secure account."}
              {view === "verify-email" && "Check your console/email for the code."}
              {view === "admin-login" && "Login with admin credentials."}
            </p>
          </div>
          
          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" disabled={view === "verify-email"} />
          </div>
          
          {view !== "verify-email" && (
            <div className="form-group">
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
              {view === "signup" && <p className="password-hint">Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char.</p>}
            </div>
          )}

          {view === "verify-email" && (
            <div className="form-group">
              <input value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} placeholder="6-digit code" maxLength={6} />
            </div>
          )}
          
          {view === "login" && <button onClick={login} className="btn-block">Login</button>}
          {view === "signup" && <button onClick={signup} className="btn-block">Sign Up</button>}
          {view === "verify-email" && <button onClick={verifyEmail} className="btn-block">Verify & Login</button>}
          {view === "admin-login" && <button onClick={login} className="btn-block">Admin Login</button>}

          {error && <div className="error-msg">{error}</div>}
          {success && <div className="success-msg">{success}</div>}

          <div className="text-center" style={{ marginTop: "1.5rem" }}>
            {view === "login" && (
              <>
                <p>Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); setView("signup"); setError(""); }} style={{ color: "var(--accent-color)" }}>Sign up</a></p>
                <p style={{marginTop: '0.5rem'}}><a href="#" onClick={(e) => { e.preventDefault(); setView("admin-login"); setError(""); }} style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Admin Portal</a></p>
              </>
            )}
            {view === "signup" && (
              <p>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setView("login"); setError(""); }} style={{ color: "var(--accent-color)" }}>Login</a></p>
            )}
            {view === "admin-login" && (
              <p><a href="#" onClick={(e) => { e.preventDefault(); setView("login"); setError(""); }} style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Back to User Login</a></p>
            )}
            {view === "verify-email" && (
              <p><a href="#" onClick={(e) => { e.preventDefault(); setView("login"); setError(""); }} style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Back to Login</a></p>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (view === "admin-dashboard") {
    return (
      <div className="app-layout">
        <aside className="sidebar">
          <div className="logo-section">
            <div className="logo-icon">⚓</div> Anchor Admin
          </div>
          <div className="sidebar-footer">
            <div className="user-email">{email} (Admin)</div>
            <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); logout(); }}>Sign Out</a>
          </div>
        </aside>
        <main className="main-content">
          <div className="top-bar">
            <h2 style={{color: '#fff'}}>Admin Dashboard</h2>
            <button onClick={() => loadAdminUsers()} className="action-btn">Refresh</button>
          </div>
          <div className="content-area">
            <div className="section-title">Registered Users ({adminUsers.length})</div>
            <div className="notes-grid">
              {adminUsers.map(u => (
                <div key={u.id} className="note-card">
                  <div className="note-header"><div className="note-title">{u.email}</div></div>
                  <div className="note-snippet">ID: {u.id}<br/>Role: {u.role}<br/>Verified: {u.is_verified ? 'Yes' : 'No'}</div>
                  <div className="note-footer"><div className="note-date">Joined: {formatDate(u.created_at)}</div></div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Main Dashboard
  const myActiveNotes = notes.filter(n => sessionUser && n.owner_id === sessionUser.id && !n.is_trashed && !n.is_archived);
  const allTags = [...new Set(myActiveNotes.flatMap(n => n.tags || []))].sort();
  
  // Filter notes
  let visibleNotes = notes;
  if (navFilter === "shared") {
    visibleNotes = notes.filter(n => sessionUser && n.owner_id !== sessionUser.id && !n.is_trashed);
  } else if (navFilter === "archive") {
    visibleNotes = notes.filter(n => n.is_archived && !n.is_trashed && sessionUser && n.owner_id === sessionUser.id);
  } else if (navFilter === "trash") {
    visibleNotes = notes.filter(n => n.is_trashed && sessionUser && n.owner_id === sessionUser.id);
  } else if (navFilter.startsWith("tag:")) {
    const tag = navFilter.split(":")[1];
    visibleNotes = notes.filter(n => !n.is_trashed && !n.is_archived && n.tags?.includes(tag) && sessionUser && n.owner_id === sessionUser.id);
  } else {
    visibleNotes = notes.filter(n => !n.is_archived && !n.is_trashed && sessionUser && n.owner_id === sessionUser.id);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    visibleNotes = visibleNotes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  }

  const pinnedNotes = visibleNotes.filter(n => n.is_pinned);
  const unpinnedNotes = visibleNotes.filter(n => !n.is_pinned);

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon">⚓</div> Anchor
        </div>
        
        <button className="new-note-btn" onClick={openNewNoteModal}>
          <span>+</span> New Note
        </button>

        <div className="nav-section">
          <a href="#" className={`nav-item ${navFilter === 'all' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setNavFilter('all'); }}>
            <div className="nav-label">📄 All Notes</div>
          </a>
          <a href="#" className={`nav-item ${navFilter === 'shared' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setNavFilter('shared'); }}>
            <div className="nav-label">🤝 Shared with me</div>
          </a>
          <a href="#" className={`nav-item ${navFilter === 'archive' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setNavFilter('archive'); }}>
            <div className="nav-label">📦 Archive</div>
          </a>
          <a href="#" className={`nav-item ${navFilter === 'trash' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setNavFilter('trash'); }}>
            <div className="nav-label">🗑️ Trash</div>
          </a>
        </div>

        <div className="nav-section">
          <div className="nav-title">🏷️ TAGS</div>
          {allTags.map(tag => {
            const count = myActiveNotes.filter(n => n.tags?.includes(tag)).length;
            return (
              <a href="#" key={tag} className={`nav-item ${navFilter === `tag:${tag}` ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setNavFilter(`tag:${tag}`); }}>
                <div className="nav-label">
                  <span className="tag-color" style={{background: getTagColor(tag)}}></span>
                  {tag}
                </div>
                <span style={{fontSize: '0.75rem'}}>{count}</span>
              </a>
            );
          })}
        </div>

        <div className="sidebar-footer">
          <div className="user-email">{email}</div>
          <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); setView("admin-login"); }}>🛡️ Admin Portal</a>
          <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); logout(); }}>🚪 Sign Out</a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="top-bar">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input 
              placeholder="Search notes..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="cmd-k">⌘ K</span>
          </div>
          <div className="top-actions">
            <button className="action-btn" onClick={() => loadNotes()}>↻ Refresh</button>
          </div>
        </div>

        <div className="content-area">
          {pinnedNotes.length > 0 && (
            <>
              <div className="section-title">📌 PINNED ({pinnedNotes.length})</div>
              <div className="notes-grid">
                {pinnedNotes.map(n => (
                  <div key={n.id} className="note-card" onClick={() => openEditModal(n)}>
                    <div className="note-header">
                      <div className="note-title">{n.title}</div>
                      <div className="pin-icon" onClick={(e) => togglePin(e, n)}>📌</div>
                    </div>
                    <div className="note-snippet">{n.content}</div>
                    <div className="note-footer">
                      <div className="note-tags">
                        {n.tags?.map(t => <span key={t} className="tag-pill" style={{color: getTagColor(t)}}>{t}</span>)}
                      </div>
                      <div className="note-date">{formatDate(n.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="section-title">{navFilter === 'all' ? 'ALL NOTES' : navFilter.toUpperCase()} ({unpinnedNotes.length})</div>
          <div className="notes-grid">
            {unpinnedNotes.map(n => (
              <div key={n.id} className="note-card" onClick={() => openEditModal(n)}>
                <div className="note-header">
                  <div className="note-title">{n.title}</div>
                  {!n.is_trashed && !n.is_archived && <div className="pin-icon unpinned" onClick={(e) => togglePin(e, n)}>📌</div>}
                </div>
                <div className="note-snippet">{n.content}</div>
                <div className="note-footer">
                  <div className="note-tags">
                    {n.tags?.map(t => <span key={t} className="tag-pill" style={{color: getTagColor(t)}}>{t}</span>)}
                  </div>
                  <div className="note-date">{formatDate(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{color: '#fff'}}>{editingNote ? "Edit Note" : "New Note"}</h2>
            {error && <div className="error-msg">{error}</div>}
            
            <div className="form-group">
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Note Title" />
            </div>
            
            <div className="form-group">
              <textarea 
                value={content} 
                onChange={e => setContent(e.target.value)} 
                placeholder="Write your secure note here..."
                style={{height: '200px', resize: 'vertical'}}
              />
            </div>

            <div className="form-group">
              <div className="tags-input-container">
                {tags.map(t => (
                  <div key={t} className="tag-input-pill">
                    {t} <span onClick={() => removeTag(t)}>×</span>
                  </div>
                ))}
              </div>
              <input 
                value={newTag} 
                onChange={e => setNewTag(e.target.value)} 
                onKeyDown={addTag}
                placeholder="Add tags (press Enter)" 
              />
            </div>

            {editingNote && sessionUser && editingNote.owner_id === sessionUser.id && (
              <div className="form-group" style={{marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)'}}>
                <h3 style={{fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-muted)'}}>Share Note</h3>
                <div style={{display: 'flex', gap: '0.5rem'}}>
                  <input 
                    type="email" 
                    placeholder="Friend's email..." 
                    value={shareEmail} 
                    onChange={e => setShareEmail(e.target.value)}
                    style={{flex: 1, minWidth: '0'}}
                  />
                  <select 
                    value={shareRole} 
                    onChange={e => setShareRole(e.target.value)}
                    style={{width: 'auto', padding: '0.5rem', borderRadius: '8px', background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)'}}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button className="action-btn" onClick={shareNoteWithUser} style={{background: 'var(--accent-color)', color: '#fff', border: 'none', padding: '0.5rem 1rem'}}>Share</button>
                </div>
              </div>
            )}

            <div className="modal-actions">
              {editingNote && sessionUser && editingNote.owner_id === sessionUser.id && (
                <>
                  <button className="action-btn" onClick={() => toggleArchive(editingNote)}>
                    {editingNote.is_archived ? "Unarchive" : "Archive"}
                  </button>
                  <button className="action-btn" style={{color: '#ef4444'}} onClick={() => toggleTrash(editingNote)}>
                    {editingNote.is_trashed ? "Delete Forever" : "Trash"}
                  </button>
                  {editingNote.is_trashed && (
                    <button className="action-btn" onClick={() => {
                       fetch(`${API_BASE}/notes/${editingNote.id}`, {
                        method: "PATCH", headers: authHeaders, body: JSON.stringify({ is_trashed: false })
                      }).then(() => { closeModal(); loadNotes(); });
                    }}>Restore</button>
                  )}
                </>
              )}
              <div style={{flex: 1}}></div>
              <button className="action-btn" onClick={closeModal}>Cancel</button>
              <button style={{background: 'var(--accent-color)', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer'}} onClick={saveNote}>Save Note</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
