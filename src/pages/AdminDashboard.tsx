import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useStore } from '../store/useStore';
import { Navigate } from 'react-router-dom';
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, onSnapshot, query, orderBy, where, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Package, MapPin, MessageSquare, Plus, Trash2, X, Settings, FileText, Activity, RefreshCw, Edit, ShieldCheck, FileDown, Layers, Video, Image as ImageIcon, Share2, Mail, CheckCircle, Phone, Send, ClipboardList, Calendar } from 'lucide-react';
import { apiUrl } from '../lib/api';
import { uploadFileToStorage, deleteFileFromStorage } from '../lib/storage';

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // Firebase Storage allows much more; keep a sane UX cap.

/**
 * Inspects the first 256KB of an MP4/MOV file and detects whether the video
 * track is encoded with H.265 / HEVC (atoms `hvc1`, `hev1`, or `hvcC`).
 * HEVC is rejected because Chrome / Firefox / Edge / WeChat browsers cannot
 * decode it inside an HTML <video> element, leading to silently broken
 * playback on the public site.
 */
async function isHevcVideo(file: File): Promise<boolean> {
  try {
    const head = await file.slice(0, Math.min(file.size, 256 * 1024)).arrayBuffer();
    const bytes = new Uint8Array(head);
    // ASCII scan for the HEVC atom signatures.
    const needles = [
      [0x68, 0x76, 0x63, 0x31], // hvc1
      [0x68, 0x65, 0x76, 0x31], // hev1
      [0x68, 0x76, 0x63, 0x43], // hvcC
    ];
    for (let i = 0; i < bytes.length - 4; i++) {
      for (const n of needles) {
        if (bytes[i] === n[0] && bytes[i + 1] === n[1] && bytes[i + 2] === n[2] && bytes[i + 3] === n[3]) {
          return true;
        }
      }
    }
    return false;
  } catch (e) {
    console.warn('[upload] HEVC probe failed, allowing upload:', e);
    return false;
  }
}

/**
 * Uploads a file to Firebase Storage (primary backend) and returns the
 * resulting download URL. Falls back to the Render-hosted /api/upload
 * endpoint only when Storage rejects the upload, which keeps the workflow
 * resilient even before Storage rules are configured.
 */
async function uploadFile(file: File, folder = 'uploads'): Promise<string> {
  // Auto-transcode H.265 / HEVC videos to H.264 on the server so browsers
  // can play them. The transcoded file is returned and then uploaded to
  // Firebase Storage via the normal client SDK path.
  if (file.type.startsWith('video/') || /\.(mp4|mov|m4v)$/i.test(file.name)) {
    if (await isHevcVideo(file)) {
      console.log('[upload] H.265 detected, sending to server for transcoding…');
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch(apiUrl('/api/transcode'), { method: 'POST', body: formData });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Transcode failed' }));
        throw new Error(
          err.error || '服务端转码失败 / Server-side transcode failed'
        );
      }
      const blob = await resp.blob();
      file = new File([blob], file.name.replace(/\.\w+$/, '.mp4'), { type: 'video/mp4' });
      console.log(`[upload] Transcode complete: ${(blob.size / 1024 / 1024).toFixed(1)}MB H.264`);
    }
  }
  try {
    return await uploadFileToStorage(file, folder);
  } catch (storageErr) {
    console.warn('[upload] Firebase Storage failed, falling back to Render API:', storageErr);
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(apiUrl('/api/upload'), { method: 'POST', body: formData });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upload failed (${response.status}): ${text.substring(0, 200)}`);
    }
    const data = await response.json();
    return data.url as string;
  }
}

/**
 * Deletes a previously uploaded asset. Dispatches based on URL host:
 * - Firebase Storage download URLs   -> deleteObject via SDK
 * - Legacy /uploads/* (Render disk)  -> POST /api/delete-file
 * Silently succeeds for unknown URLs so callers don't need to branch.
 */
const deleteFileFromServer = async (fileUrl: string) => {
  if (!fileUrl || typeof fileUrl !== 'string') return true;
  if (fileUrl.includes('firebasestorage.googleapis.com')) {
    await deleteFileFromStorage(fileUrl);
    return true;
  }
  if (!/\/uploads\//.test(fileUrl)) return true;
  try {
    const response = await fetch(apiUrl('/api/delete-file'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUrl })
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting file from server:', error);
    return false;
  }
};

function Sidebar({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) {
  const { t } = useTranslation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'messages'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const unread = snapshot.docs.filter(doc => doc.data().status === 'new').length;
      setUnreadCount(unread);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages_badge');
    });
    return () => unsubscribe();
  }, []);

  const navItems = [
    { id: 'dashboard', label: t('admin.dashboard'), icon: Activity },
    { id: 'messages', label: t('admin.messages'), icon: MessageSquare, badge: unreadCount },
    { id: 'tasks', label: t('admin.tasks', 'Follow-up Tasks'), icon: ClipboardList },
    { id: 'products', label: t('admin.products'), icon: Package },
    { id: 'categories', label: t('admin.categories'), icon: Layers },
    { id: 'regions', label: t('admin.regions'), icon: MapPin },
    { id: 'qualifications', label: t('admin.qualifications'), icon: ShieldCheck },
    { id: 'certificates', label: t('admin.certificates_tab'), icon: ShieldCheck },
    { id: 'brand-logos', label: t('admin.brand_logos', 'Brand Logos'), icon: Layers },
    { id: 'blog', label: t('admin.blog', 'Blog'), icon: FileText },
    { id: 'hero-stylist', label: t('admin.hero_stylist', 'Hero Stylist'), icon: Layers },
    { id: 'contacts', label: t('admin.contacts_management', 'Contact Info'), icon: Mail },
    { id: 'translations', label: t('admin.translations'), icon: Edit },
    { id: 'settings', label: t('admin.settings'), icon: Settings },
    { id: 'system', label: t('admin.system_health'), icon: RefreshCw },
  ];

  return (
    <nav className="space-y-1">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === item.id ? 'bg-[#FFB300] text-[#0A192F]' : 'text-[#8892B0] hover:bg-[#112240] hover:text-[#E6F1FF]'
          }`}
        >
          <div className="flex items-center">
            <item.icon className="mr-3 flex-shrink-0 h-5 w-5" />
            {item.label}
          </div>
          {item.badge !== undefined && item.badge > 0 && (
            <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold shadow-sm ${activeTab === item.id ? 'bg-[#0A192F] text-[#FFB300]' : 'bg-[#FFB300] text-[#0A192F]'}`}>
              {item.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { user, userRole, isAuthReady } = useStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Basic protection
  if (isAuthReady && (!user || userRole !== 'admin')) {
    return <Navigate to="/" replace />;
  }

  if (!isAuthReady) {
    return <div className="p-8 text-center text-[#8892B0]">{t('admin.loading')}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-[#E6F1FF] mb-8">{t('admin.title')}</h1>
      
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0">
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
        {/* Content Area */}
        <div className="flex-1 min-w-0 bg-[#112240] rounded-xl shadow-sm border border-white/5 p-6 min-h-[600px]">
          {activeTab === 'dashboard' && <DashboardOverview />}
          {activeTab === 'products' && <ProductsManager />}
          {activeTab === 'categories' && <CategoriesManager />}
          {activeTab === 'regions' && <RegionsManager />}
          {activeTab === 'messages' && <MessagesManager />}
          {activeTab === 'tasks' && <TasksManager />}
          {activeTab === 'qualifications' && <QualificationsManager />}
          {activeTab === 'translations' && <TranslationsManager />}
          {activeTab === 'hero-stylist' && <HeroHeadlineStylist />}
          {activeTab === 'contacts' && <ContactsManager />}
          {activeTab === 'certificates' && <CertificatesManager />}
          {activeTab === 'brand-logos' && <BrandLogosManager />}
          {activeTab === 'blog' && <BlogManager />}
          {activeTab === 'settings' && <SettingsManager />}
          {activeTab === 'health' && <SystemHealthManager />}
        </div>
      </div>
    </div>
  );
}

function CertificatesManager() {
  const { t } = useTranslation();
  const { siteSettings, setSiteSettings } = useStore();
  const [certificates, setCertificates] = useState<any[]>(siteSettings?.certificates || []);
  const [isAdding, setIsAdding] = useState(false);
  const [newCert, setNewCert] = useState({ title: '', imageUrl: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (siteSettings?.certificates) {
      setCertificates(siteSettings.certificates);
    }
  }, [siteSettings]);

  const handleSave = async (updatedCerts: any[]) => {
    setIsSaving(true);
    try {
      const newSettings = { ...siteSettings, certificates: updatedCerts };
      await setDoc(doc(db, 'settings', 'global'), { certificates: updatedCerts }, { merge: true });
      setSiteSettings(newSettings);
    } catch (error) {
      console.error("Error saving certificates:", error);
      alert(t('admin.save_failed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = () => {
    if (!newCert.title || !newCert.imageUrl) {
      alert(t('admin.fill_all_fields'));
      return;
    }
    const updated = [...certificates, { id: Date.now().toString(), ...newCert }];
    setCertificates(updated);
    handleSave(updated);
    setNewCert({ title: '', imageUrl: '' });
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm(t('admin.confirm_delete'))) {
      const updated = certificates.filter(c => c.id !== id);
      setCertificates(updated);
      handleSave(updated);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadFile(file, 'certificates');
      setNewCert({ ...newCert, imageUrl: url });
    } catch (error: any) {
      alert(`${t('admin.upload_failed')}: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-[#E6F1FF]">{t('admin.certificates_management', 'Display Certificates')}</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center px-4 py-2 bg-[#FFB300] text-[#0A192F] rounded-md hover:bg-[#FFCA28] text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" /> {t('admin.add_certificate', 'Add Certificate')}
        </button>
      </div>

      {isAdding && (
        <div className="bg-[#0A192F] p-6 rounded-lg border border-white/5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.cert_title', 'Certificate Title')}</label>
              <input 
                type="text" 
                value={newCert.title} 
                onChange={e => setNewCert({...newCert, title: e.target.value})} 
                placeholder="ISO 9001"
                className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.cert_icon', 'Certification Icon (Image)')}</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newCert.imageUrl} 
                  onChange={e => setNewCert({...newCert, imageUrl: e.target.value})} 
                  placeholder="URL or Upload"
                  className="flex-1 px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" 
                />
                <label className="cursor-pointer px-3 py-2 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] transition-colors flex items-center shrink-0">
                  <Plus className="w-4 h-4 mr-1" />
                  <span className="text-xs">{t('admin.upload')}</span>
                  <input type="file" className="sr-only" accept="image/*" onChange={handleFileUpload} />
                </label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-[#8892B0]">{t('admin.cancel')}</button>
            <button onClick={handleAdd} className="px-4 py-2 bg-[#FFB300] text-[#0A192F] rounded-md font-bold">{t('admin.add')}</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {certificates.map(cert => (
          <div key={cert.id} className="relative group bg-[#0A192F] p-4 rounded-lg border border-white/5 flex flex-col items-center">
            {cert.imageUrl ? (
              <img src={cert.imageUrl} alt={cert.title} className="w-12 h-12 object-contain mb-2" />
            ) : (
              <ShieldCheck className="w-12 h-12 text-[#FFB300] mb-2" />
            )}
            <span className="text-xs text-[#E6F1FF] text-center font-medium">{cert.title}</span>
            <button 
              onClick={() => handleDelete(cert.id)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      
      {certificates.length === 0 && (
        <div className="text-center py-12 text-[#8892B0] border-2 border-dashed border-white/5 rounded-xl">
          {t('admin.no_certificates', 'No display certificates found')}
        </div>
      )}

      {isSaving && (
        <div className="fixed bottom-8 right-8 bg-[#FFB300] text-[#0A192F] px-4 py-2 rounded-full shadow-2xl flex items-center animate-bounce">
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          {t('admin.saving')}
        </div>
      )}
    </div>
  );
}

function BlogManager() {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPost, setNewPost] = useState({
    title: '', slug: '', excerpt: '', content: '', coverImage: '', category: '', readTime: '', author: 'Vida Auto', tags: ''
  });

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'blogPosts'), orderBy('publishedAt', 'desc')));
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'blogPosts');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title) return;
    try {
      const slug = newPost.slug || newPost.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const data = {
        title: newPost.title,
        slug,
        excerpt: newPost.excerpt,
        content: newPost.content,
        coverImage: newPost.coverImage,
        category: newPost.category,
        readTime: newPost.readTime,
        author: newPost.author,
        tags: newPost.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
        updatedAt: new Date().toISOString(),
      };
      if (editingId) {
        await setDoc(doc(db, 'blogPosts', editingId), data, { merge: true });
      } else {
        await addDoc(collection(db, 'blogPosts'), { ...data, publishedAt: new Date().toISOString() });
      }
      setIsAdding(false);
      setEditingId(null);
      setNewPost({ title: '', slug: '', excerpt: '', content: '', coverImage: '', category: '', readTime: '', author: 'Vida Auto', tags: '' });
      fetchPosts();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'blogPosts');
    }
  };

  const handleEdit = (post: any) => {
    setEditingId(post.id);
    setNewPost({
      title: post.title || '',
      slug: post.slug || '',
      excerpt: post.excerpt || '',
      content: post.content || '',
      coverImage: post.coverImage || '',
      category: post.category || '',
      readTime: post.readTime || '',
      author: post.author || 'Vida Auto',
      tags: (post.tags || []).join(', '),
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this blog post?')) {
      try {
        await deleteDoc(doc(db, 'blogPosts', id));
        fetchPosts();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'blogPosts');
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#E6F1FF]">{t('admin.blog', 'Blog Management')}</h2>
        <button onClick={() => { setIsAdding(true); setEditingId(null); setNewPost({ title: '', slug: '', excerpt: '', content: '', coverImage: '', category: '', readTime: '', author: 'Vida Auto', tags: '' }); }} className="flex items-center px-4 py-2 bg-[#FFB300] text-[#0A192F] rounded-md hover:bg-[#FFCA28] text-sm font-medium transition-colors">
          <Plus className="w-4 h-4 mr-1" />{t('admin.add_post', 'Add Post')}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSave} className="bg-[#0A192F] rounded-lg p-4 mb-6 border border-white/10 space-y-3">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-md font-semibold text-[#E6F1FF]">{editingId ? t('admin.edit_post', 'Edit Post') : t('admin.add_post', 'New Post')}</h3>
            <button type="button" onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-[#8892B0] hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.title', 'Title')} *</label>
              <input type="text" value={newPost.title} onChange={e => setNewPost({...newPost, title: e.target.value})} required className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">Slug (auto-generated if empty)</label>
              <input type="text" value={newPost.slug} onChange={e => setNewPost({...newPost, slug: e.target.value})} placeholder="how-to-choose-brake-pads" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">Category</label>
              <input type="text" value={newPost.category} onChange={e => setNewPost({...newPost, category: e.target.value})} placeholder="How-to / Industry / News" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">Read Time</label>
              <input type="text" value={newPost.readTime} onChange={e => setNewPost({...newPost, readTime: e.target.value})} placeholder="5 min" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#8892B0] mb-1">Cover Image URL</label>
              <input type="text" value={newPost.coverImage} onChange={e => setNewPost({...newPost, coverImage: e.target.value})} placeholder="https://..." className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#8892B0] mb-1">Excerpt (short summary)</label>
              <textarea value={newPost.excerpt} onChange={e => setNewPost({...newPost, excerpt: e.target.value})} rows={2} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#8892B0] mb-1">Content (HTML)</label>
              <textarea value={newPost.content} onChange={e => setNewPost({...newPost, content: e.target.value})} rows={10} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">Tags (comma-separated)</label>
              <input type="text" value={newPost.tags} onChange={e => setNewPost({...newPost, tags: e.target.value})} placeholder="headlight, how-to, guide" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">Author</label>
              <input type="text" value={newPost.author} onChange={e => setNewPost({...newPost, author: e.target.value})} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
            </div>
          </div>
          <button type="submit" className="mt-3 px-6 py-2 bg-[#FFB300] text-[#0A192F] rounded-md font-medium hover:bg-[#FFCA28] transition-colors">
            {editingId ? t('admin.save_changes', 'Save Changes') : t('admin.publish', 'Publish')}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-[#8892B0]">{t('common.loading', 'Loading...')}</p>
      ) : posts.length === 0 ? (
        <p className="text-[#8892B0] text-center py-8">No blog posts yet.</p>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <div key={post.id} className="bg-[#0A192F] rounded-lg border border-white/10 p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[#E6F1FF] truncate">{post.title}</h3>
                <div className="text-xs text-[#8892B0] mt-1 flex gap-3">
                  {post.category && <span className="text-[#FFB300]">{post.category}</span>}
                  <span>{post.publishedAt?.split('T')[0]}</span>
                  <span>/blog/{post.slug || post.id}</span>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button onClick={() => handleEdit(post)} className="p-1.5 text-[#8892B0] hover:text-[#FFB300] transition-colors"><Edit className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(post.id)} className="p-1.5 text-[#8892B0] hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BrandLogosManager() {
  const { t } = useTranslation();
  const { siteSettings, setSiteSettings } = useStore();
  const [logos, setLogos] = useState<any[]>(siteSettings?.brandLogos || []);
  const [categories, setCategories] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newLogo, setNewLogo] = useState({ imageUrl: '', categoryId: '', label: '' });

  useEffect(() => {
    if (siteSettings?.brandLogos) setLogos(siteSettings.brandLogos);
  }, [siteSettings]);

  useEffect(() => {
    const fetchCategories = async () => {
      const snap = await getDocs(query(collection(db, 'categories'), orderBy('order', 'asc')));
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchCategories();
  }, []);

  const handleSave = async (updated: any[]) => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), { brandLogos: updated }, { merge: true });
      setSiteSettings({ ...siteSettings, brandLogos: updated });
    } catch (error) {
      console.error('Error saving brand logos:', error);
      alert(t('admin.save_failed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = () => {
    if (!newLogo.imageUrl || !newLogo.label) {
      alert(t('admin.fill_all_fields'));
      return;
    }
    if (logos.length >= 5) {
      alert(t('admin.brand_logos_max', 'Maximum 5 brand logos allowed'));
      return;
    }
    const updated = [...logos, { ...newLogo }];
    setLogos(updated);
    handleSave(updated);
    setNewLogo({ imageUrl: '', categoryId: '', label: '' });
    setIsAdding(false);
  };

  const handleDelete = (index: number) => {
    if (window.confirm(t('admin.confirm_delete'))) {
      const updated = logos.filter((_, i) => i !== index);
      setLogos(updated);
      handleSave(updated);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadFile(file, 'brand-logos');
      setNewLogo({ ...newLogo, imageUrl: url });
    } catch (error: any) {
      alert(`${t('admin.upload_failed')}: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-[#E6F1FF]">{t('admin.brand_logos', 'Brand Logos')}</h2>
          <p className="text-sm text-[#8892B0] mt-1">{t('admin.brand_logos_desc', 'Up to 5 brand logos displayed on the homepage. Click to navigate to products.')}</p>
        </div>
        {logos.length < 5 && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center px-4 py-2 bg-[#FFB300] text-[#0A192F] rounded-md hover:bg-[#FFCA28] text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" /> {t('admin.add_brand', 'Add Brand')}
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-[#0A192F] p-4 rounded-lg border border-white/5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.brand_label', 'Brand Name')} *</label>
              <input
                type="text"
                value={newLogo.label}
                onChange={e => setNewLogo({ ...newLogo, label: e.target.value })}
                placeholder="e.g. Audi"
                className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.brand_category', 'Link to Category')}</label>
              <select
                value={newLogo.categoryId}
                onChange={e => setNewLogo({ ...newLogo, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50"
              >
                <option value="">{t('admin.no_link', 'No link (show all)')}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.brand_image', 'Logo Image')} *</label>
            {newLogo.imageUrl ? (
              <div className="flex items-center gap-3">
                <img src={newLogo.imageUrl} alt="Preview" className="w-16 h-16 object-contain bg-white rounded p-1" />
                <button type="button" onClick={() => setNewLogo({ ...newLogo, imageUrl: '' })} className="text-red-400 text-sm hover:underline">{t('admin.remove', 'Remove')}</button>
              </div>
            ) : (
              <label className="cursor-pointer inline-flex items-center px-3 py-2 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] transition-colors text-sm">
                <Plus className="w-4 h-4 mr-1" /> {t('admin.upload_image')}
                <input type="file" className="sr-only" accept="image/*" onChange={handleImageUpload} />
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-4 py-2 bg-[#FFB300] text-[#0A192F] rounded-md text-sm font-medium hover:bg-[#FFCA28]">{t('admin.save', 'Save')}</button>
            <button onClick={() => { setIsAdding(false); setNewLogo({ imageUrl: '', categoryId: '', label: '' }); }} className="px-4 py-2 bg-white/5 text-[#8892B0] rounded-md text-sm hover:bg-white/10">{t('admin.cancel', 'Cancel')}</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {logos.map((logo, index) => (
          <div key={index} className="relative group bg-[#0A192F] p-4 rounded-lg border border-white/5 flex flex-col items-center text-center">
            {logo.imageUrl ? (
              <img src={logo.imageUrl} alt={logo.label} className="w-16 h-16 object-contain mb-2" />
            ) : (
              <div className="w-16 h-16 bg-white/5 rounded flex items-center justify-center mb-2 text-[#8892B0]">?</div>
            )}
            <p className="text-sm font-medium text-[#E6F1FF] truncate w-full">{logo.label}</p>
            {logo.categoryId && (
              <p className="text-xs text-[#8892B0] mt-0.5">{categories.find(c => c.id === logo.categoryId)?.name || ''}</p>
            )}
            <button
              onClick={() => handleDelete(index)}
              className="absolute top-2 right-2 bg-red-500/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {logos.length === 0 && (
        <div className="text-center py-12 text-[#8892B0] border-2 border-dashed border-white/5 rounded-xl">
          {t('admin.no_brand_logos', 'No brand logos added yet')}
        </div>
      )}

      {isSaving && (
        <div className="fixed bottom-8 right-8 bg-[#FFB300] text-[#0A192F] px-4 py-2 rounded-full shadow-2xl flex items-center animate-bounce">
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          {t('admin.saving')}
        </div>
      )}
    </div>
  );
}

function HeroHeadlineStylist() {
  const { t, i18n } = useTranslation();
  const { siteSettings, setSiteSettings } = useStore();
  const [isSaving, setIsSaving] = useState(false);
  const [translations, setTranslations] = useState<any[]>([]);

  useEffect(() => {
    const q = collection(db, 'translations');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTranslations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'translations_stylist');
    });
    return () => unsubscribe();
  }, []);

  const headlineKeys = [
    { key: 'hero.partners', label: 'Headline 1 (Left)' },
    { key: 'hero.oem', label: 'Headline 2 (Center)' },
    { key: 'hero.global', label: 'Headline 3 (Right)' },
    { key: 'hero.partners_desc', label: 'Desc 1 (Left)' },
    { key: 'hero.support', label: 'Desc 2 (Center)' },
    { key: 'hero.delivery', label: 'Desc 3 (Right)' },
    { key: 'hero.benefit1_title', label: 'Benefit 1 Title' },
    { key: 'hero.benefit2_title', label: 'Benefit 2 Title' },
    { key: 'hero.benefit3_title', label: 'Benefit 3 Title' },
    { key: 'hero.benefit4_title', label: 'Benefit 4 Title' },
  ];

  const presets = [
    { name: 'Standard Gold', classes: 'text-[#FFB300] font-extrabold' },
    { name: 'Cyber Neon', classes: 'text-[#00F3FF] font-black tracking-tighter drop-shadow-[0_0_8px_rgba(0,243,255,0.8)]' },
    { name: 'Modern Silver', classes: 'text-[#E6F1FF] font-medium tracking-widest' },
    { name: 'Industrial Red', classes: 'text-[#FF4D4D] font-black uppercase' },
    { name: 'Soft Gray', classes: 'text-[#8892B0] font-normal' },
    { name: 'Gradient Sunset', classes: 'bg-gradient-to-r from-[#FFB300] via-[#FF4D4D] to-purple-500 bg-clip-text text-transparent font-extrabold' },
    { name: 'Elite Luxury', classes: 'text-[#FFB300] font-serif italic font-light tracking-[0.2em] uppercase underline underline-offset-8 decoration-white/20' },
    { name: 'Brutalist Tech', classes: 'text-white font-mono font-black uppercase italic bg-[#FFB300] px-4 py-2 text-[#0A192F]' },
    { name: 'Clean Corporate', classes: 'text-[#E6F1FF] font-sans font-light tracking-tight border-l-4 border-[#FFB300] pl-6' },
    { name: 'Glossy Carbon', classes: 'text-[#E6F1FF] font-black drop-shadow-[2px_2px_0px_#FFB300] uppercase italic' },
    { name: 'Golden Outline', classes: 'font-black text-transparent stroke-[#FFB300] stroke-1 [text-stroke:1px_#FFB300] uppercase tracking-tighter' },
    { name: 'Future Minimal', classes: 'text-[#FFB300] font-light tracking-[0.5em] uppercase text-center opacity-80' }
  ];

  const sizeOptions = [
    { name: 'xs', classes: 'text-xs' },
    { name: 'sm', classes: 'text-sm' },
    { name: 'base', classes: 'text-base' },
    { name: 'lg', classes: 'text-lg' },
    { name: 'xl', classes: 'text-xl' },
    { name: '2xl', classes: 'text-2xl' },
    { name: '3xl', classes: 'text-3xl' },
    { name: '4xl', classes: 'text-4xl' },
    { name: '5xl', classes: 'text-5xl' },
    { name: '6xl', classes: 'text-6xl' },
    { name: '7xl', classes: 'text-7xl' },
  ];

  const currentStyles = siteSettings?.heroStyles || {};

  const handleUpdateText = async (key: string, lang: 'zh' | 'en', value: string) => {
    const existing = translations.find(t => t.key === key);
    if (existing) {
      await setDoc(doc(db, 'translations', existing.id), { ...existing, [lang]: value });
    } else {
      await addDoc(collection(db, 'translations'), { key, zh: lang === 'zh' ? value : '', en: lang === 'en' ? value : '' });
    }
  };

  const updateStyle = async (key: string, field: string, value: string) => {
    const updatedStyles = {
      ...currentStyles,
      [key]: {
        ...(currentStyles[key] || {}),
        [field]: value
      }
    };
    
    setIsSaving(true);
    try {
      const newSettings = { ...siteSettings, heroStyles: updatedStyles };
      await setDoc(doc(db, 'settings', 'global'), { heroStyles: updatedStyles }, { merge: true });
      setSiteSettings(newSettings);
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-[#E6F1FF]">Hero Headline Stylist</h2>
        {isSaving && <span className="text-xs text-[#FFB300] animate-pulse">Saving style changes...</span>}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {headlineKeys.map(item => {
          const style = currentStyles[item.key] || {};
          const trans = translations.find(t => t.key === item.key);
          const zhVal = trans?.zh || i18n.t(item.key, { lng: 'zh' });
          const enVal = trans?.en || i18n.t(item.key, { lng: 'en' });

          return (
            <div key={item.key} className="bg-[#0A192F] p-6 rounded-xl border border-white/5 space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-sm font-bold text-[#FFB300] uppercase tracking-wider">{item.label}</span>
                <span className="text-[10px] text-[#8892B0] font-mono">{item.key}</span>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* TEXT EDITING */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-[#8892B0] mb-1 font-bold uppercase">Chinese Content</label>
                    <input 
                      type="text" 
                      defaultValue={zhVal}
                      onBlur={e => handleUpdateText(item.key, 'zh', e.target.value)}
                      className="w-full bg-[#112240] border border-white/10 text-white text-sm p-2 rounded-md outline-none focus:border-[#FFB300]/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8892B0] mb-1 font-bold uppercase">English Content</label>
                    <input 
                      type="text" 
                      defaultValue={enVal}
                      onBlur={e => handleUpdateText(item.key, 'en', e.target.value)}
                      className="w-full bg-[#112240] border border-white/10 text-white text-sm p-2 rounded-md outline-none focus:border-[#FFB300]/50 italic"
                    />
                  </div>
                </div>

                {/* STYLING CONTROLS */}
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div>
                    <label className="block text-[10px] text-[#8892B0] mb-1 uppercase font-bold text-center">Template</label>
                    <select 
                      value={style.presetClasses || ''} 
                      onChange={e => updateStyle(item.key, 'presetClasses', e.target.value)}
                      className="w-full bg-[#112240] border border-white/10 text-white text-xs p-2 rounded-md outline-none focus:border-[#FFB300]/50"
                    >
                      <option value="">Default</option>
                      {presets.map(p => (
                        <option key={p.name} value={p.classes}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8892B0] mb-1 uppercase font-bold text-center">Size</label>
                    <select 
                      value={style.sizeClasses || ''} 
                      onChange={e => updateStyle(item.key, 'sizeClasses', e.target.value)}
                      className="w-full bg-[#112240] border border-white/10 text-white text-xs p-2 rounded-md outline-none focus:border-[#FFB300]/50"
                    >
                      <option value="">Auto</option>
                      {sizeOptions.map(s => (
                        <option key={s.name} value={s.classes}>{s.name.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] text-[#8892B0] mb-1 uppercase font-bold">Custom Tailwind (Advanced)</label>
                    <input 
                      type="text" 
                      value={style.customClasses || ''} 
                      onChange={e => updateStyle(item.key, 'customClasses', e.target.value)}
                      placeholder="e.g. underline decoration-[#FFB300]"
                      className="w-full bg-[#112240] border border-white/10 text-white text-[10px] p-2 rounded-md outline-none focus:border-[#FFB300]/50"
                    />
                  </div>
                </div>
              </div>

              {/* LIVE PREVIEW AREA */}
              <div className="mt-4 p-6 bg-black/30 rounded-xl border border-white/5 flex flex-col items-center justify-center min-h-[140px] relative overflow-hidden group/preview">
                <div className="absolute top-2 left-2 text-[8px] text-[#8892B0] uppercase tracking-widest opacity-50">Desktop Preview Canvas</div>
                <div className={`${style.presetClasses || ''} ${style.sizeClasses || ''} ${style.customClasses || ''} transition-all duration-500 text-center scale-90 group-hover/preview:scale-100`}>
                  {t(item.key)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContactsManager() {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    type: 'address', 
    label_zh: '', 
    label_en: '', 
    value_zh: '', 
    value_en: '',
    icon: 'MapPin',
    order: 0
  });

  const icons = [
    { name: 'MapPin', icon: MapPin },
    { name: 'Phone', icon: Phone },
    { name: 'Mail', icon: Mail },
    { name: 'MessageSquare', icon: MessageSquare },
    { name: 'Activity', icon: Activity },
    { name: 'ShieldCheck', icon: ShieldCheck }
  ];

  const types = [
    { value: 'address', label: 'Address' },
    { value: 'phone', label: 'Phone' },
    { value: 'email', label: 'Email' },
    { value: 'hours', label: 'Business Hours' },
    { value: 'other', label: 'Other' }
  ];

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'contacts'), orderBy('order'));
      const snapshot = await getDocs(q);
      setContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await setDoc(doc(db, 'contacts', editingId), formData, { merge: true });
      } else {
        await addDoc(collection(db, 'contacts'), { ...formData, createdAt: new Date().toISOString() });
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData({ type: 'address', label_zh: '', label_en: '', value_zh: '', value_en: '', icon: 'MapPin', order: 0 });
      fetchContacts();
    } catch (error) {
      alert("Save failed");
    }
  };

  const handleEdit = (contact: any) => {
    setEditingId(contact.id);
    setFormData({
      type: contact.type || 'other',
      label_zh: contact.label_zh || '',
      label_en: contact.label_en || '',
      value_zh: contact.value_zh || '',
      value_en: contact.value_en || '',
      icon: contact.icon || 'MapPin',
      order: contact.order || 0
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Confirm delete this contact info?")) {
      await deleteDoc(doc(db, 'contacts', id));
      fetchContacts();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-[#E6F1FF]">{t('admin.contacts_management', 'Contact Information Management')}</h2>
        <button 
          onClick={() => { setIsAdding(true); setEditingId(null); setFormData({ type: 'address', label_zh: '', label_en: '', value_zh: '', value_en: '', icon: 'MapPin', order: 0 }); }}
          className="flex items-center px-4 py-2 bg-[#FFB300] text-[#0A192F] rounded-md hover:bg-[#FFCA28] text-sm font-medium"
        >
          <Plus className="w-4 h-4 mr-2" /> {t('admin.add_contact', 'Add Contact Point')}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-[#0A192F] p-6 rounded-lg border border-[#FFB300]/20 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[#8892B0] mb-1 font-bold">{t('admin.type', 'Type')}</label>
              <select 
                value={formData.type} 
                onChange={e => setFormData({...formData, type: e.target.value})}
                className="w-full bg-[#112240] border border-white/10 text-white p-2 rounded-md"
              >
                {types.map(t_item => <option key={t_item.value} value={t_item.value}>{t_item.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#8892B0] mb-1 font-bold">{t('admin.icon', 'Icon')}</label>
              <select 
                value={formData.icon} 
                onChange={e => setFormData({...formData, icon: e.target.value})}
                className="w-full bg-[#112240] border border-white/10 text-white p-2 rounded-md"
              >
                {icons.map(i => <option key={i.name} value={i.name}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#8892B0] mb-1 font-bold">{t('admin.display_order')}</label>
              <input 
                type="number" 
                value={formData.order} 
                onChange={e => setFormData({...formData, order: parseInt(e.target.value)})}
                className="w-full bg-[#112240] border border-white/10 text-white p-2 rounded-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-[10px] text-[#FFB300] uppercase font-bold tracking-widest border-b border-white/5 pb-1">{t('admin.zh_content')}</h4>
              <div>
                <label className="block text-[10px] text-[#8892B0] mb-1">{t('admin.label', 'Label')} (e.g. 总部)</label>
                <input 
                  type="text" 
                  value={formData.label_zh} 
                  onChange={e => setFormData({...formData, label_zh: e.target.value})}
                  className="w-full bg-[#112240] border border-white/10 text-white p-2 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#8892B0] mb-1">{t('admin.value', 'Value')}</label>
                <input 
                  type="text" 
                  value={formData.value_zh} 
                  onChange={e => setFormData({...formData, value_zh: e.target.value})}
                  className="w-full bg-[#112240] border border-white/10 text-white p-2 rounded-md"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] text-[#8892B0] uppercase font-bold tracking-widest border-b border-white/5 pb-1">{t('admin.en_content')}</h4>
              <div>
                <label className="block text-[10px] text-[#8892B0] mb-1">{t('admin.label')} (e.g. HQ)</label>
                <input 
                  type="text" 
                  value={formData.label_en} 
                  onChange={e => setFormData({...formData, label_en: e.target.value})}
                  className="w-full bg-[#112240] border border-white/10 text-white p-2 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#8892B0] mb-1">{t('admin.value')}</label>
                <input 
                  type="text" 
                  value={formData.value_en} 
                  onChange={e => setFormData({...formData, value_en: e.target.value})}
                  className="w-full bg-[#112240] border border-white/10 text-white p-2 rounded-md"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-[#8892B0]">{t('admin.cancel')}</button>
            <button type="submit" className="px-6 py-2 bg-[#FFB300] text-[#0A192F] rounded-md font-bold">{t('admin.save_contact', 'Save Contact Info')}</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4">
        {contacts.map(c => {
          const IconComponent = (icons.find(i => i.name === c.icon)?.icon) || Mail;
          return (
            <div key={c.id} className="flex items-center justify-between p-4 bg-[#0A192F] rounded-xl border border-white/5 group hover:border-[#FFB300]/20 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#112240] rounded-lg flex items-center justify-center text-[#FFB300]">
                  <IconComponent className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-[#8892B0] font-bold uppercase tracking-tighter">
                    {c.type} {c.label_zh && `• ${c.label_zh}`}
                  </div>
                  <div className="text-[#E6F1FF] font-medium">{c.value_zh}</div>
                  <div className="text-[#8892B0] text-xs italic">{c.value_en}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(c)} className="p-2 text-[#FFB300] hover:bg-[#FFB300]/10 rounded-md transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-md transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {contacts.length === 0 && !loading && (
          <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-xl text-[#8892B0]">
            {t('admin.no_contacts', 'No contact points configured. Global settings will be used in Footer.')}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardOverview() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({ users: 0, products: 0, messages: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersSnap, productsSnap, messagesSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'messages'))
        ]);
        setStats({
          users: usersSnap.size,
          products: productsSnap.size,
          messages: messagesSnap.size
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'dashboard_stats');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="text-[#8892B0]">{t('admin.loading_stats')}</div>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <div className="bg-[#0A192F] p-6 rounded-xl border border-white/5">
        <div className="text-[#8892B0] text-sm uppercase tracking-wider mb-2">{t('admin.total_users')}</div>
        <div className="text-3xl font-bold text-[#FFB300]">{stats.users}</div>
      </div>
      <div className="bg-[#0A192F] p-6 rounded-xl border border-white/5">
        <div className="text-[#8892B0] text-sm uppercase tracking-wider mb-2">{t('admin.total_products')}</div>
        <div className="text-3xl font-bold text-[#FFB300]">{stats.products}</div>
      </div>
      <div className="bg-[#0A192F] p-6 rounded-xl border border-white/5">
        <div className="text-[#8892B0] text-sm uppercase tracking-wider mb-2">{t('admin.unread_messages')}</div>
        <div className="text-3xl font-bold text-[#FFB300]">{stats.messages}</div>
      </div>
    </div>
  );
}

function CategoriesManager() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({ name: '', description: '', order: '0', catalogUrl: '' });

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const q = collection(db, 'categories');
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by order
      data.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      setCategories(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        name: newCategory.name,
        description: newCategory.description,
        order: parseInt(newCategory.order),
        catalogUrl: newCategory.catalogUrl,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await setDoc(doc(db, 'categories', editingId), data, { merge: true });
        // Sync categoryName on all products that belong to this category
        const productsSnap = await getDocs(query(collection(db, 'products'), where('categoryId', '==', editingId)));
        if (!productsSnap.empty) {
          const batch = writeBatch(db);
          productsSnap.docs.forEach(d => {
            batch.update(d.ref, { categoryName: newCategory.name });
          });
          await batch.commit();
        }
      } else {
        await addDoc(collection(db, 'categories'), {
          ...data,
          createdAt: new Date().toISOString()
        });
      }

      setIsAdding(false);
      setEditingId(null);
      setNewCategory({ name: '', description: '', order: '0', catalogUrl: '' });
      fetchCategories();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'categories');
    }
  };

  const handleEdit = (category: any) => {
    setEditingId(category.id);
    setNewCategory({
      name: category.name || '',
      description: category.description || '',
      order: (category.order || 0).toString(),
      catalogUrl: category.catalogUrl || ''
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(t('admin.confirm_delete_category', { name }))) {
      try {
        await deleteDoc(doc(db, 'categories', id));
        fetchCategories();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'categories');
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#E6F1FF]">{t('admin.categories_management', 'Categories Management')}</h2>
        <button 
          onClick={() => { setIsAdding(true); setEditingId(null); setNewCategory({ name: '', description: '', order: '0', catalogUrl: '' }); }}
          className="flex items-center px-4 py-2 bg-[#FFB300] text-[#0A192F] rounded-md hover:bg-[#FFCA28] text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" /> {t('admin.add_category', 'Add Category')}
        </button>
      </div>

      {isAdding && (
        <div className="mb-8 bg-[#0A192F] p-6 rounded-lg border border-white/5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[#E6F1FF]">{editingId ? t('admin.edit_category', 'Edit Category') : t('admin.add_new_category', 'Add New Category')}</h3>
            <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-[#8892B0] hover:text-[#E6F1FF]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.category_name', 'Category Name')}</label>
                <input required type="text" value={newCategory.name} onChange={e => setNewCategory({...newCategory, name: e.target.value})} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.description', 'Description')}</label>
                <textarea value={newCategory.description} onChange={e => setNewCategory({...newCategory, description: e.target.value})} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 h-24" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.display_order', 'Display Order')}</label>
                <input type="number" value={newCategory.order} onChange={e => setNewCategory({...newCategory, order: e.target.value})} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.category_catalog', 'Category Catalog (PDF)')}</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FileDown className="h-4 w-4 text-[#8892B0]" />
                    </div>
                    <input type="text" value={newCategory.catalogUrl} onChange={e => setNewCategory({...newCategory, catalogUrl: e.target.value})} placeholder="https://example.com/category-catalog.pdf" className="w-full pl-10 pr-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 text-sm" />
                  </div>
                  <label className="cursor-pointer px-3 py-2 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] transition-colors flex items-center shrink-0">
                    <Plus className="w-4 h-4 mr-1" />
                    <span className="text-xs">{t('admin.select_file')}</span>
                    <input type="file" className="sr-only" accept="application/pdf" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const url = await uploadFile(file, 'category-catalogs');
                        setNewCategory({...newCategory, catalogUrl: url});
                      } catch (error: any) {
                        alert(`Upload failed: ${error?.message || ''}`);
                      }
                    }} />
                  </label>
                  {newCategory.catalogUrl && (
                    <button type="button" onClick={async () => { await deleteFileFromServer(newCategory.catalogUrl); setNewCategory({...newCategory, catalogUrl: ''}); }} className="px-3 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="px-4 py-2 bg-[#FFB300] text-[#0A192F] rounded-md hover:bg-[#FFCA28] text-sm font-medium">{t('admin.save_category', 'Save Category')}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p className="text-[#8892B0]">{t('admin.loading')}</p> : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-[#0A192F]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#8892B0] uppercase tracking-wider">{t('admin.category_name', 'Category Name')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#8892B0] uppercase tracking-wider">{t('admin.description', 'Description')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#8892B0] uppercase tracking-wider">{t('admin.order', 'Order')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#8892B0] uppercase tracking-wider">PDF</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[#8892B0] uppercase tracking-wider">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-[#112240] divide-y divide-white/5">
              {categories.map(category => (
                <tr key={category.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#E6F1FF]">{category.name}</td>
                  <td className="px-6 py-4 text-sm text-[#8892B0] max-w-xs truncate">{category.description || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#8892B0]">{category.order || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{category.catalogUrl ? <a href={category.catalogUrl} target="_blank" rel="noreferrer" className="text-[#FFB300] hover:underline text-xs">View</a> : <span className="text-[#8892B0] text-xs">—</span>}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                    <button onClick={() => handleEdit(category)} className="text-[#FFB300] hover:text-[#FFCA28]"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(category.id, category.name)} className="text-red-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-[#8892B0]">{t('admin.no_categories_found', 'No categories found')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProductsManager() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState({
    sku: '', name: '', categoryId: '', price: '', oemNumber: '', imageUrls: ['', '', '', ''], videoUrl: '', material: '', weight: '', compatibility: '', catalogUrl: ''
  });
  // YMM fitment multi-select state
  const [allVehicles, setAllVehicles] = useState<any[]>([]);
  const [selectedFitments, setSelectedFitments] = useState<any[]>([]);
  const [vehicleSearch, setVehicleSearch] = useState('');
  // Drag-and-drop reordering of product images
  const [dragImageIndex, setDragImageIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // Filters for products table
  const [filterText, setFilterText] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterMake, setFilterMake] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterYear, setFilterYear] = useState('');

  /** Move imageUrls[from] -> imageUrls[to], shifting intermediate items. */
  const moveImage = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setNewProduct(prev => {
      const arr = [...prev.imageUrls];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      // Always keep exactly 4 slots so the form grid stays stable
      while (arr.length < 4) arr.push('');
      return { ...prev, imageUrls: arr.slice(0, 4) };
    });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, categoriesRes, vehiclesRes] = await Promise.allSettled([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'vehicles'))
      ]);
      if (productsRes.status === 'fulfilled') {
        setProducts(productsRes.value.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else {
        handleFirestoreError(productsRes.reason, OperationType.LIST, 'products');
      }
      if (categoriesRes.status === 'fulfilled') {
        setCategories(categoriesRes.value.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else {
        handleFirestoreError(categoriesRes.reason, OperationType.LIST, 'categories');
      }
      if (vehiclesRes.status === 'fulfilled') {
        setAllVehicles(vehiclesRes.value.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } else {
        console.warn('Failed to load vehicles:', vehiclesRes.reason);
        setAllVehicles([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedCategory = categories.find(c => c.id === newProduct.categoryId);
      const productData = {
        sku: newProduct.sku || '',
        name: newProduct.name || '',
        categoryId: newProduct.categoryId || '',
        categoryName: selectedCategory?.name || '',
        price: parseFloat(newProduct.price) || 0,
        oemNumber: newProduct.oemNumber || '',
        techSpecs: {
          material: newProduct.material || '',
          weight: newProduct.weight || '',
          compatibility: newProduct.compatibility || ''
        },
        imageUrls: (newProduct.imageUrls || []).filter(url => url !== ''),
        videoUrl: newProduct.videoUrl || '',
        catalogUrl: newProduct.catalogUrl || '',
        fitments: selectedFitments.map(v => ({
          year: v.year ?? '',
          make: v.make ?? '',
          model: v.model ?? '',
          displayName: v.displayName ?? `${v.year ?? ''} ${v.make ?? ''} ${v.model ?? ''}`.trim()
        })),
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await setDoc(doc(db, 'products', editingId), productData, { merge: true });
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: new Date().toISOString()
        });
      }

      setIsAdding(false);
      setEditingId(null);
      setSelectedFitments([]);
      setVehicleSearch('');
      setNewProduct({ sku: '', name: '', categoryId: '', price: '', oemNumber: '', imageUrls: ['', '', '', ''], videoUrl: '', material: '', weight: '', compatibility: '', catalogUrl: '' });
      fetchData();
    } catch (error: any) {
      console.error("Error saving product:", error);
      alert(`${t('admin.save_failed')}: ${error.message}`);
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'products');
    }
  };

  const handleEditClick = (product: any) => {
    setEditingId(product.id);
    const imageUrls = [...(product.imageUrls || [])];
    while (imageUrls.length < 4) imageUrls.push('');
    
    setNewProduct({
      sku: product.sku || '',
      name: product.name || '',
      categoryId: product.categoryId || '',
      price: product.price?.toString() || '',
      oemNumber: product.oemNumber || '',
      imageUrls: imageUrls.slice(0, 4),
      videoUrl: product.videoUrl || '',
      catalogUrl: product.catalogUrl || '',
      material: product.techSpecs?.material || '',
      weight: product.techSpecs?.weight || '',
      compatibility: product.techSpecs?.compatibility || ''
    });
    setSelectedFitments(product.fitments || []);
    setVehicleSearch('');
    setIsAdding(true);
  };

  const handleSeedProducts = async () => {
    // Find or create category IDs for the seed data
    const getCategoryId = (name: string) => {
      const cat = categories.find(c => c.name === name);
      return cat?.id || 'default_category';
    };

    const sampleProducts = [
      {
        sku: 'LED-H4-001',
        name: 'LED Headlight H4 Series',
        categoryId: getCategoryId('Lighting System'),
        categoryName: 'Lighting System',
        price: 45.99,
        techSpecs: {
          material: 'Aviation Aluminum',
          weight: '0.5kg',
          compatibility: 'Universal H4'
        },
        imageUrls: ['https://picsum.photos/seed/ledh4/400/300'],
        createdAt: new Date().toISOString()
      },
      {
        sku: 'BRK-CER-002',
        name: 'Ceramic Brake Pads (Front)',
        categoryId: getCategoryId('Braking System'),
        categoryName: 'Braking System',
        price: 89.50,
        techSpecs: {
          material: 'Ceramic Composite',
          weight: '1.2kg',
          compatibility: 'Toyota Camry 2018-2023'
        },
        imageUrls: ['https://picsum.photos/seed/brake/400/300'],
        createdAt: new Date().toISOString()
      },
      {
        sku: 'FLT-OIL-003',
        name: 'High-Efficiency Oil Filter',
        categoryId: getCategoryId('Filters'),
        categoryName: 'Filters',
        price: 12.99,
        techSpecs: {
          material: 'Synthetic Fiber',
          weight: '0.3kg',
          compatibility: 'Honda Civic/Accord'
        },
        imageUrls: ['https://picsum.photos/seed/filter/400/300'],
        createdAt: new Date().toISOString()
      },
      {
        sku: 'EXT-MIR-004',
        name: 'Side Mirror Assembly (Left)',
        categoryId: getCategoryId('Exterior Parts'),
        categoryName: 'Exterior Parts',
        price: 120.00,
        techSpecs: {
          material: 'ABS Plastic + Glass',
          weight: '2.5kg',
          compatibility: 'BMW 3 Series G20'
        },
        imageUrls: ['https://picsum.photos/seed/mirror/400/300'],
        createdAt: new Date().toISOString()
      }
    ];

    try {
      // First ensure categories exist if we are using the 'default_category' fallback
      const categoryNames = ['Lighting System', 'Braking System', 'Filters', 'Exterior Parts'];
      for (const catName of categoryNames) {
        if (!categories.find(c => c.name === catName)) {
          await addDoc(collection(db, 'categories'), {
            name: catName,
            description: `Auto parts for ${catName}`,
            order: 0,
            createdAt: new Date().toISOString()
          });
        }
      }
      
      // Refresh categories to get the right IDs if we just added them
      const catsSnap = await getDocs(collection(db, 'categories'));
      const updatedCats = catsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      for (const p of sampleProducts) {
        // Re-find category ID from the freshly fetched list
        const cat = updatedCats.find((c: any) => c.name === p.categoryName);
        const finalProduct = {
          ...p,
          categoryId: cat?.id || 'unknown'
        };
        await addDoc(collection(db, 'products'), finalProduct);
      }
      alert(t('admin.seed_success'));
      fetchData();
    } catch (error: any) {
      console.error("Error seeding products:", error);
      alert(t('admin.seed_failed') + ": " + (error.message || "Unknown error"));
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm(t('admin.confirm_delete_product'))) {
      try {
        const product = products.find(p => p.id === id);
        // Handle plural imageUrls
        if (product?.imageUrls && Array.isArray(product.imageUrls)) {
          for (const url of product.imageUrls) {
            await deleteFileFromServer(url);
          }
        }
        // Handle legacy singular imageUrl
        if (product?.imageUrl) {
          await deleteFileFromServer(product.imageUrl);
        }
        
        await deleteDoc(doc(db, 'products', id));
        fetchData();
        alert(t('admin.delete_success', 'Deleted successfully'));
      } catch (error) {
        console.error("Error deleting product:", error);
        handleFirestoreError(error, OperationType.DELETE, 'products');
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      alert(`${t('admin.image_too_large')} (${(file.size / 1024 / 1024).toFixed(2)}MB). ${t('admin.content_too_large')}`);
      return;
    }
    try {
      const url = await uploadFile(file, 'products');
      const newUrls = [...newProduct.imageUrls];
      newUrls[index] = url;
      setNewProduct({ ...newProduct, imageUrls: newUrls });
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`${t('admin.upload_failed', 'Upload failed')}: ${error.message}`);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#E6F1FF]">{t('admin.products_management')}</h2>
        <div className="flex space-x-2">
          <button 
            onClick={handleSeedProducts}
            className="flex items-center px-4 py-2 bg-[#112240] text-[#FFB300] border border-[#FFB300]/20 rounded-md hover:bg-[#0A192F] text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" /> {t('admin.seed_products')}
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center px-4 py-2 bg-[#FFB300] text-[#0A192F] rounded-md hover:bg-[#FFCA28] text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" /> {t('admin.add_product')}
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="mb-8 bg-[#0A192F] p-6 rounded-lg border border-white/5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[#E6F1FF]">{editingId ? t('admin.edit_product') : t('admin.add_new_product')}</h3>
            <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-[#8892B0] hover:text-[#E6F1FF]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.sku')}</label>
                <input required type="text" value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.name')}</label>
                <input required type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.category')}</label>
                <select required value={newProduct.categoryId} onChange={e => setNewProduct({...newProduct, categoryId: e.target.value})} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50">
                  <option value="">{t('admin.select_category')}</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.price')}</label>
                <input required type="number" step="0.01" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.oem_number', 'OEM Number')}</label>
                <input type="text" value={newProduct.oemNumber} onChange={e => setNewProduct({...newProduct, oemNumber: e.target.value})} placeholder="e.g. 04465-33471" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.material')}</label>
                <input type="text" value={newProduct.material} onChange={e => setNewProduct({...newProduct, material: e.target.value})} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.weight')}</label>
                <input type="text" value={newProduct.weight} onChange={e => setNewProduct({...newProduct, weight: e.target.value})} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.compatibility')}</label>
                <input type="text" value={newProduct.compatibility} onChange={e => setNewProduct({...newProduct, compatibility: e.target.value})} placeholder="Legacy free-text, e.g. Toyota Camry 2018-2023" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
              </div>
              {/* YMM Vehicle Fitment Multi-select */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.vehicle_fitment', 'Vehicle Fitment (YMM)')}</label>
                {selectedFitments.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {selectedFitments.map((f: any, idx: number) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#FFB300]/10 text-[#FFB300] border border-[#FFB300]/30">
                        {f.displayName || `${f.year} ${f.make} ${f.model}`}
                        <button type="button" onClick={() => setSelectedFitments(prev => prev.filter((_, i) => i !== idx))} className="hover:text-red-400">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  placeholder={t('admin.search_vehicle', 'Type to search vehicles...')}
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 text-sm"
                />
                {vehicleSearch.length >= 2 && (
                  <div className="mt-1 max-h-40 overflow-y-auto border border-white/10 rounded-md bg-[#0A192F]">
                    {allVehicles
                      .filter(v => {
                        const dn = (v.displayName || '').toLowerCase();
                        return dn.includes(vehicleSearch.toLowerCase()) && !selectedFitments.some((s: any) => s.displayName === v.displayName);
                      })
                      .slice(0, 30)
                      .map((v: any) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => { setSelectedFitments(prev => [...prev, v]); setVehicleSearch(''); }}
                          className="w-full text-left px-3 py-1.5 text-sm text-white hover:bg-[#FFB300]/10 transition-colors"
                        >
                          {v.displayName}
                        </button>
                      ))
                    }
                    {allVehicles.filter(v => (v.displayName || '').toLowerCase().includes(vehicleSearch.toLowerCase())).length === 0 && (
                      <p className="px-3 py-2 text-xs text-[#8892B0]">{t('admin.no_vehicles_found', 'No vehicles found')}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.video_upload', 'Video Upload')} ({t('admin.video_hint', 'MP4')}, {t('admin.video_size_hint', 'Max 15MB')})</label>
                <div className="mt-2">
                  {newProduct.videoUrl ? (
                    <div className="flex items-center space-x-4 p-4 bg-[#112240]/50 border-2 border-white/10 rounded-lg">
                      <div className="w-32 h-20 bg-black rounded overflow-hidden flex items-center justify-center">
                        <Video className="w-8 h-8 text-[#FFB300]" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-xs text-[#8892B0] truncate">{newProduct.videoUrl}</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={async () => {
                          if (window.confirm(t('admin.confirm_delete'))) {
                            await deleteFileFromServer(newProduct.videoUrl);
                            setNewProduct({ ...newProduct, videoUrl: '' });
                          }
                        }}
                        className="text-red-500 hover:text-red-400 p-2"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex items-center justify-center space-x-3 p-4 bg-[#112240]/50 border-2 border-dashed border-white/10 rounded-lg hover:border-[#FFB300]/50 transition-all">
                      <Video className="w-6 h-6 text-[#8892B0]" />
                      <span className="text-sm text-[#8892B0]">{t('admin.upload_video', 'Upload MP4 Video')}</span>
                      <input 
                        type="file" 
                        className="sr-only" 
                        accept="video/mp4"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > MAX_UPLOAD_BYTES) {
                              alert(t('admin.file_too_large'));
                              return;
                            }
                            try {
                              const url = await uploadFile(file, 'product-videos');
                              setNewProduct({ ...newProduct, videoUrl: url });
                            } catch (error: any) {
                              alert(`${t('admin.upload_failed')}: ${error?.message || ''}`);
                            }
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.product_catalog_file', 'Product Catalog/Manual (PDF)')}</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FileDown className="h-4 w-4 text-[#8892B0]" />
                    </div>
                    <input 
                      type="text" 
                      value={newProduct.catalogUrl} 
                      onChange={e => setNewProduct({...newProduct, catalogUrl: e.target.value})} 
                      placeholder="https://example.com/manual.pdf"
                      className="w-full pl-10 pr-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 text-sm" 
                    />
                  </div>
                  <label className="cursor-pointer px-3 py-2 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] transition-colors flex items-center shrink-0">
                    <Plus className="w-4 h-4 mr-1" />
                    <span className="text-xs">{t('admin.select_file')}</span>
                    <input 
                      type="file" 
                      className="sr-only" 
                      accept="application/pdf" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > MAX_UPLOAD_BYTES) {
                            alert(t('admin.file_too_large'));
                            return;
                          }
                          try {
                            const url = await uploadFile(file, 'catalogs');
                            setNewProduct({ ...newProduct, catalogUrl: url });
                          } catch (error: any) {
                            alert(`${t('admin.upload_failed')}: ${error?.message || ''}`);
                          }
                        }
                      }} 
                    />
                  </label>
                  {newProduct.catalogUrl && (
                    <button 
                      type="button" 
                      onClick={async () => { 
                        await deleteFileFromServer(newProduct.catalogUrl); 
                        setNewProduct({...newProduct, catalogUrl: ''}); 
                      }} 
                      className="px-3 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#8892B0] mb-1">
                  {t('admin.product_images')} (最多4张, {t('admin.image_size_hint')})
                  <span className="ml-2 text-[#8892B0]/70 font-normal">— {t('admin.drag_to_reorder', '拖动可调整顺序，第 1 张为主图')}</span>
                </label>
                <div className="grid grid-cols-4 gap-3 mt-2 max-w-2xl">
                  {[0, 1, 2, 3].map((index) => {
                    const hasImage = !!newProduct.imageUrls[index];
                    const isDragging = dragImageIndex === index;
                    const isDragOver = dragOverIndex === index && dragImageIndex !== null && dragImageIndex !== index;
                    return (
                      <div
                        key={index}
                        draggable={hasImage}
                        onDragStart={(e) => {
                          if (!hasImage) return;
                          setDragImageIndex(index);
                          e.dataTransfer.effectAllowed = 'move';
                          // Setting any data is required for Firefox to fire drag events.
                          e.dataTransfer.setData('text/plain', String(index));
                        }}
                        onDragOver={(e) => {
                          if (dragImageIndex === null) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverIndex !== index) setDragOverIndex(index);
                        }}
                        onDragLeave={() => {
                          if (dragOverIndex === index) setDragOverIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragImageIndex === null) return;
                          moveImage(dragImageIndex, index);
                          setDragImageIndex(null);
                          setDragOverIndex(null);
                        }}
                        onDragEnd={() => {
                          setDragImageIndex(null);
                          setDragOverIndex(null);
                        }}
                        className={`relative group aspect-square border-2 ${
                          isDragOver ? 'border-[#FFB300] bg-[#FFB300]/10' : 'border-white/10'
                        } border-dashed rounded-lg hover:border-[#FFB300]/50 transition-all overflow-hidden flex items-center justify-center bg-[#112240]/50 ${
                          isDragging ? 'opacity-40 scale-95' : ''
                        } ${hasImage ? 'cursor-move' : ''}`}
                      >
                        {hasImage ? (
                          <>
                            <img src={newProduct.imageUrls[index]} alt={`Preview ${index + 1}`} className="w-full h-full object-contain p-2 pointer-events-none" />
                            {/* Sequence badge — index 0 is the main/cover image */}
                            <span className={`absolute top-2 left-2 ${
                              index === 0 ? 'bg-[#FFB300] text-[#0A192F]' : 'bg-black/70 text-white'
                            } text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center pointer-events-none`}>
                              {index + 1}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                const urlToDelete = newProduct.imageUrls[index];
                                await deleteFileFromServer(urlToDelete);
                                const newUrls = [...newProduct.imageUrls];
                                newUrls[index] = '';
                                setNewProduct({ ...newProduct, imageUrls: newUrls });
                              }}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <span className="absolute bottom-2 right-2 text-[10px] text-white/60 bg-black/40 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              {t('admin.drag_hint', '拖拽排序')}
                            </span>
                          </>
                        ) : (
                          <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center space-y-2">
                            <Plus className="w-8 h-8 text-[#8892B0] group-hover:text-[#FFB300] transition-colors" />
                            <span className="text-xs text-[#8892B0] group-hover:text-[#FFB300]">{t('admin.upload_image')}</span>
                            <input
                              type="file"
                              className="sr-only"
                              accept="image/*"
                              onChange={(e) => handleFileChange(e, index)}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="px-4 py-2 bg-[#FFB300] text-[#0A192F] rounded-md hover:bg-[#FFCA28] text-sm font-medium">{t('admin.save_product')}</button>
            </div>
          </form>
        </div>
      )}
      
      {loading ? <p className="text-[#8892B0]">{t('admin.loading')}</p> : (
        <>
          {/* Filters Row */}
          {(() => {
            const allMakes = Array.from(new Set(products.flatMap((p: any) => (p.fitments || []).map((f: any) => f.make).filter(Boolean)))).sort();
            const allModels = Array.from(new Set(products.flatMap((p: any) => (p.fitments || []).filter((f: any) => !filterMake || f.make === filterMake).map((f: any) => f.model).filter(Boolean)))).sort();
            const allYears = Array.from(new Set(products.flatMap((p: any) => (p.fitments || []).map((f: any) => String(f.year)).filter(Boolean)))).sort((a, b) => Number(b) - Number(a));
            const hasFilters = filterText || filterCategoryId || filterMake || filterModel || filterYear;
            return (
              <div className="mb-4 flex flex-wrap items-center gap-2 p-3 bg-[#0A192F] border border-white/5 rounded-lg">
                <input
                  type="text"
                  placeholder={t('admin.search_sku_name', 'Search SKU / name / OEM...')}
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  className="flex-1 min-w-[180px] max-w-[280px] px-3 py-2 bg-[#112240] border border-white/10 text-white text-sm rounded-md focus:outline-none focus:border-[#FFB300]/50"
                />
                <select value={filterCategoryId} onChange={e => setFilterCategoryId(e.target.value)} className="w-[160px] px-3 py-2 bg-[#112240] border border-white/10 text-white text-sm rounded-md focus:outline-none">
                  <option value="">{t('admin.all_categories', 'All Categories')}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={filterMake} onChange={e => { setFilterMake(e.target.value); setFilterModel(''); }} className="w-[130px] px-3 py-2 bg-[#112240] border border-white/10 text-white text-sm rounded-md focus:outline-none">
                  <option value="">{t('admin.all_makes', 'All Makes')}</option>
                  {allMakes.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={filterModel} onChange={e => setFilterModel(e.target.value)} className="w-[130px] px-3 py-2 bg-[#112240] border border-white/10 text-white text-sm rounded-md focus:outline-none">
                  <option value="">{t('admin.all_models', 'All Models')}</option>
                  {allModels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="w-[110px] px-3 py-2 bg-[#112240] border border-white/10 text-white text-sm rounded-md focus:outline-none">
                  <option value="">{t('admin.all_years', 'All Years')}</option>
                  {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {hasFilters && (
                  <button type="button" onClick={() => { setFilterText(''); setFilterCategoryId(''); setFilterMake(''); setFilterModel(''); setFilterYear(''); }} className="px-3 py-2 text-xs text-[#FFB300] hover:text-[#FFCA28] border border-[#FFB300]/30 rounded-md">
                    {t('admin.clear_filters', 'Clear')}
                  </button>
                )}
              </div>
            );
          })()}
          {(() => {
            const q = filterText.trim().toLowerCase();
            const filtered = products.filter((p: any) => {
              if (filterCategoryId && p.categoryId !== filterCategoryId) return false;
              if (q) {
                const hay = `${p.sku || ''} ${p.name || ''} ${p.oemNumber || ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
              }
              if (filterMake || filterModel || filterYear) {
                const fits: any[] = p.fitments || [];
                const ok = fits.some((f: any) =>
                  (!filterMake || f.make === filterMake) &&
                  (!filterModel || f.model === filterModel) &&
                  (!filterYear || String(f.year) === filterYear)
                );
                if (!ok) return false;
              }
              return true;
            });
            return (
              <div className="overflow-x-auto">
                <div className="mb-2 text-xs text-[#8892B0]">
                  {t('admin.showing_count', 'Showing')} <span className="text-[#FFB300] font-semibold">{filtered.length}</span> / {products.length}
                </div>
                <table className="w-full table-auto divide-y divide-white/10">
                  <thead className="bg-[#0A192F]">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-[#8892B0] uppercase tracking-wider w-[64px]">{t('admin.image', 'Image')}</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-[#8892B0] uppercase tracking-wider w-[18%]">{t('admin.sku')}</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-[#8892B0] uppercase tracking-wider">{t('admin.name')}</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-[#8892B0] uppercase tracking-wider w-[14%]">{t('admin.category')}</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-[#8892B0] uppercase tracking-wider w-[18%]">{t('admin.fitment', 'YMM')}</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-[#8892B0] uppercase tracking-wider w-[10%]">{t('admin.price')}</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-[#8892B0] uppercase tracking-wider w-[80px]">{t('admin.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#112240] divide-y divide-white/5">
                    {filtered.map(product => {
                      const thumb = (product.imageUrls && product.imageUrls[0]) || product.imageUrl || '';
                      const fits: any[] = product.fitments || [];
                      return (
                        <tr key={product.id}>
                          <td className="px-3 py-2">
                            {thumb ? (
                              <img src={thumb} alt="" loading="lazy" className="w-12 h-12 object-cover rounded border border-white/10 bg-white" />
                            ) : (
                              <div className="w-12 h-12 rounded bg-white/5 flex items-center justify-center text-[#8892B0]"><ImageIcon className="w-4 h-4" /></div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm font-medium text-[#E6F1FF] break-all">{product.sku}</td>
                          <td className="px-3 py-3 text-sm text-[#8892B0] break-words">{product.name}</td>
                          <td className="px-3 py-3 text-sm text-[#8892B0] break-words">{product.categoryName || '-'}</td>
                          <td className="px-3 py-3 text-xs text-[#8892B0]">
                            {fits.length === 0 ? '-' : (
                              <div className="flex flex-wrap gap-1">
                                {fits.slice(0, 3).map((f: any, i: number) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-[#0A192F] rounded text-[10px]">{f.displayName || `${f.year} ${f.make} ${f.model}`}</span>
                                ))}
                                {fits.length > 3 && <span className="text-[10px] text-[#FFB300]">+{fits.length - 3}</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-[#8892B0]">${product.price}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                            <button onClick={() => handleEditClick(product)} className="text-[#FFB300] hover:text-[#FFCA28]"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteProduct(product.id)} className="text-red-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-4 text-center text-sm text-[#8892B0]">{t('admin.no_products_found')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

function RegionsManager() {
  const { t } = useTranslation();
  const [regions, setRegions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newRegion, setNewRegion] = useState({ name: '', lat: '', lng: '', pulseStyle: 'default' });

  const fetchRegions = async () => {
    setLoading(true);
    try {
      const q = collection(db, 'salesRegions');
      const snapshot = await getDocs(q);
      setRegions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRegions(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'salesRegions'), {
        ...newRegion,
        lat: parseFloat(newRegion.lat),
        lng: parseFloat(newRegion.lng)
      });
      setIsAdding(false);
      setNewRegion({ name: '', lat: '', lng: '', pulseStyle: 'default' });
      fetchRegions();
    } catch (error) {
      alert(t('admin.add_failed'));
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('admin.confirm_delete'))) {
      await deleteDoc(doc(db, 'salesRegions', id));
      fetchRegions();
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#E6F1FF]">{t('admin.sales_regions')}</h2>
        <button onClick={() => setIsAdding(true)} className="flex items-center px-4 py-2 bg-[#FFB300] text-[#0A192F] rounded-md hover:bg-[#FFCA28] text-sm font-medium">
          <Plus className="w-4 h-4 mr-2" /> {t('admin.add_region')}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="mb-8 bg-[#0A192F] p-6 rounded-lg border border-white/5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input required placeholder={t('admin.region_name')} value={newRegion.name} onChange={e => setNewRegion({...newRegion, name: e.target.value})} className="px-3 py-2 bg-[#112240] text-white rounded-md border border-white/10" />
            <input required type="number" step="0.0001" placeholder={t('admin.latitude')} value={newRegion.lat} onChange={e => setNewRegion({...newRegion, lat: e.target.value})} className="px-3 py-2 bg-[#112240] text-white rounded-md border border-white/10" />
            <input required type="number" step="0.0001" placeholder={t('admin.longitude')} value={newRegion.lng} onChange={e => setNewRegion({...newRegion, lng: e.target.value})} className="px-3 py-2 bg-[#112240] text-white rounded-md border border-white/10" />
            <select value={newRegion.pulseStyle} onChange={e => setNewRegion({...newRegion, pulseStyle: e.target.value})} className="px-3 py-2 bg-[#112240] text-white rounded-md border border-white/10">
              <option value="default">{t('admin.default_pulse')}</option>
              <option value="strong">{t('admin.strong_pulse')}</option>
              <option value="slow">{t('admin.slow_pulse')}</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-[#8892B0]">{t('admin.cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-[#FFB300] text-[#0A192F] rounded-md">{t('admin.save')}</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {regions.map(r => (
          <div key={r.id} className="flex items-center justify-between p-4 bg-[#0A192F] rounded-lg border border-white/5">
            <div>
              <div className="text-[#E6F1FF] font-medium">{r.name}</div>
              <div className="text-[#8892B0] text-xs">{r.lat}, {r.lng}</div>
            </div>
            <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesManager() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'processed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replies, setReplies] = useState<Record<string, any[]>>({});
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const { siteSettings } = useStore();

  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredMessages = messages.filter(m => {
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (m.name || '').toLowerCase().includes(q) ||
        (m.company || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.phone || '').toLowerCase().includes(q) ||
        (m.partNeed || '').toLowerCase().includes(q) ||
        (m.vehicleModel || '').toLowerCase().includes(q) ||
        (m.message || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExportCSV = () => {
    const headers = ['Date', 'Status', 'Company', 'Name', 'Email', 'Phone', 'Vehicle Model', 'Part Need', 'Quantity', 'Message'];
    const rows = filteredMessages.map(m => [
      m.createdAt ? new Date(m.createdAt).toLocaleString() : '',
      m.status || '',
      (m.company || '').replace(/"/g, '""'),
      (m.name || '').replace(/"/g, '""'),
      m.email || '',
      m.phone || '',
      (m.vehicleModel || '').replace(/"/g, '""'),
      (m.partNeed || '').replace(/"/g, '""'),
      m.quantity || '',
      (m.message || '').replace(/"/g, '""').replace(/\n/g, ' '),
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inquiries_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStatusChange = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'new' ? 'processed' : 'new';
      await setDoc(doc(db, 'messages', id), { status: newStatus }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'messages');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('admin.confirm_delete_message', 'Are you sure you want to delete this message?'))) {
      try {
        await deleteDoc(doc(db, 'messages', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'messages');
      }
    }
  };

  const handleMailtoReply = (email: string, name: string) => {
    const subject = encodeURIComponent(t('admin.reply_subject', 'Reply to your inquiry - Vida Auto'));
    const body = encodeURIComponent(t('admin.reply_greeting', { name, defaultValue: `Hello ${name},` }));
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const loadReplies = async (messageId: string) => {
    try {
      const q = query(collection(db, 'messages', messageId, 'replies'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      setReplies(prev => ({ ...prev, [messageId]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    } catch (err) {
      console.error('Failed to load replies:', err);
    }
  };

  const handleToggleThread = async (messageId: string) => {
    if (expandedThread === messageId) {
      setExpandedThread(null);
      return;
    }
    setExpandedThread(messageId);
    if (!replies[messageId]) await loadReplies(messageId);
  };

  const handleSendReply = async (messageId: string, customerEmail: string, customerName: string) => {
    if (!replyText.trim()) return;
    setReplySending(true);
    try {
      const replyDoc = {
        body: replyText.trim(),
        from: 'admin',
        createdAt: new Date().toISOString(),
      };
      await addDoc(collection(db, 'messages', messageId, 'replies'), replyDoc);
      // Mark as processed
      await setDoc(doc(db, 'messages', messageId), { status: 'processed' }, { merge: true });
      // Send email if SMTP configured
      const { buildSmtp, sendReplyEmail } = await import('../lib/email');
      const smtp = buildSmtp(siteSettings || {});
      if (smtp && customerEmail) {
        sendReplyEmail(
          smtp,
          customerEmail,
          `Re: Your inquiry — Vida Auto`,
          replyText.trim(),
        ).catch(() => {});
      }
      // Refresh thread
      await loadReplies(messageId);
      setReplyText('');
      setReplyingTo(null);
    } catch (err) {
      console.error('Failed to send reply:', err);
      alert(t('common.submit_failed', 'Failed. Please try again.'));
    } finally {
      setReplySending(false);
    }
  };

  if (loading) return <div className="text-[#8892B0] p-8 text-center">{t('admin.loading')}</div>;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h2 className="text-xl font-bold text-[#E6F1FF]">{t('admin.messages_management', 'Message Board Management')}</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm text-[#8892B0]">
            {messages.filter(m => m.status === 'new').length} {t('admin.unread')} / {messages.length} {t('admin.total')}
          </div>
          <button onClick={handleExportCSV} className="px-3 py-1.5 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] text-xs font-medium transition-colors flex items-center gap-1">
            <FileDown className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-1 bg-[#0A192F] p-1 rounded-lg border border-white/5">
          {(['all', 'new', 'processed'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filterStatus === s ? 'bg-[#FFB300] text-[#0A192F]' : 'text-[#8892B0] hover:text-white'}`}>
              {s === 'all' ? t('admin.all', 'All') : s === 'new' ? t('admin.unread', 'New') : t('admin.processed_status', 'Processed')}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('admin.search_messages', 'Search by company, name, email, part...')}
          className="flex-1 px-3 py-2 border border-white/10 bg-[#0A192F] text-white rounded-lg text-sm focus:outline-none focus:border-[#FFB300]/50 placeholder:text-[#8892B0]/50"
        />
      </div>
      
      <div className="space-y-4">
        {filteredMessages.map(m => (
          <div key={m.id} className={`p-5 rounded-xl border transition-all ${m.status === 'new' ? 'bg-[#1a2c4e] border-[#FFB300]/30' : 'bg-[#0A192F] border-white/5'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${m.status === 'new' ? 'bg-[#FFB300] text-[#0A192F]' : 'bg-[#112240] text-[#8892B0]'}`}>
                  {(m.company || m.name || m.email || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-[#E6F1FF] flex items-center gap-2">
                    {m.company || m.name || t('admin.no_name', 'Unnamed')}
                    {m.status === 'new' && <span className="w-2 h-2 bg-[#FFB300] rounded-full animate-pulse"></span>}
                  </div>
                  <div className="text-[#8892B0] text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {m.email}</span>
                    {m.phone && <span>{m.phone}</span>}
                    {m.name && m.company && <span className="text-[#8892B0]/70">· {m.name}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-[11px] text-[#8892B0] font-mono mr-2">
                  {m.createdAt ? new Date(m.createdAt).toLocaleString() : '-'}
                </div>
                <button 
                  onClick={() => handleStatusChange(m.id, m.status)}
                  className={`p-2 rounded-lg transition-colors ${m.status === 'new' ? 'bg-[#FFB300]/10 text-[#FFB300] hover:bg-[#FFB300]/20' : 'bg-green-500/10 text-green-400'}`}
                  title={m.status === 'new' ? t('admin.mark_processed') : t('admin.mark_new')}
                >
                  <CheckCircle className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => { setReplyingTo(replyingTo === m.id ? null : m.id); setReplyText(''); }}
                  className={`p-2 rounded-lg transition-colors ${replyingTo === m.id ? 'bg-[#FFB300]/20 text-[#FFB300]' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'}`}
                  title={t('admin.reply', 'Reply')}
                >
                  <Send className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleMailtoReply(m.email, m.name || m.company || '')}
                  className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
                  title={t('admin.reply_email', 'Reply via Email Client')}
                >
                  <Mail className="w-5 h-5" />
                </button>
                <button
                  onClick={async () => {
                    const dueDate = prompt(t('admin.task_due_prompt', 'Follow-up date (YYYY-MM-DD):'), new Date(Date.now() + 86400000).toISOString().slice(0, 10));
                    if (!dueDate) return;
                    try {
                      await addDoc(collection(db, 'tasks'), {
                        messageId: m.id,
                        title: `${t('admin.follow_up', 'Follow up')}: ${m.company || m.name || m.email}`,
                        description: `${m.partNeed ? m.partNeed + ' — ' : ''}${m.message?.slice(0, 100) || ''}`,
                        customerEmail: m.email || '',
                        customerName: m.name || m.company || '',
                        dueDate,
                        status: 'pending',
                        priority: 'medium',
                        reminderSent: false,
                        createdAt: new Date().toISOString(),
                      });
                      alert(t('admin.task_created', 'Follow-up task created!'));
                    } catch (err) { console.error(err); alert('Failed'); }
                  }}
                  className="p-2 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/20 transition-colors"
                  title={t('admin.create_task', 'Create Follow-up Task')}
                >
                  <ClipboardList className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleDelete(m.id)}
                  className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
                  title={t('admin.delete')}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {(m.vehicleModel || m.partNeed || m.quantity) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                {m.vehicleModel && (
                  <div className="bg-[#0A192F] border border-white/5 px-3 py-2 rounded-lg">
                    <div className="text-[10px] text-[#8892B0] uppercase tracking-wider">{t('contact.vehicle_model', 'Vehicle Model')}</div>
                    <div className="text-sm text-[#E6F1FF]">{m.vehicleModel}</div>
                  </div>
                )}
                {m.partNeed && (
                  <div className="bg-[#0A192F] border border-white/5 px-3 py-2 rounded-lg">
                    <div className="text-[10px] text-[#8892B0] uppercase tracking-wider">{t('contact.part_need', 'Part Needed')}</div>
                    <div className="text-sm text-[#E6F1FF]">{m.partNeed}</div>
                  </div>
                )}
                {m.quantity && (
                  <div className="bg-[#0A192F] border border-white/5 px-3 py-2 rounded-lg">
                    <div className="text-[10px] text-[#8892B0] uppercase tracking-wider">{t('contact.quantity', 'Quantity')}</div>
                    <div className="text-sm text-[#E6F1FF]">{m.quantity}</div>
                  </div>
                )}
              </div>
            )}

            {m.message && (
              <div className="bg-[#112240] p-4 rounded-lg text-[#E6F1FF]/90 text-sm leading-relaxed whitespace-pre-wrap">
                {m.message}
              </div>
            )}
            
            {/* Reply input */}
            {replyingTo === m.id && (
              <div className="mt-4 space-y-3">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={t('admin.reply_placeholder', 'Type your reply here...')}
                  rows={4}
                  className="w-full px-4 py-3 bg-[#112240] text-white rounded-lg border border-[#FFB300]/30 focus:outline-none focus:border-[#FFB300]/60 text-sm resize-none placeholder:text-[#8892B0]/50"
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-[#8892B0]">
                    {siteSettings?.smtpHost ? t('admin.reply_will_email', 'Reply will also be sent to customer via email.') : t('admin.reply_no_smtp', 'SMTP not configured — reply will only be saved here.')}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setReplyingTo(null); setReplyText(''); }} className="px-3 py-1.5 text-[#8892B0] text-xs hover:text-white">{t('admin.cancel', 'Cancel')}</button>
                    <button
                      type="button"
                      disabled={!replyText.trim() || replySending}
                      onClick={() => handleSendReply(m.id, m.email, m.name || m.company || '')}
                      className="px-4 py-1.5 bg-[#FFB300] text-[#0A192F] rounded-md text-xs font-bold hover:bg-[#FFCA28] transition-all disabled:opacity-40 flex items-center gap-1"
                    >
                      {replySending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      {t('admin.send_reply', 'Send Reply')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Conversation thread */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => handleToggleThread(m.id)}
                className="text-[11px] text-[#8892B0] hover:text-[#FFB300] transition-colors flex items-center gap-1"
              >
                <MessageSquare className="w-3 h-3" />
                {expandedThread === m.id ? t('admin.hide_thread', 'Hide conversation') : t('admin.show_thread', 'Show conversation')}
                {replies[m.id] && replies[m.id].length > 0 && ` (${replies[m.id].length})`}
              </button>
              {expandedThread === m.id && replies[m.id] && (
                <div className="mt-2 space-y-2 pl-4 border-l-2 border-[#FFB300]/20">
                  {replies[m.id].length === 0 && (
                    <p className="text-xs text-[#8892B0] italic py-2">{t('admin.no_replies', 'No replies yet.')}</p>
                  )}
                  {replies[m.id].map((r: any) => (
                    <div key={r.id} className="bg-[#112240] p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFB300]">{r.from === 'admin' ? 'Admin' : 'Customer'}</span>
                        <span className="text-[10px] text-[#8892B0] font-mono">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</span>
                      </div>
                      <p className="text-sm text-[#E6F1FF]/90 whitespace-pre-wrap">{r.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {m.status === 'processed' && (
              <div className="mt-3 flex items-center gap-2 text-[10px] text-green-400 uppercase tracking-widest font-bold">
                <CheckCircle className="w-3 h-3" />
                {t('admin.processed_status', 'Processed / Replied')}
              </div>
            )}
          </div>
        ))}
        
        {filteredMessages.length === 0 && (
          <div className="text-center py-20 bg-[#0A192F] rounded-xl border border-dashed border-white/10">
            <MessageSquare className="w-12 h-12 text-[#112240] mx-auto mb-4" />
            <p className="text-[#8892B0]">{searchQuery || filterStatus !== 'all' ? t('admin.no_matching_messages', 'No messages match your filters.') : t('admin.no_messages_found')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TasksManager() {
  const { t } = useTranslation();
  const { siteSettings } = useStore();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'done' | 'overdue'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', dueDate: '', customerEmail: '', customerName: '', priority: 'medium' as 'high' | 'medium' | 'low' });

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('dueDate', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const filteredTasks = tasks.filter(tk => {
    if (filterStatus === 'pending') return tk.status === 'pending';
    if (filterStatus === 'done') return tk.status === 'done';
    if (filterStatus === 'overdue') return tk.status === 'pending' && tk.dueDate < today;
    return true;
  });

  const overdueCount = tasks.filter(tk => tk.status === 'pending' && tk.dueDate < today).length;
  const pendingCount = tasks.filter(tk => tk.status === 'pending').length;

  const handleToggleStatus = async (id: string, current: string) => {
    const newStatus = current === 'pending' ? 'done' : 'pending';
    await setDoc(doc(db, 'tasks', id), { status: newStatus, completedAt: newStatus === 'done' ? new Date().toISOString() : null }, { merge: true });
  };

  const handleDeleteTask = async (id: string) => {
    if (window.confirm(t('admin.confirm_delete_task', 'Delete this task?'))) {
      await deleteDoc(doc(db, 'tasks', id));
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.dueDate) return;
    await addDoc(collection(db, 'tasks'), {
      ...newTask,
      messageId: '',
      status: 'pending',
      reminderSent: false,
      createdAt: new Date().toISOString(),
    });
    setNewTask({ title: '', description: '', dueDate: '', customerEmail: '', customerName: '', priority: 'medium' });
    setIsCreating(false);
  };

  const priorityColors: Record<string, string> = {
    high: 'text-red-400 bg-red-500/10 border-red-500/20',
    medium: 'text-[#FFB300] bg-[#FFB300]/10 border-[#FFB300]/20',
    low: 'text-[#8892B0] bg-[#8892B0]/10 border-[#8892B0]/20',
  };

  if (loading) return <div className="text-[#8892B0] p-8 text-center">{t('admin.loading')}</div>;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h2 className="text-xl font-bold text-[#E6F1FF]">{t('admin.tasks_management', 'Follow-up Tasks')}</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {overdueCount > 0 && <span className="text-xs text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded-full">{overdueCount} {t('admin.overdue', 'overdue')}</span>}
          <span className="text-sm text-[#8892B0]">{pendingCount} {t('admin.pending', 'pending')}</span>
          <button onClick={() => setIsCreating(true)} className="px-3 py-1.5 bg-[#FFB300] text-[#0A192F] rounded-md text-xs font-bold hover:bg-[#FFCA28] flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> {t('admin.new_task', 'New Task')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 bg-[#0A192F] p-1 rounded-lg border border-white/5 mb-5 w-fit">
        {(['all', 'pending', 'overdue', 'done'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filterStatus === s ? 'bg-[#FFB300] text-[#0A192F]' : 'text-[#8892B0] hover:text-white'}`}>
            {s === 'all' ? t('admin.all', 'All') : s === 'pending' ? t('admin.pending', 'Pending') : s === 'overdue' ? t('admin.overdue', 'Overdue') : t('admin.done', 'Done')}
          </button>
        ))}
      </div>

      {/* Create form */}
      {isCreating && (
        <form onSubmit={handleCreateTask} className="mb-6 p-5 bg-[#0A192F] rounded-xl border border-[#FFB300]/30 space-y-4">
          <h3 className="text-sm font-bold text-[#FFB300] uppercase tracking-wider">{t('admin.new_task', 'New Task')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-[#8892B0] mb-1">{t('admin.task_title', 'Title')}</label>
              <input required value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="w-full px-3 py-2 bg-[#112240] text-white rounded-md border border-white/10 focus:border-[#FFB300]/50 outline-none text-sm" placeholder="e.g. Follow up with ABC Motors for brake pads" />
            </div>
            <div>
              <label className="block text-xs text-[#8892B0] mb-1">{t('admin.due_date', 'Due Date')}</label>
              <input required type="date" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} className="w-full px-3 py-2 bg-[#112240] text-white rounded-md border border-white/10 focus:border-[#FFB300]/50 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#8892B0] mb-1">{t('admin.priority', 'Priority')}</label>
              <select value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value as any})} className="w-full px-3 py-2 bg-[#112240] text-white rounded-md border border-white/10 focus:border-[#FFB300]/50 outline-none text-sm">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#8892B0] mb-1">{t('admin.customer_email', 'Customer Email')}</label>
              <input type="email" value={newTask.customerEmail} onChange={e => setNewTask({...newTask, customerEmail: e.target.value})} className="w-full px-3 py-2 bg-[#112240] text-white rounded-md border border-white/10 focus:border-[#FFB300]/50 outline-none text-sm" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs text-[#8892B0] mb-1">{t('admin.customer_name', 'Customer Name')}</label>
              <input value={newTask.customerName} onChange={e => setNewTask({...newTask, customerName: e.target.value})} className="w-full px-3 py-2 bg-[#112240] text-white rounded-md border border-white/10 focus:border-[#FFB300]/50 outline-none text-sm" placeholder="Optional" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-[#8892B0] mb-1">{t('admin.description', 'Description')}</label>
              <textarea value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} rows={2} className="w-full px-3 py-2 bg-[#112240] text-white rounded-md border border-white/10 focus:border-[#FFB300]/50 outline-none text-sm resize-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-[#8892B0] text-sm">{t('admin.cancel', 'Cancel')}</button>
            <button type="submit" className="px-6 py-2 bg-[#FFB300] text-[#0A192F] rounded-md text-sm font-bold">{t('admin.create', 'Create')}</button>
          </div>
        </form>
      )}

      {/* Task list */}
      <div className="space-y-3">
        {filteredTasks.map(tk => {
          const isOverdue = tk.status === 'pending' && tk.dueDate < today;
          return (
            <div key={tk.id} className={`p-4 rounded-xl border transition-all ${isOverdue ? 'bg-red-900/10 border-red-500/30' : tk.status === 'done' ? 'bg-[#0A192F] border-white/5 opacity-60' : 'bg-[#0A192F] border-white/10'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button onClick={() => handleToggleStatus(tk.id, tk.status)} className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${tk.status === 'done' ? 'bg-green-500 border-green-500' : 'border-[#8892B0] hover:border-[#FFB300]'}`}>
                    {tk.status === 'done' && <CheckCircle className="w-3 h-3 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm ${tk.status === 'done' ? 'line-through text-[#8892B0]' : 'text-[#E6F1FF]'}`}>{tk.title}</div>
                    {tk.description && <p className="text-xs text-[#8892B0] mt-1 truncate">{tk.description}</p>}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-mono ${isOverdue ? 'text-red-400' : 'text-[#8892B0]'}`}>
                        <Calendar className="w-3 h-3" /> {tk.dueDate}
                        {isOverdue && <span className="font-bold ml-1">OVERDUE</span>}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${priorityColors[tk.priority] || priorityColors.medium}`}>{tk.priority}</span>
                      {tk.customerName && <span className="text-[10px] text-[#8892B0]">{tk.customerName}</span>}
                      {tk.reminderSent && <span className="text-[10px] text-green-400 flex items-center gap-0.5"><Mail className="w-3 h-3" /> reminded</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleDeleteTask(tk.id)} className="p-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        {filteredTasks.length === 0 && (
          <div className="text-center py-16 bg-[#0A192F] rounded-xl border border-dashed border-white/10">
            <ClipboardList className="w-12 h-12 text-[#112240] mx-auto mb-4" />
            <p className="text-[#8892B0]">{t('admin.no_tasks', 'No tasks found.')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TranslationsManager() {
  const { t } = useTranslation();
  const [translations, setTranslations] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ key: '', zh: '', en: '' });

  useEffect(() => {
    const q = query(collection(db, 'translations'), orderBy('key'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTranslations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'translations_manager');
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await setDoc(doc(db, 'translations', editingId), formData);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'translations'), formData);
        setIsAdding(false);
      }
      setFormData({ key: '', zh: '', en: '' });
    } catch (error) {
      console.error("Error saving translation:", error);
      alert(t('common.submit_failed'));
    }
  };

  const handleEdit = (trans: any) => {
    setEditingId(trans.id);
    setFormData({ key: trans.key, zh: trans.zh || '', en: trans.en || '' });
    setIsAdding(false);
  };

  const handleDelete = async (id: string, key: string) => {
    if (window.confirm(t('admin.confirm_delete_message', { name: key }))) {
      try {
        await deleteDoc(doc(db, 'translations', id));
      } catch (error) {
        alert("Delete failed");
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#E6F1FF]">{t('admin.translations_management')}</h2>
        <button 
          onClick={() => { setIsAdding(true); setEditingId(null); setFormData({ key: '', zh: '', en: '' }); }} 
          className="flex items-center px-4 py-2 bg-[#FFB300] text-[#0A192F] rounded-md hover:bg-[#FFCA28] text-sm font-medium"
        >
          <Plus className="w-4 h-4 mr-2" /> {t('admin.add_translation')}
        </button>
      </div>

      {(isAdding || editingId) && (
        <form onSubmit={handleSubmit} className="mb-8 bg-[#0A192F] p-6 rounded-lg border border-[#FFB300]/30 space-y-4">
          <h3 className="text-sm font-bold text-[#FFB300] uppercase tracking-wider">{editingId ? t('admin.edit_product') : t('admin.add_translation')}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[#8892B0] mb-1">{t('admin.translation_key')}</label>
              <input 
                required 
                placeholder="e.g. home.title" 
                value={formData.key} 
                onChange={e => setFormData({...formData, key: e.target.value})} 
                className="w-full px-3 py-2 bg-[#112240] text-white rounded-md border border-white/10" 
              />
              <p className="text-[10px] text-[#8892B0] mt-1 italic">Use dot notation: category.field (e.g. home.must_have)</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#8892B0] mb-1">{t('admin.zh_content')}</label>
                <textarea 
                  rows={3}
                  placeholder="中文内容..." 
                  value={formData.zh} 
                  onChange={e => setFormData({...formData, zh: e.target.value})} 
                  className="w-full px-3 py-2 bg-[#112240] text-white rounded-md border border-white/10 resize-none" 
                />
              </div>
              <div>
                <label className="block text-xs text-[#8892B0] mb-1">{t('admin.en_content')}</label>
                <textarea 
                  rows={3}
                  placeholder="English Content..." 
                  value={formData.en} 
                  onChange={e => setFormData({...formData, en: e.target.value})} 
                  className="w-full px-3 py-2 bg-[#112240] text-white rounded-md border border-white/10 resize-none" 
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setIsAdding(false); setEditingId(null); }} className="px-4 py-2 text-[#8892B0] text-sm">{t('admin.cancel')}</button>
            <button type="submit" className="px-6 py-2 bg-[#FFB300] text-[#0A192F] rounded-md text-sm font-bold shadow-lg shadow-[#FFB300]/10">{t('admin.save')}</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-3">
        {translations.map(item => (
          <div key={item.id} className="p-4 bg-[#0A192F] rounded-lg border border-white/5 group hover:border-white/10 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <div className="text-[#FFB300] font-mono text-xs font-semibold px-2 py-0.5 bg-[#FFB300]/10 rounded border border-[#FFB300]/20">{item.key}</div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(item)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-md transition-colors"><Edit className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(item.id, item.key)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-[#8892B0] font-bold">ZH</div>
                <div className="text-[#E6F1FF] bg-[#112240] p-2 rounded border border-white/5">{item.zh || '---'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-[#8892B0] font-bold">EN</div>
                <div className="text-[#8892B0] bg-[#112240] p-2 rounded border border-white/5 italic">{item.en || '---'}</div>
              </div>
            </div>
          </div>
        ))}
        {translations.length === 0 && (
          <div className="text-center py-12 bg-[#0A192F] rounded-lg border border-dashed border-white/10">
            <p className="text-[#8892B0]">{t('admin.no_translations_found', 'No translations found. Add one to override static text.')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickTranslationEditor() {
  const { t, i18n } = useTranslation();
  const commonKeys = [
    { key: 'home.must_have', label: 'Landing Page Section Title (Products)' },
    { key: 'home.search_title', label: 'Search Section Title' },
    { key: 'home.contact_title', label: 'Contact Section Title' },
    { key: 'footer.follow_us', label: 'Footer "Follow Us" Text' },
    { key: 'about.company_name', label: 'Company Name' }
  ];

  const [translations, setTranslations] = useState<any[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [formData, setFormData] = useState({ zh: '', en: '' });

  useEffect(() => {
    const q = collection(db, 'translations');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTranslations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'translations_quick');
    });
    return () => unsubscribe();
  }, []);

  const handleEdit = (key: string) => {
    const existing = translations.find(t => t.key === key);
    setEditingKey(key);
    setFormData({
      zh: existing?.zh || i18n.t(key, { lng: 'zh' }) || '',
      en: existing?.en || i18n.t(key, { lng: 'en' }) || ''
    });
  };

  const handleSave = async () => {
    if (!editingKey) return;
    try {
      const existing = translations.find(t => t.key === editingKey);
      if (existing) {
        await setDoc(doc(db, 'translations', existing.id), { ...existing, ...formData });
      } else {
        await addDoc(collection(db, 'translations'), { key: editingKey, ...formData });
      }
      setEditingKey(null);
    } catch (error) {
      alert("Failed to save text");
    }
  };

  return (
    <div className="bg-[#0A192F] p-6 rounded-lg border border-white/5 space-y-4 mb-8">
      <h3 className="text-lg font-bold text-[#FFB300] mb-4 flex items-center">
        <Edit className="w-5 h-5 mr-2" /> {t('admin.quick_text_edit', 'Quick Text Editing (Home Page Headlines)')}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {commonKeys.map(item => {
          const trans = translations.find(t => t.key === item.key);
          return (
            <div key={item.key} className="flex items-center justify-between p-4 bg-[#112240] rounded-lg border border-white/5 gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-[#8892B0] font-bold uppercase tracking-wider mb-1">{item.label}</div>
                <div className="text-sm text-[#E6F1FF] truncate">
                  <span className="text-[#FFB300] mr-2 font-mono">ZH:</span> 
                  {trans?.zh || i18n.t(item.key, { lng: 'zh' })}
                </div>
              </div>
              <button 
                type="button"
                onClick={() => handleEdit(item.key)}
                className="px-3 py-1.5 bg-[#FFB300] text-[#0A192F] rounded hover:bg-[#FFCA28] text-xs font-bold transition-all shrink-0"
              >
                {t('admin.edit', 'Edit')}
              </button>
            </div>
          );
        })}
      </div>

      {editingKey && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0A192F] w-full max-w-md p-6 rounded-xl border border-[#FFB300]/30 shadow-2xl">
            <h4 className="text-lg font-bold text-[#FFB300] mb-4 flex items-center">
              <Edit className="w-5 h-5 mr-2" /> {editingKey}
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#8892B0] mb-1 font-bold">{t('admin.zh_content', 'CHINESE (ZH)')}</label>
                <textarea 
                  value={formData.zh} 
                  onChange={e => setFormData({...formData, zh: e.target.value})} 
                  className="w-full px-3 py-2 bg-[#112240] text-white rounded-md border border-white/10 focus:border-[#FFB300]/50 outline-none text-sm"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-xs text-[#8892B0] mb-1 font-bold">{t('admin.en_content', 'ENGLISH (EN)')}</label>
                <textarea 
                  value={formData.en} 
                  onChange={e => setFormData({...formData, en: e.target.value})} 
                  className="w-full px-3 py-2 bg-[#112240] text-white rounded-md border border-white/10 focus:border-[#FFB300]/50 outline-none text-sm italic"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setEditingKey(null)} className="px-4 py-2 text-[#8892B0] text-sm font-medium hover:text-white transition-colors">{t('admin.cancel', 'Cancel')}</button>
              <button type="button" onClick={handleSave} className="px-6 py-2 bg-[#FFB300] text-[#0A192F] rounded-md font-bold hover:bg-[#FFCA28] transition-all">{t('admin.save_changes', 'Save Changes')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsManager() {
  const { t } = useTranslation();
  const { siteSettings, setSiteSettings } = useStore();
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const snap = await getDocs(collection(db, 'products'));
        setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching products for settings:", error);
      }
    };
    fetchProducts();
  }, []);
  useEffect(() => {
    if (siteSettings) {
      setLogoUrl(siteSettings.logoUrl || '');
      setStatsBgUrl(siteSettings.statsBgUrl || '');
      setStatsVideoUrl(siteSettings.statsVideoUrl || '');
      setStatsOverlayText(siteSettings.statsOverlayText || '');
      setStoryVideoUrl(siteSettings.storyVideoUrl || '');
      setStoryBgUrl(siteSettings.storyBgUrl || '');
      setFactoryVideoUrl(siteSettings.factoryVideoUrl || '');
      setFactoryBgUrl(siteSettings.factoryBgUrl || '');
      setHeroVideoUrl(siteSettings.heroVideoUrl || '');
      setHeroBgUrl(siteSettings.heroBgUrl || '');
      setAddress(siteSettings.address || '');
      setPhone(siteSettings.phone || '');
      setEmail(siteSettings.email || '');
      setWhatsappQrUrl(siteSettings.whatsappQrUrl || '');
      setWhatsappLink(siteSettings.whatsappLink || '');
      setStarProductId(siteSettings.starProductId || '');
      setStarProductTitle(siteSettings.starProductTitle || '');
      setGlobeTitle(siteSettings.globeTitle || '');
      setGlobeSubtitle(siteSettings.globeSubtitle || '');
      setGlobeBottomTitle(siteSettings.globeBottomTitle || '');
      setGlobeBottomSubtitle(siteSettings.globeBottomSubtitle || '');
      setCatalogUrl(siteSettings.catalogUrl || '');
      setCatalogTitle(siteSettings.catalogTitle || '');
      setFacebook(siteSettings.facebook || '');
      setTwitter(siteSettings.twitter || '');
      setInstagram(siteSettings.instagram || '');
      setLinkedin(siteSettings.linkedin || '');
      setFeaturesLayout(siteSettings.featuresLayout || 'classic');
      setMetaPixelId(siteSettings.metaPixelId || '');
      setFbCapiAccessToken(siteSettings.fbCapiAccessToken || '');
      setFbCapiTestCode(siteSettings.fbCapiTestCode || '');
      setGa4MeasurementId(siteSettings.ga4MeasurementId || '');
      setGadsConversionId(siteSettings.gadsConversionId || '');
      setGadsConversionLabel(siteSettings.gadsConversionLabel || '');
      setWorkingHours(siteSettings.workingHours || 'MON-FRI 09:00-18:00');
      setWorkingHoursTz(siteSettings.workingHoursTz || 'Asia/Shanghai');
      setCrmWebhookUrl(siteSettings.crmWebhookUrl || '');
      setCrmWebhookHeaders(siteSettings.crmWebhookHeaders || '');
      setCrmWebhookEnabled(siteSettings.crmWebhookEnabled ?? false);
      setEmailProvider(siteSettings.emailProvider || 'resend');
      setResendApiKey(siteSettings.resendApiKey || '');
      setSmtpHost(siteSettings.smtpHost || '');
      setSmtpPort(siteSettings.smtpPort || '587');
      setSmtpUser(siteSettings.smtpUser || '');
      setSmtpPass(siteSettings.smtpPass || '');
      setSmtpSecure(siteSettings.smtpSecure ?? false);
      setNotifyEmails(siteSettings.notifyEmails || '');
      setEmailNotifyEnabled(siteSettings.emailNotifyEnabled ?? false);
      setEmailAutoReplyEnabled(siteSettings.emailAutoReplyEnabled ?? false);
    }
  }, [siteSettings]);

  const [smtpHost, setSmtpHost] = useState(siteSettings?.smtpHost || '');
  const [smtpPort, setSmtpPort] = useState(siteSettings?.smtpPort || '587');
  const [smtpUser, setSmtpUser] = useState(siteSettings?.smtpUser || '');
  const [smtpPass, setSmtpPass] = useState(siteSettings?.smtpPass || '');
  const [smtpSecure, setSmtpSecure] = useState(siteSettings?.smtpSecure ?? false);
  const [notifyEmails, setNotifyEmails] = useState(siteSettings?.notifyEmails || '');
  const [emailNotifyEnabled, setEmailNotifyEnabled] = useState(siteSettings?.emailNotifyEnabled ?? false);
  const [emailAutoReplyEnabled, setEmailAutoReplyEnabled] = useState(siteSettings?.emailAutoReplyEnabled ?? false);
  const [emailProvider, setEmailProvider] = useState<'resend' | 'smtp'>(siteSettings?.emailProvider || 'resend');
  const [resendApiKey, setResendApiKey] = useState(siteSettings?.resendApiKey || '');
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<'success' | 'fail' | null>(null);
  const [crmWebhookUrl, setCrmWebhookUrl] = useState(siteSettings?.crmWebhookUrl || '');
  const [crmWebhookHeaders, setCrmWebhookHeaders] = useState(siteSettings?.crmWebhookHeaders || '');
  const [crmWebhookEnabled, setCrmWebhookEnabled] = useState(siteSettings?.crmWebhookEnabled ?? false);
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<'success' | 'fail' | null>(null);
  const [metaPixelId, setMetaPixelId] = useState(siteSettings?.metaPixelId || '');
  const [fbCapiAccessToken, setFbCapiAccessToken] = useState(siteSettings?.fbCapiAccessToken || '');
  const [fbCapiTestCode, setFbCapiTestCode] = useState(siteSettings?.fbCapiTestCode || '');
  const [ga4MeasurementId, setGa4MeasurementId] = useState(siteSettings?.ga4MeasurementId || '');
  const [gadsConversionId, setGadsConversionId] = useState(siteSettings?.gadsConversionId || '');
  const [gadsConversionLabel, setGadsConversionLabel] = useState(siteSettings?.gadsConversionLabel || '');
  const [workingHours, setWorkingHours] = useState(siteSettings?.workingHours || 'MON-FRI 09:00-18:00');
  const [workingHoursTz, setWorkingHoursTz] = useState(siteSettings?.workingHoursTz || 'Asia/Shanghai');
  const [logoUrl, setLogoUrl] = useState(siteSettings?.logoUrl || '');
  const [statsBgUrl, setStatsBgUrl] = useState(siteSettings?.statsBgUrl || '');
  const [statsVideoUrl, setStatsVideoUrl] = useState(siteSettings?.statsVideoUrl || '');
  const [statsOverlayText, setStatsOverlayText] = useState(siteSettings?.statsOverlayText || '');
  const [storyVideoUrl, setStoryVideoUrl] = useState(siteSettings?.storyVideoUrl || '');
  const [storyBgUrl, setStoryBgUrl] = useState(siteSettings?.storyBgUrl || '');
  const [factoryVideoUrl, setFactoryVideoUrl] = useState(siteSettings?.factoryVideoUrl || '');
  const [factoryBgUrl, setFactoryBgUrl] = useState(siteSettings?.factoryBgUrl || '');
  const [heroVideoUrl, setHeroVideoUrl] = useState(siteSettings?.heroVideoUrl || '');
  const [heroBgUrl, setHeroBgUrl] = useState(siteSettings?.heroBgUrl || '');
  const [address, setAddress] = useState(siteSettings?.address || '');
  const [phone, setPhone] = useState(siteSettings?.phone || '');
  const [email, setEmail] = useState(siteSettings?.email || '');
  const [whatsappQrUrl, setWhatsappQrUrl] = useState(siteSettings?.whatsappQrUrl || '');
  const [whatsappLink, setWhatsappLink] = useState(siteSettings?.whatsappLink || '');
  const [starProductId, setStarProductId] = useState(siteSettings?.starProductId || '');
  const [starProductTitle, setStarProductTitle] = useState(siteSettings?.starProductTitle || '');
  const [globeTitle, setGlobeTitle] = useState(siteSettings?.globeTitle || '');
  const [globeSubtitle, setGlobeSubtitle] = useState(siteSettings?.globeSubtitle || '');
  const [globeBottomTitle, setGlobeBottomTitle] = useState(siteSettings?.globeBottomTitle || '');
  const [globeBottomSubtitle, setGlobeBottomSubtitle] = useState(siteSettings?.globeBottomSubtitle || '');
  const [catalogUrl, setCatalogUrl] = useState(siteSettings?.catalogUrl || '');
  const [catalogTitle, setCatalogTitle] = useState(siteSettings?.catalogTitle || '');
  const [facebook, setFacebook] = useState(siteSettings?.facebook || '');
  const [twitter, setTwitter] = useState(siteSettings?.twitter || '');
  const [instagram, setInstagram] = useState(siteSettings?.instagram || '');
  const [linkedin, setLinkedin] = useState(siteSettings?.linkedin || '');
  const [featuresLayout, setFeaturesLayout] = useState(siteSettings?.featuresLayout || 'classic');
  const [statsRegions, setStatsRegions] = useState(siteSettings?.statsRegions || '45+');
  const [statsSkus, setStatsSkus] = useState(siteSettings?.statsSkus || '12.5k');
  const [isSaving, setIsSaving] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void, currentUrl?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      alert(`${t('admin.image_too_large')} (${(file.size / 1024 / 1024).toFixed(2)}MB)。${t('admin.content_too_large')}`);
      return;
    }
    try {
      // 显示上传中提示
      const uploadingMsg = `${t('admin.uploading', 'Uploading')} ${file.name}...`;
      console.log(`[upload] ${uploadingMsg}`);
      
      const url = await uploadFile(file, 'site-settings');
      
      if (currentUrl) {
        await deleteFileFromServer(currentUrl);
      }
      
      setter(url);
      
      // 显示成功提示
      alert(`✅ ${t('admin.upload_success', 'Upload successful')}: ${file.name}`);
      console.log(`[upload] Success: ${url}`);
    } catch (error: any) {
      console.error('Upload error in SettingsManager:', error);
      alert(`❌ ${t('admin.upload_failed', 'Upload failed')}: ${error.message}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const newSettings = { 
        ...siteSettings,
        logoUrl, statsBgUrl, statsVideoUrl, statsOverlayText, storyVideoUrl, storyBgUrl, factoryVideoUrl, factoryBgUrl, heroVideoUrl, heroBgUrl, address, phone, email, whatsappQrUrl, whatsappLink,
        starProductId, starProductTitle,
        globeTitle, globeSubtitle, globeBottomTitle, globeBottomSubtitle,
        catalogUrl, catalogTitle,
        facebook, twitter, instagram, linkedin,
        featuresLayout,
        statsRegions,
        statsSkus,
        metaPixelId: metaPixelId || '',
        fbCapiAccessToken: fbCapiAccessToken || '',
        fbCapiTestCode: fbCapiTestCode || '',
        ga4MeasurementId: ga4MeasurementId || '',
        gadsConversionId: gadsConversionId || '',
        gadsConversionLabel: gadsConversionLabel || '',
        workingHours,
        workingHoursTz,
        crmWebhookUrl: crmWebhookUrl || '',
        crmWebhookHeaders: crmWebhookHeaders || '',
        crmWebhookEnabled,
        emailProvider,
        resendApiKey: resendApiKey || '',
        smtpHost: smtpHost || '',
        smtpPort: smtpPort || '587',
        smtpUser: smtpUser || '',
        smtpPass: smtpPass || '',
        smtpSecure,
        notifyEmails: notifyEmails || '',
        emailNotifyEnabled,
        emailAutoReplyEnabled,
        updatedAt: new Date().toISOString(),
        key: 'global'
      };
      await setDoc(doc(db, 'settings', 'global'), newSettings, { merge: true });
      setSiteSettings(newSettings);
      alert(t('admin.settings_saved'));
    } catch (error: any) {
      console.error("Error saving settings:", error);
      alert(`${t('admin.save_failed')}: ${error.message}`);
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-[#E6F1FF]">{t('admin.site_settings')}</h2>
      
      {/* Quick Text Editor */}
      <QuickTranslationEditor />
      
      <form onSubmit={handleSave} className="space-y-8">
        {/* Contact Info */}
        <div className="bg-[#0A192F] p-6 rounded-lg border border-white/5 space-y-4">
          <h3 className="text-lg font-bold text-[#FFB300] mb-4 flex items-center">
            <Settings className="w-5 h-5 mr-2" /> {t('admin.contact_settings', 'Contact Information')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.address')}</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.phone')}</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.email')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#8892B0] mb-2">{t('admin.star_product_settings', 'Star Product Settings')}</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#8892B0] mb-1">{t('admin.star_product_title', 'Display Title')}</label>
                  <input 
                    type="text" 
                    value={starProductTitle} 
                    onChange={e => setStarProductTitle(e.target.value)} 
                    placeholder={t('home.star_product')}
                    className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" 
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#8892B0] mb-1">{t('admin.select_product', 'Select Product')}</label>
                  <select 
                    value={starProductId} 
                    onChange={e => setStarProductId(e.target.value)}
                    className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50"
                  >
                    <option value="">{t('admin.no_selection', 'No Selection')}</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#8892B0] mb-2">{t('admin.globe_settings', 'Globe Section Titles')}</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#8892B0] mb-1">{t('admin.globe_title', 'Top Title')}</label>
                  <input type="text" value={globeTitle} onChange={e => setGlobeTitle(e.target.value)} placeholder={t('home.globe_title')} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
                </div>
                <div>
                  <label className="block text-xs text-[#8892B0] mb-1">{t('admin.globe_subtitle', 'Top Subtitle')}</label>
                  <input type="text" value={globeSubtitle} onChange={e => setGlobeSubtitle(e.target.value)} placeholder={t('home.globe_subtitle')} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
                </div>
                <div>
                  <label className="block text-xs text-[#8892B0] mb-1">{t('admin.globe_bottom_title', 'Bottom Title')}</label>
                  <input type="text" value={globeBottomTitle} onChange={e => setGlobeBottomTitle(e.target.value)} placeholder={t('home.current_region')} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
                </div>
                <div>
                  <label className="block text-xs text-[#8892B0] mb-1">{t('admin.globe_bottom_subtitle', 'Bottom Subtitle')}</label>
                  <input type="text" value={globeBottomSubtitle} onChange={e => setGlobeBottomSubtitle(e.target.value)} placeholder={t('home.global_network')} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
                </div>
                <div>
                  <label className="block text-xs text-[#8892B0] mb-1">{t('home.export_regions')}</label>
                  <input type="text" value={statsRegions} onChange={e => setStatsRegions(e.target.value)} placeholder="45+" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
                </div>
                <div>
                  <label className="block text-xs text-[#8892B0] mb-1">{t('home.active_skus')}</label>
                  <input type="text" value={statsSkus} onChange={e => setStatsSkus(e.target.value)} placeholder="12.5k" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
                </div>
              </div>
            </div>
            
            {/* Catalog Download Section */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#8892B0] mb-2">{t('admin.catalog_settings', 'Catalog Download Settings')}</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#8892B0] mb-1">{t('admin.catalog_title_label', 'Catalog Display Title')}</label>
                  <input 
                    type="text" 
                    value={catalogTitle} 
                    onChange={e => setCatalogTitle(e.target.value)} 
                    placeholder={t('home.catalog_2026', 'Product Catalog 2026')}
                    className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" 
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#8892B0] mb-1">{t('admin.catalog_file', 'Catalog File (PDF)')}</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={catalogUrl} 
                      onChange={e => setCatalogUrl(e.target.value)} 
                      placeholder="https://example.com/catalog.pdf"
                      className="flex-1 px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" 
                    />
                    <label className="cursor-pointer px-3 py-2 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] transition-colors flex items-center shrink-0">
                      <Plus className="w-4 h-4 mr-1" />
                      <span className="text-xs">{t('admin.select_file')}</span>
                      <input type="file" className="sr-only" accept="application/pdf" onChange={e => handleFileUpload(e, setCatalogUrl, catalogUrl)} />
                    </label>
                  </div>
                  {catalogUrl && (
                    <button type="button" onClick={() => { deleteFileFromServer(catalogUrl); setCatalogUrl(''); }} className="mt-1 text-xs text-red-500 hover:underline">{t('admin.delete')}</button>
                  )}
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.whatsapp_link', 'WhatsApp Direct Link (e.g. wa.me link or full URL)')}</label>
              <input type="text" value={whatsappLink} onChange={e => setWhatsappLink(e.target.value)} placeholder="https://wa.me/8612345678901" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#8892B0] mb-2">{t('admin.whatsapp_qr_url')}</label>
              <div className="flex items-start gap-6">
                <label className="group relative flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-white/10 rounded-lg hover:border-[#FFB300]/50 bg-[#112240]/50 transition-all cursor-pointer overflow-hidden flex-shrink-0">
                  {whatsappQrUrl ? (
                    <>
                      <img src={whatsappQrUrl} alt="WhatsApp QR" className="w-full h-full object-contain p-2 bg-white" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Plus className="w-6 h-6 text-[#FFB300]" />
                      </div>
                    </>
                  ) : (
                    <Plus className="w-8 h-8 text-[#8892B0] group-hover:text-[#FFB300]" />
                  )}
                  <input type="file" className="sr-only" accept="image/*" onChange={e => handleFileUpload(e, setWhatsappQrUrl, whatsappQrUrl)} />
                </label>
                <div className="flex-1">
                  <input type="text" value={whatsappQrUrl} onChange={e => setWhatsappQrUrl(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none" />
                  <p className="mt-2 text-xs text-[#8892B0]">{t('admin.whatsapp_qr_hint', 'Upload WhatsApp contact QR code')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics & Working Hours */}
        <div className="bg-[#0A192F] p-6 rounded-lg border border-white/5 space-y-4">
          <h3 className="text-lg font-bold text-[#FFB300] mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2" /> {t('admin.analytics_settings', 'Analytics & Working Hours')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.meta_pixel_id', 'Meta (Facebook) Pixel ID')}</label>
              <input type="text" value={metaPixelId} onChange={e => setMetaPixelId(e.target.value)} placeholder="123456789012345" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm" />
              <p className="mt-1 text-xs text-[#8892B0]">{t('admin.meta_pixel_hint', 'Leave empty to disable. Tracks PageView on every route change and Lead on inquiry form submission.')}</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.fb_capi_token', 'Facebook Conversions API Access Token')}</label>
              <input type="password" value={fbCapiAccessToken} onChange={e => setFbCapiAccessToken(e.target.value)} placeholder="EAAGxxx..." className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm" />
              <p className="mt-1 text-xs text-[#8892B0]">{t('admin.fb_capi_hint', 'Server-side tracking via CAPI supplements the browser pixel, recovering 40-60% data lost to ad blockers and iOS privacy. Get this from Meta Events Manager → Settings → Generate Access Token.')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.fb_capi_test_code', 'Test Event Code (optional)')}</label>
              <input type="text" value={fbCapiTestCode} onChange={e => setFbCapiTestCode(e.target.value)} placeholder="TEST12345" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm" />
              <p className="mt-1 text-xs text-[#8892B0]">{t('admin.fb_capi_test_hint', 'Use during testing. Events will appear in Events Manager → Test Events tab. Remove after verification.')}</p>
            </div>
            <div className="md:col-span-2 border-t border-white/10 pt-4 mt-2">
              <h4 className="text-sm font-bold text-[#E6F1FF] mb-3">Google Analytics 4 + Google Ads</h4>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#8892B0] mb-1">GA4 Measurement ID</label>
              <input type="text" value={ga4MeasurementId} onChange={e => setGa4MeasurementId(e.target.value)} placeholder="G-XXXXXXXXXX" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm" />
              <p className="mt-1 text-xs text-[#8892B0]">Leave empty to disable. Get from Google Analytics → Admin → Data Streams → Measurement ID. Tracks page views and lead events.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">Google Ads Conversion ID</label>
              <input type="text" value={gadsConversionId} onChange={e => setGadsConversionId(e.target.value)} placeholder="AW-XXXXXXXXX" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm" />
              <p className="mt-1 text-xs text-[#8892B0]">Get from Google Ads → Tools → Conversions → Conversion ID (format: AW-123456789).</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">Google Ads Conversion Label</label>
              <input type="text" value={gadsConversionLabel} onChange={e => setGadsConversionLabel(e.target.value)} placeholder="AbCdEfGhIjK" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm" />
              <p className="mt-1 text-xs text-[#8892B0]">Get from the same conversion action settings. Required for conversion tracking to work with Google Ads.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.working_hours', 'Working Hours')}</label>
              <input type="text" value={workingHours} onChange={e => setWorkingHours(e.target.value)} placeholder="MON-FRI 09:00-18:00;SAT 10:00-14:00" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm" />
              <p className="mt-1 text-xs text-[#8892B0]">{t('admin.working_hours_hint', 'Format: MON-FRI 09:00-18:00;SAT 10:00-14:00. Separate multiple slots with semicolons.')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.working_hours_tz', 'Timezone')}</label>
              <select value={workingHoursTz} onChange={e => setWorkingHoursTz(e.target.value)} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 text-sm">
                <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
                <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
                <option value="Europe/London">Europe/London (UTC+0/+1)</option>
                <option value="Europe/Berlin">Europe/Berlin (UTC+1/+2)</option>
                <option value="America/New_York">America/New_York (UTC-5/-4)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (UTC-8/-7)</option>
                <option value="America/Sao_Paulo">America/Sao_Paulo (UTC-3)</option>
                <option value="Africa/Johannesburg">Africa/Johannesburg (UTC+2)</option>
                <option value="Australia/Sydney">Australia/Sydney (UTC+10/+11)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Email Notifications */}
        <div className="bg-[#0A192F] p-6 rounded-lg border border-white/5 space-y-4">
          <h3 className="text-lg font-bold text-[#FFB300] mb-4 flex items-center">
            <Mail className="w-5 h-5 mr-2" /> {t('admin.email_settings', 'Email Notifications')}
          </h3>
          <div className="space-y-4">
            <p className="text-xs text-[#8892B0]">{t('admin.email_provider_desc', 'Choose email provider: Resend (recommended, no SMTP needed) or traditional SMTP.')}</p>
            {/* Email Provider Toggle */}
            <div className="flex items-center gap-4 p-3 bg-[#112240] rounded-lg border border-white/10">
              <span className="text-sm text-[#8892B0] font-medium">{t('admin.email_provider', 'Provider')}:</span>
              <button type="button" onClick={() => setEmailProvider('resend')} className={`px-3 py-1.5 rounded text-sm font-medium transition ${emailProvider === 'resend' ? 'bg-[#FFB300] text-[#0A192F]' : 'bg-[#0A192F] text-[#8892B0] border border-white/10'}`}>Resend</button>
              <button type="button" onClick={() => setEmailProvider('smtp')} className={`px-3 py-1.5 rounded text-sm font-medium transition ${emailProvider === 'smtp' ? 'bg-[#FFB300] text-[#0A192F]' : 'bg-[#0A192F] text-[#8892B0] border border-white/10'}`}>SMTP</button>
            </div>
            {/* Resend Config */}
            {emailProvider === 'resend' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-[#8892B0] mb-1">Resend API Key</label>
                  <input type="password" value={resendApiKey} onChange={e => setResendApiKey(e.target.value)} placeholder="re_xxxxxxxx..." className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm" />
                  <p className="mt-1 text-xs text-[#8892B0]">{t('admin.resend_hint', 'Get your API key from resend.com/api-keys. Free tier: 100 emails/day.')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.resend_test_to', 'Test Recipient Email')}</label>
                  <div className="flex gap-2">
                    <input type="email" id="resendTestTo" defaultValue={notifyEmails?.split(/[,;]/)[0]?.trim() || ''} placeholder="you@example.com" className="flex-1 px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm" />
                    <button
                      type="button"
                      disabled={!resendApiKey || smtpTesting}
                      onClick={async () => {
                        const toEl = document.getElementById('resendTestTo') as HTMLInputElement;
                        const testTo = toEl?.value?.trim();
                        if (!testTo) { alert('Enter a recipient email'); return; }
                        setSmtpTesting(true);
                        setSmtpTestResult(null);
                        try {
                          const { apiUrl } = await import('../lib/api');
                          const res = await fetch(`${apiUrl}/api/send-email`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              resendApiKey,
                              to: testTo,
                              subject: '[Test] Resend Configuration — Vida Auto',
                              html: '<p>If you received this email, your Resend API is configured correctly! ✅</p>',
                            }),
                          });
                          setSmtpTestResult(res.ok ? 'success' : 'fail');
                        } catch {
                          setSmtpTestResult('fail');
                        } finally {
                          setSmtpTesting(false);
                        }
                      }}
                      className="px-4 py-2 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                    >
                      {smtpTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {t('admin.resend_test', 'Send Test')}
                    </button>
                  </div>
                  {smtpTestResult === 'success' && <span className="text-green-400 text-sm flex items-center gap-1 mt-1"><CheckCircle className="w-4 h-4" /> {t('admin.resend_test_ok', 'Test email sent via Resend!')}</span>}
                  {smtpTestResult === 'fail' && <span className="text-red-400 text-sm mt-1">{t('admin.resend_test_fail', 'Failed. Check API key and recipient.')}</span>}
                </div>
              </div>
            )}
            {/* SMTP Config */}
            {emailProvider === 'smtp' && (<div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#8892B0] mb-1">SMTP Host</label>
                <input type="text" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8892B0] mb-1">Port</label>
                <input type="text" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.smtp_user', 'SMTP Username / Email')}</label>
                <input type="text" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="noreply@yourdomain.com" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.smtp_pass', 'SMTP Password / App Password')}</label>
                <input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={smtpSecure} onChange={e => setSmtpSecure(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-[#112240] border border-white/10 rounded-full peer peer-checked:bg-[#FFB300] peer-checked:border-[#FFB300] after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
              <span className="text-sm text-[#8892B0]">SSL/TLS ({t('admin.smtp_secure_hint', 'Enable for port 465, disable for 587 with STARTTLS')})</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!smtpHost || !smtpUser || !smtpPass || smtpTesting}
                onClick={async () => {
                  setSmtpTesting(true);
                  setSmtpTestResult(null);
                  try {
                    const { apiUrl } = await import('../lib/api');
                    const res = await fetch(`${apiUrl}/api/send-email`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        smtp: { host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass, secure: smtpSecure },
                        to: smtpUser,
                        subject: '[Test] SMTP Configuration — Vida Auto',
                        html: '<p>If you received this email, your SMTP settings are configured correctly! ✅</p>',
                      }),
                    });
                    setSmtpTestResult(res.ok ? 'success' : 'fail');
                  } catch {
                    setSmtpTestResult('fail');
                  } finally {
                    setSmtpTesting(false);
                  }
                }}
                className="px-4 py-2 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {smtpTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {t('admin.smtp_test', 'Send Test Email')}
              </button>
              {smtpTestResult === 'success' && <span className="text-green-400 text-sm flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {t('admin.smtp_test_ok', 'Test email sent to your SMTP address!')}</span>}
              {smtpTestResult === 'fail' && <span className="text-red-400 text-sm">{t('admin.smtp_test_fail', 'Failed. Check host, credentials, and port.')}</span>}
            </div>
            </div>)}
            <hr className="border-white/5" />
            <h4 className="text-sm font-bold text-[#E6F1FF]">{t('admin.notification_rules', 'Notification Rules')}</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={emailNotifyEnabled} onChange={e => setEmailNotifyEnabled(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-[#112240] border border-white/10 rounded-full peer peer-checked:bg-[#FFB300] peer-checked:border-[#FFB300] after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
                <span className={`text-sm font-medium ${emailNotifyEnabled ? 'text-[#FFB300]' : 'text-[#8892B0]'}`}>
                  {t('admin.notify_admin', 'Notify admin/sales on new inquiry')}
                </span>
              </div>
              {emailNotifyEnabled && (
                <div>
                  <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.notify_emails', 'Notification Emails (comma-separated)')}</label>
                  <input type="text" value={notifyEmails} onChange={e => setNotifyEmails(e.target.value)} placeholder="sales@vidaauto.com, boss@vidaauto.com" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={emailAutoReplyEnabled} onChange={e => setEmailAutoReplyEnabled(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-[#112240] border border-white/10 rounded-full peer peer-checked:bg-[#FFB300] peer-checked:border-[#FFB300] after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
                <span className={`text-sm font-medium ${emailAutoReplyEnabled ? 'text-[#FFB300]' : 'text-[#8892B0]'}`}>
                  {t('admin.auto_reply', 'Auto-reply confirmation to customer')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CRM Webhook Integration */}
        <div className="bg-[#0A192F] p-6 rounded-lg border border-white/5 space-y-4">
          <h3 className="text-lg font-bold text-[#FFB300] mb-4 flex items-center">
            <MessageSquare className="w-5 h-5 mr-2" /> {t('admin.crm_integration', 'CRM Webhook Integration')}
          </h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={crmWebhookEnabled} onChange={e => setCrmWebhookEnabled(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-[#112240] border border-white/10 rounded-full peer peer-checked:bg-[#FFB300] peer-checked:border-[#FFB300] after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
              <span className={`text-sm font-medium ${crmWebhookEnabled ? 'text-[#FFB300]' : 'text-[#8892B0]'}`}>
                {crmWebhookEnabled ? t('admin.crm_enabled', 'CRM Push Enabled') : t('admin.crm_disabled', 'CRM Push Disabled')}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.crm_webhook_url', 'Webhook URL (POST)')}</label>
              <input type="text" value={crmWebhookUrl} onChange={e => setCrmWebhookUrl(e.target.value)} placeholder="https://crm.example.com/api/leads" className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm" />
              <p className="mt-1 text-xs text-[#8892B0]">{t('admin.crm_webhook_hint', 'Each form submission will POST a JSON payload to this URL.')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.crm_webhook_headers', 'Custom Headers (JSON)')}</label>
              <textarea value={crmWebhookHeaders} onChange={e => setCrmWebhookHeaders(e.target.value)} placeholder='{"X-API-Key": "your-secret-key", "Authorization": "Bearer xxx"}' rows={3} className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 font-mono text-sm resize-none" />
              <p className="mt-1 text-xs text-[#8892B0]">{t('admin.crm_headers_hint', 'Optional. Add authentication headers your CRM API requires. Must be valid JSON.')}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!crmWebhookUrl || webhookTesting}
                onClick={async () => {
                  setWebhookTesting(true);
                  setWebhookTestResult(null);
                  try {
                    const extraHeaders = crmWebhookHeaders ? JSON.parse(crmWebhookHeaders) : {};
                    const res = await fetch(crmWebhookUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...extraHeaders },
                      body: JSON.stringify({
                        name: 'Test User',
                        company: 'Test Company',
                        email: 'test@example.com',
                        phone: '+8613800138000',
                        vehicleModel: 'Toyota Camry 2024',
                        partNeed: 'Brake Pads',
                        quantity: '100',
                        message: 'This is a test inquiry from Vida Auto admin panel.',
                        source: 'webhook_test',
                        createdAt: new Date().toISOString(),
                      }),
                    });
                    setWebhookTestResult(res.ok ? 'success' : 'fail');
                  } catch {
                    setWebhookTestResult('fail');
                  } finally {
                    setWebhookTesting(false);
                  }
                }}
                className="px-4 py-2 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {webhookTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {t('admin.crm_test', 'Send Test Payload')}
              </button>
              {webhookTestResult === 'success' && <span className="text-green-400 text-sm flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {t('admin.crm_test_ok', 'Success! CRM received the test.')}</span>}
              {webhookTestResult === 'fail' && <span className="text-red-400 text-sm">{t('admin.crm_test_fail', 'Failed. Check URL, headers, and CORS settings.')}</span>}
            </div>
          </div>
          <div className="mt-4 p-4 bg-[#112240] rounded-lg border border-white/5">
            <h4 className="text-xs text-[#8892B0] uppercase tracking-wider font-bold mb-2">{t('admin.crm_payload_preview', 'Payload Format (JSON)')}</h4>
            <pre className="text-xs text-[#E6F1FF]/70 font-mono whitespace-pre overflow-x-auto">{`{
  "name": "John Doe",
  "company": "ABC Motors",
  "email": "john@abc.com",
  "phone": "+8613800138000",
  "vehicleModel": "Toyota Camry 2024",
  "partNeed": "Brake Pads",
  "quantity": "500",
  "message": "Need OEM quality...",
  "source": "home_inquiry_form",
  "createdAt": "2025-05-19T04:00:00.000Z"
}`}</pre>
          </div>
        </div>

        {/* Social Links */}
        <div className="bg-[#0A192F] p-6 rounded-lg border border-white/5 space-y-4">
          <h3 className="text-lg font-bold text-[#FFB300] mb-4 flex items-center">
            <Share2 className="w-5 h-5 mr-2" /> {t('admin.social_links', 'Social Media Links')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">Facebook URL</label>
              <input type="text" value={facebook} onChange={e => setFacebook(e.target.value)} placeholder="https://facebook.com/..." className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">Twitter URL</label>
              <input type="text" value={twitter} onChange={e => setTwitter(e.target.value)} placeholder="https://twitter.com/..." className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">Instagram URL</label>
              <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="https://instagram.com/..." className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">LinkedIn URL</label>
              <input type="text" value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" />
            </div>
          </div>
        </div>

        {/* Features Layout Setting */}
        <div className="bg-[#0A192F] p-6 rounded-lg border border-white/5 space-y-4">
          <h3 className="text-lg font-bold text-[#FFB300] mb-4 flex items-center">
            <Layers className="w-5 h-5 mr-2" /> {t('admin.layout_settings', 'Layout Settings')}
          </h3>
          <div>
            <label className="block text-sm font-medium text-[#8892B0] mb-2">{t('admin.features_layout', 'Partnership & Features Layout Style')}</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button 
                type="button"
                onClick={() => setFeaturesLayout('classic')}
                className={`p-4 border rounded-xl text-left transition-all ${featuresLayout === 'classic' ? 'border-[#FFB300] bg-[#FFB300]/10 shadow-[0_0_15px_rgba(255,179,0,0.2)]' : 'border-white/10 bg-[#112240] hover:border-white/20'}`}
              >
                <div className="font-bold text-[#E6F1FF] mb-1">{t('admin.layout_classic', 'Classic')}</div>
                <div className="text-xs text-[#8892B0]">{t('admin.layout_classic_desc', 'Standard stacked layout with indicators above and features below.')}</div>
              </button>
              <button 
                type="button"
                onClick={() => setFeaturesLayout('modern')}
                className={`p-4 border rounded-xl text-left transition-all ${featuresLayout === 'modern' ? 'border-[#FFB300] bg-[#FFB300]/10 shadow-[0_0_15px_rgba(255,179,0,0.2)]' : 'border-white/10 bg-[#112240] hover:border-white/20'}`}
              >
                <div className="font-bold text-[#E6F1FF] mb-1">{t('admin.layout_modern', 'Modern')}</div>
                <div className="text-xs text-[#8892B0]">{t('admin.layout_modern_desc', 'Alternating layout with decorative elements.')}</div>
              </button>
              <button 
                type="button"
                onClick={() => setFeaturesLayout('split')}
                className={`p-4 border rounded-xl text-left transition-all ${featuresLayout === 'split' ? 'border-[#FFB300] bg-[#FFB300]/10 shadow-[0_0_15px_rgba(255,179,0,0.2)]' : 'border-white/10 bg-[#112240] hover:border-white/20'}`}
              >
                <div className="font-bold text-[#E6F1FF] mb-1">{t('admin.layout_split', 'Split')}</div>
                <div className="text-xs text-[#8892B0]">{t('admin.layout_split_desc', 'Sidebar layout where key indicators focus on one side.')}</div>
              </button>
            </div>
          </div>
        </div>

        {/* Branding Assets */}
        <div className="bg-[#0A192F] p-6 rounded-lg border border-white/5 space-y-6">
          <h3 className="text-lg font-bold text-[#FFB300] mb-4 flex items-center">
            <Package className="w-5 h-5 mr-2" /> {t('admin.branding_settings', 'Branding & Visuals')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Hero Banner Component */}
            <div className="space-y-6">
              <h4 className="text-md font-medium text-[#E6F1FF]">{t('admin.hero_banner')}</h4>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[#8892B0] mb-2">{t('admin.bg_video_url')} ({t('admin.video_hint', 'MP4')}, {t('admin.video_size_hint', 'Max 15MB')})</label>
                  <div className="flex gap-2 mb-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Activity className="h-4 w-4 text-[#8892B0]" />
                      </div>
                      <input 
                        type="text" 
                        value={heroVideoUrl} 
                        onChange={e => setHeroVideoUrl(e.target.value)} 
                        placeholder="https://example.com/video.mp4"
                        className="w-full pl-10 pr-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" 
                      />
                    </div>
                    <label className="cursor-pointer px-3 py-2 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] transition-colors flex items-center shrink-0">
                      <Plus className="w-4 h-4 mr-1" />
                      <span className="text-xs">{t('admin.select_file')}</span>
                      <input type="file" className="sr-only" accept="video/mp4" onChange={e => handleFileUpload(e, setHeroVideoUrl, heroVideoUrl)} />
                    </label>
                  </div>
                  <p className="text-xs text-[#8892B0]">{t('admin.video_hint')}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#8892B0] mb-2">{t('admin.bg_image_url')}</label>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FileText className="h-4 w-4 text-[#8892B0]" />
                        </div>
                        <input 
                          type="text" 
                          value={heroBgUrl} 
                          onChange={e => setHeroBgUrl(e.target.value)} 
                          placeholder="https://example.com/hero-bg.jpg"
                          className="w-full pl-10 pr-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" 
                        />
                      </div>
                      {heroBgUrl && (
                        <button 
                          type="button" 
                          onClick={() => { 
                            if (window.confirm(t('admin.confirm_delete'))) {
                              deleteFileFromServer(heroBgUrl); 
                              setHeroBgUrl(''); 
                            }
                          }}
                          className="px-3 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    <label className="group relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-lg hover:border-[#FFB300]/50 bg-[#112240]/50 transition-all cursor-pointer overflow-hidden">
                      {heroBgUrl ? (
                        <>
                          <img src={heroBgUrl} alt="Hero Preview" className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" />
                          <div className="relative z-10 flex flex-col items-center">
                            <Plus className="w-6 h-6 text-[#FFB300] mb-1" />
                            <span className="text-xs text-[#E6F1FF] font-medium">{t('admin.replace_image', 'Replace Image')}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center">
                          <Plus className="w-8 h-8 text-[#8892B0] group-hover:text-[#FFB300] transition-colors mb-2" />
                          <span className="text-xs text-[#8892B0] group-hover:text-[#FFB300]">{t('admin.upload_image')}</span>
                        </div>
                      )}
                      <input type="file" className="sr-only" accept="image/*" onChange={e => handleFileUpload(e, setHeroBgUrl, heroBgUrl)} />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Navbar Logo Component */}
            <div className="space-y-6">
              <h4 className="text-md font-medium text-[#E6F1FF]">{t('admin.navbar_logo')}</h4>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <ShieldCheck className="h-4 w-4 text-[#8892B0]" />
                    </div>
                    <input 
                      type="text" 
                      value={logoUrl} 
                      onChange={e => setLogoUrl(e.target.value)} 
                      placeholder="https://example.com/logo.png"
                      className="w-full pl-10 pr-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" 
                    />
                  </div>
                  {logoUrl && (
                    <button 
                      type="button" 
                      onClick={() => { 
                        if (window.confirm(t('admin.confirm_delete'))) {
                          deleteFileFromServer(logoUrl); 
                          setLogoUrl(''); 
                        }
                      }}
                      className="px-3 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <label className="group relative flex flex-col items-center justify-center w-full min-h-[100px] border-2 border-dashed border-white/10 rounded-lg hover:border-[#FFB300]/50 bg-[#112240]/50 transition-all cursor-pointer overflow-hidden p-4">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo Preview" className="max-h-20 w-auto object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <div className="flex flex-col items-center">
                      <Plus className="w-6 h-6 text-[#8892B0] group-hover:text-[#FFB300] transition-colors mb-1" />
                      <span className="text-xs text-[#8892B0] group-hover:text-[#FFB300]">{t('admin.upload_image')}</span>
                    </div>
                  )}
                  <input type="file" className="sr-only" accept="image/*" onChange={e => handleFileUpload(e, setLogoUrl, logoUrl)} />
                </label>
              </div>
            </div>

            {/* Stats Background Component */}
            <div className="space-y-6 md:col-span-2">
              <h4 className="text-md font-medium text-[#E6F1FF]">{t('admin.stats_bg')}</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-[#8892B0] mb-2">{t('admin.stats_video_url', 'Background Video (Priority)')} ({t('admin.video_hint', 'MP4')}, {t('admin.video_size_hint', 'Max 15MB')})</label>
                    <div className="flex gap-2 mb-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Activity className="h-4 w-4 text-[#8892B0]" />
                        </div>
                        <input 
                          type="text" 
                          value={statsVideoUrl} 
                          onChange={e => setStatsVideoUrl(e.target.value)} 
                          placeholder="https://example.com/video.mp4"
                          className="w-full pl-10 pr-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 text-sm" 
                        />
                      </div>
                      <label className="cursor-pointer px-3 py-2 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] transition-colors flex items-center shrink-0">
                        <Plus className="w-4 h-4 mr-1" />
                        <span className="text-xs">{t('admin.select_file')}</span>
                        <input type="file" className="sr-only" accept="video/mp4" onChange={e => handleFileUpload(e, setStatsVideoUrl, statsVideoUrl)} />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#8892B0] mb-2">{t('admin.stats_bg_url', 'Fallback Image')}</label>
                    <div className="flex gap-2 mb-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <MapPin className="h-4 w-4 text-[#8892B0]" />
                        </div>
                        <input 
                          type="text" 
                          value={statsBgUrl} 
                          onChange={e => setStatsBgUrl(e.target.value)} 
                          placeholder="https://example.com/bg.jpg"
                          className="w-full pl-10 pr-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 text-sm" 
                        />
                      </div>
                      <label className="cursor-pointer px-3 py-2 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] transition-colors flex items-center shrink-0">
                        <Plus className="w-4 h-4 mr-1" />
                        <span className="text-xs">{t('admin.select_file')}</span>
                        <input type="file" className="sr-only" accept="image/*" onChange={e => handleFileUpload(e, setStatsBgUrl, statsBgUrl)} />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="group relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-lg hover:border-[#FFB300]/50 bg-[#112240]/50 transition-all cursor-pointer overflow-hidden">
                    {statsVideoUrl ? (
                      <div className="flex flex-col items-center">
                        <Video className="w-8 h-8 text-[#FFB300] mb-2" />
                        <span className="text-xs text-[#E6F1FF] font-medium">{t('admin.video_uploaded', 'Video Uploaded')}</span>
                        <button type="button" onClick={() => { deleteFileFromServer(statsVideoUrl); setStatsVideoUrl(''); }} className="mt-2 text-xs text-red-500 hover:underline">{t('admin.delete')}</button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center opacity-40">
                        <Video className="w-8 h-8 text-[#8892B0] mb-2" />
                        <span className="text-xs text-[#8892B0]">{t('admin.no_video', 'No Video')}</span>
                      </div>
                    )}
                  </div>

                  <div className="group relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-lg hover:border-[#FFB300]/50 bg-[#112240]/50 transition-all cursor-pointer overflow-hidden">
                    {statsBgUrl ? (
                      <>
                        <div className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity" style={{ backgroundImage: `url(${statsBgUrl})` }}></div>
                        <button type="button" onClick={() => { deleteFileFromServer(statsBgUrl); setStatsBgUrl(''); }} className="relative z-10 text-xs text-red-500 hover:underline bg-[#0A192F]/80 px-2 py-1 rounded">{t('admin.delete')}</button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center opacity-40">
                        <Plus className="w-8 h-8 text-[#8892B0] mb-2" />
                        <span className="text-xs text-[#8892B0]">{t('admin.no_image', 'No Image')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Overlay Text */}
            <div className="space-y-3 md:col-span-2">
              <label className="block text-sm font-medium text-[#8892B0]">{t('admin.stats_overlay_text', 'Video Overlay Text (floating banner)')}</label>
              <input 
                type="text" 
                value={statsOverlayText} 
                onChange={e => setStatsOverlayText(e.target.value)} 
                placeholder={t('admin.stats_overlay_placeholder', 'e.g. Premium Packaging · Safe Delivery Guaranteed')}
                className="w-full px-4 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 text-sm" 
              />
              <p className="text-xs text-[#8892B0]">{t('admin.stats_overlay_hint', 'Displayed as a floating transparent banner on top of the video. Leave empty to hide.')}</p>
            </div>

            {/* Story Section Background Component */}
            <div className="space-y-6 md:col-span-2">
              <h4 className="text-md font-medium text-[#E6F1FF]">{t('admin.story_bg', 'Story Section Background')}</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-[#8892B0] mb-2">{t('admin.story_video_url', 'Story Video (Priority)')} ({t('admin.video_hint', 'MP4')}, {t('admin.video_size_hint', 'Max 15MB')})</label>
                    <div className="flex gap-2 mb-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Video className="h-4 w-4 text-[#8892B0]" />
                        </div>
                        <input 
                          type="text" 
                          value={storyVideoUrl} 
                          onChange={e => setStoryVideoUrl(e.target.value)} 
                          placeholder="https://example.com/story.mp4"
                          className="w-full pl-10 pr-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 text-sm" 
                        />
                      </div>
                      <label className="cursor-pointer px-3 py-2 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] transition-colors flex items-center shrink-0">
                        <Plus className="w-4 h-4 mr-1" />
                        <span className="text-xs">{t('admin.select_file')}</span>
                        <input type="file" className="sr-only" accept="video/mp4" onChange={e => handleFileUpload(e, setStoryVideoUrl, storyVideoUrl)} />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#8892B0] mb-2">{t('admin.story_bg_url', 'Story Image (Fallback)')}</label>
                    <div className="flex gap-2 mb-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <ImageIcon className="h-4 w-4 text-[#8892B0]" />
                        </div>
                        <input 
                          type="text" 
                          value={storyBgUrl} 
                          onChange={e => setStoryBgUrl(e.target.value)} 
                          placeholder="https://example.com/story.jpg"
                          className="w-full pl-10 pr-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 text-sm" 
                        />
                      </div>
                      <label className="cursor-pointer px-3 py-2 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] transition-colors flex items-center shrink-0">
                        <Plus className="w-4 h-4 mr-1" />
                        <span className="text-xs">{t('admin.select_file')}</span>
                        <input type="file" className="sr-only" accept="image/*" onChange={e => handleFileUpload(e, setStoryBgUrl, storyBgUrl)} />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="group relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-lg hover:border-[#FFB300]/50 bg-[#112240]/50 transition-all cursor-pointer overflow-hidden">
                    {storyVideoUrl ? (
                      <div className="flex flex-col items-center">
                        <Video className="w-8 h-8 text-[#FFB300] mb-2" />
                        <span className="text-xs text-[#E6F1FF] font-medium">{t('admin.video_uploaded')}</span>
                        <button type="button" onClick={() => { deleteFileFromServer(storyVideoUrl); setStoryVideoUrl(''); }} className="mt-2 text-xs text-red-500 hover:underline">{t('admin.delete')}</button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center opacity-40">
                        <Video className="w-8 h-8 text-[#8892B0] mb-2" />
                        <span className="text-xs text-[#8892B0]">{t('admin.no_video')}</span>
                      </div>
                    )}
                  </div>

                  <div className="group relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-lg hover:border-[#FFB300]/50 bg-[#112240]/50 transition-all cursor-pointer overflow-hidden">
                    {storyBgUrl ? (
                      <>
                        <div className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity" style={{ backgroundImage: `url(${storyBgUrl})` }}></div>
                        <button type="button" onClick={() => { deleteFileFromServer(storyBgUrl); setStoryBgUrl(''); }} className="relative z-10 text-xs text-red-500 hover:underline bg-[#0A192F]/80 px-2 py-1 rounded">{t('admin.delete')}</button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center opacity-40">
                        <Plus className="w-8 h-8 text-[#8892B0] mb-2" />
                        <span className="text-xs text-[#8892B0]">{t('admin.no_image')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Factory Page Background Component */}
            <div className="space-y-6 md:col-span-2">
              <h4 className="text-md font-medium text-[#E6F1FF]">{t('admin.factory_bg', 'Factory Page Background')}</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-[#8892B0] mb-2">{t('admin.factory_video_url', 'Factory Video')} ({t('admin.video_hint', 'MP4')}, {t('admin.video_size_hint', 'Max 15MB')})</label>
                    <div className="flex gap-2 mb-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Video className="h-4 w-4 text-[#8892B0]" />
                        </div>
                        <input 
                          type="text" 
                          value={factoryVideoUrl} 
                          onChange={e => setFactoryVideoUrl(e.target.value)} 
                          placeholder="https://example.com/factory.mp4"
                          className="w-full pl-10 pr-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 text-sm" 
                        />
                      </div>
                      <label className="cursor-pointer px-3 py-2 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] transition-colors flex items-center shrink-0">
                        <Plus className="w-4 h-4 mr-1" />
                        <span className="text-xs">{t('admin.select_file')}</span>
                        <input type="file" className="sr-only" accept="video/mp4" onChange={e => handleFileUpload(e, setFactoryVideoUrl, factoryVideoUrl)} />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#8892B0] mb-2">{t('admin.factory_bg_url', 'Factory Image (Fallback)')}</label>
                    <div className="flex gap-2 mb-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <ImageIcon className="h-4 w-4 text-[#8892B0]" />
                        </div>
                        <input 
                          type="text" 
                          value={factoryBgUrl} 
                          onChange={e => setFactoryBgUrl(e.target.value)} 
                          placeholder="https://example.com/factory.jpg"
                          className="w-full pl-10 pr-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 text-sm" 
                        />
                      </div>
                      <label className="cursor-pointer px-3 py-2 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] transition-colors flex items-center shrink-0">
                        <Plus className="w-4 h-4 mr-1" />
                        <span className="text-xs">{t('admin.select_file')}</span>
                        <input type="file" className="sr-only" accept="image/*" onChange={e => handleFileUpload(e, setFactoryBgUrl, factoryBgUrl)} />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="group relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-lg hover:border-[#FFB300]/50 bg-[#112240]/50 transition-all cursor-pointer overflow-hidden">
                    {factoryVideoUrl ? (
                      <div className="flex flex-col items-center">
                        <Video className="w-8 h-8 text-[#FFB300] mb-2" />
                        <span className="text-xs text-[#E6F1FF] font-medium">{t('admin.video_uploaded')}</span>
                        <button type="button" onClick={() => { deleteFileFromServer(factoryVideoUrl); setFactoryVideoUrl(''); }} className="mt-2 text-xs text-red-500 hover:underline">{t('admin.delete')}</button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center opacity-40">
                        <Video className="w-8 h-8 text-[#8892B0] mb-2" />
                        <span className="text-xs text-[#8892B0]">{t('admin.no_video')}</span>
                      </div>
                    )}
                  </div>

                  <div className="group relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-lg hover:border-[#FFB300]/50 bg-[#112240]/50 transition-all cursor-pointer overflow-hidden">
                    {factoryBgUrl ? (
                      <>
                        <div className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity" style={{ backgroundImage: `url(${factoryBgUrl})` }}></div>
                        <button type="button" onClick={() => { deleteFileFromServer(factoryBgUrl); setFactoryBgUrl(''); }} className="relative z-10 text-xs text-red-500 hover:underline bg-[#0A192F]/80 px-2 py-1 rounded">{t('admin.delete')}</button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center opacity-40">
                        <Plus className="w-8 h-8 text-[#8892B0] mb-2" />
                        <span className="text-xs text-[#8892B0]">{t('admin.no_image')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-6">
          <button 
            type="submit" 
            disabled={isSaving}
            className={`px-8 py-3 bg-[#FFB300] text-[#0A192F] rounded-md font-bold hover:bg-[#FFCA28] transition-all flex items-center shadow-lg ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSaving ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <ShieldCheck className="w-5 h-5 mr-2" />}
            {isSaving ? t('admin.saving') : t('admin.save_settings')}
          </button>
        </div>
      </form>
    </div>
  );
}

function SystemHealthManager() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<any>(null);
  const [taskStatus, setTaskStatus] = useState<string>('idle');
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/health'));
      const data = await res.json();
      setHealth(data);
    } catch (error) {
      console.error("Error fetching health:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkTask = async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/task-status'));
      const data = await res.json();
      setTaskStatus(data.status);
    } catch (error) {
      console.error("Error checking task:", error);
    }
  };

  const runTask = async () => {
    try {
      await fetch(apiUrl('/api/admin/run-task'), { method: 'POST' });
      setTaskStatus('running');
    } catch (error) {
      console.error("Error running task:", error);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(checkTask, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-[#E6F1FF]">{t('admin.health_title')}</h2>
        <button onClick={fetchHealth} className="p-2 text-[#FFB300] hover:bg-[#0A192F] rounded-full transition-colors">
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {health && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0A192F] p-6 rounded-xl border border-white/5">
            <h3 className="text-[#8892B0] text-sm uppercase tracking-wider mb-4">{t('admin.api_status')}</h3>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
              <span className="text-[#E6F1FF] font-medium">{t('admin.backend_online')}</span>
            </div>
            <div className="mt-4 text-xs text-[#8892B0]">
              {t('admin.last_check')}: {new Date(health.timestamp).toLocaleString()}
            </div>
          </div>

          <div className="bg-[#0A192F] p-6 rounded-xl border border-white/5">
            <h3 className="text-[#8892B0] text-sm uppercase tracking-wider mb-4">{t('admin.background_tasks')}</h3>
            <div className="space-y-4">
              {health.backgroundTasks.map((task: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-[#E6F1FF] text-sm">{task.name}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    task.status === 'running' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {task.status} {task.progress && `(${task.progress})`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#0A192F] p-6 rounded-xl border border-white/5">
        <h3 className="text-[#8892B0] text-sm uppercase tracking-wider mb-4">{t('admin.manual_trigger')}</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`px-4 py-2 rounded-md text-sm font-medium ${
              taskStatus === 'running' ? 'bg-blue-500/20 text-blue-400' : 
              taskStatus === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
            }`}>
              {t('admin.task_status')}: {taskStatus === 'idle' ? t('admin.task_idle') : taskStatus === 'running' ? t('admin.task_running') : t('admin.task_completed')}
            </div>
            {taskStatus === 'running' && <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />}
          </div>
          <button 
            onClick={runTask}
            disabled={taskStatus === 'running'}
            className="px-6 py-2 bg-[#FFB300] text-[#0A192F] rounded-md font-bold hover:bg-[#FFCA28] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('admin.run_sync_task')}
          </button>
        </div>
        <p className="mt-4 text-xs text-[#8892B0]">
          {t('admin.sync_task_desc')}
        </p>
      </div>
    </div>
  );
}

function QualificationsManager() {
  const { t } = useTranslation();
  const [qualifications, setQualifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newQual, setNewQual] = useState({
    title: '',
    category: 'ISO Certification',
    fileUrl: '',
    fileName: ''
  });

  const categories = ['ISO Certification', 'CE Certification', 'Patents', 'Awards', 'Lighting System', 'Braking System', 'Filters', 'Exterior Parts', 'Others'];

  const fetchQualifications = async () => {
    setLoading(true);
    try {
      const q = collection(db, 'qualifications');
      const snapshot = await getDocs(q);
      setQualifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'qualifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQualifications();
  }, []);

  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      alert(`${t('admin.file_too_large')} (${(file.size / 1024 / 1024).toFixed(1)}MB). ${t('admin.content_too_large')}`);
      return;
    }
    setIsUploading(true);
    try {
      const url = await uploadFile(file, 'qualifications');
      setNewQual({ ...newQual, fileUrl: url, fileName: file.name });
    } catch (error: any) {
      console.error('Upload error in QualificationsManager:', error);
      alert(`${t('admin.upload_failed', 'Upload failed')}: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQual.fileUrl) {
      alert(t('admin.upload_file_error'));
      return;
    }

    try {
      await addDoc(collection(db, 'qualifications'), {
        ...newQual,
        createdAt: new Date().toISOString()
      });
      setIsAdding(false);
      setNewQual({ title: '', category: 'ISO Certification', fileUrl: '', fileName: '' });
      fetchQualifications();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'qualifications');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('admin.confirm_delete_qual'))) {
      try {
        const qual = qualifications.find(q => q.id === id);
        if (qual?.fileUrl) {
          const fileDeleted = await deleteFileFromServer(qual.fileUrl);
          if (!fileDeleted) {
            console.warn('Physical file deletion failed or file not found on server, continuing with database deletion.');
          }
        }
        await deleteDoc(doc(db, 'qualifications', id));
        fetchQualifications();
        alert(t('admin.delete_success', 'Deleted successfully'));
      } catch (error) {
        console.error('Delete error:', error);
        handleFirestoreError(error, OperationType.DELETE, 'qualifications');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-[#E6F1FF]">{t('admin.qualifications')}</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center px-4 py-2 bg-[#FFB300] text-[#0A192F] rounded-md hover:bg-[#FFCA28] text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" /> {t('admin.add_qualification')}
        </button>
      </div>

      {isAdding && (
        <div className="bg-[#0A192F] p-6 rounded-lg border border-white/5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[#E6F1FF]">{t('admin.add_new_qualification')}</h3>
            <button onClick={() => setIsAdding(false)} className="text-[#8892B0] hover:text-[#E6F1FF]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.qual_title')}</label>
                <input 
                  required 
                  type="text" 
                  value={newQual.title} 
                  onChange={e => setNewQual({...newQual, title: e.target.value})} 
                  className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.category')}</label>
                <select 
                  value={newQual.category} 
                  onChange={e => setNewQual({...newQual, category: e.target.value})} 
                  className="w-full px-3 py-2 border border-white/10 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{t(`admin.${cat.toLowerCase().replace(' ', '_')}`, cat)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('admin.upload_file_hint')}</label>
              <div className="flex items-center gap-4">
                <label className={`cursor-pointer flex items-center px-4 py-2 bg-[#112240] border border-white/10 text-[#FFB300] rounded-md hover:bg-[#0A192F] transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {isUploading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  {isUploading ? t('admin.uploading') : t('admin.select_file')}
                  <input type="file" className="sr-only" accept=".pdf,image/*" onChange={handleFileUpload} disabled={isUploading} />
                </label>
                {newQual.fileName && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#E6F1FF] truncate max-w-xs">{newQual.fileName}</span>
                    <button 
                      type="button"
                      onClick={async () => {
                        if (window.confirm(t('admin.confirm_delete'))) {
                          if (newQual.fileUrl) {
                            await deleteFileFromServer(newQual.fileUrl);
                          }
                          setNewQual({ ...newQual, fileUrl: '', fileName: '' });
                        }
                      }}
                      className="text-red-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <button type="submit" className="px-6 py-2 bg-[#FFB300] text-[#0A192F] rounded-md font-bold hover:bg-[#FFCA28] transition-colors">
                {t('admin.save_qualification')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map(category => {
          const catQuals = qualifications.filter(q => q.category === category);
          if (catQuals.length === 0 && !loading) return null;
          
          return (
            <div key={category} className="bg-[#0A192F] rounded-lg border border-white/5 overflow-hidden">
              <div className="px-4 py-3 bg-white/5 border-b border-white/5">
                <h3 className="text-[#FFB300] font-bold text-sm uppercase tracking-wider">{t(`admin.${category.toLowerCase().replace(' ', '_')}`, category)}</h3>
              </div>
              <div className="p-4 space-y-3">
                {catQuals.map(q => (
                  <div key={q.id} className="flex items-center justify-between group">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <FileDown className="w-4 h-4 text-[#8892B0] shrink-0" />
                      <a 
                        href={q.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[#E6F1FF] text-sm truncate hover:text-[#FFB300] transition-colors"
                      >
                        {q.title}
                      </a>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleDelete(q.id)}
                        className="p-1 text-[#8892B0] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {catQuals.length === 0 && (
                  <div className="text-xs text-[#8892B0] italic">{t('admin.no_qualifications')}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {loading && (
        <div className="text-center py-12 text-[#8892B0]">{t('admin.loading')}</div>
      )}
    </div>
  );
}


