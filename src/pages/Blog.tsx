import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Calendar, Clock, ArrowRight, BookOpen } from 'lucide-react';
import SEO from '../components/SEO';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  category: string;
  readTime: string;
  publishedAt: string;
  author: string;
}

const CACHE_KEY = 'vida_blogPosts';

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-stone-100 overflow-hidden flex flex-col animate-pulse">
      <div className="h-48 bg-stone-100" />
      <div className="p-5 flex flex-col gap-3">
        <div className="h-3 w-24 bg-stone-200 rounded" />
        <div className="h-5 w-full bg-stone-200 rounded" />
        <div className="h-5 w-3/4 bg-stone-200 rounded" />
        <div className="h-3 w-full bg-stone-100 rounded mt-1" />
        <div className="h-3 w-2/3 bg-stone-100 rounded" />
      </div>
    </div>
  );
}

export default function Blog() {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<BlogPost[]>(() => {
    const buildTimePosts = (typeof window !== 'undefined' && (window as any).__BLOG_POSTS__) || [];
    let localPosts: BlogPost[] = [];
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) localPosts = JSON.parse(cached);
    } catch {}

    if (buildTimePosts.length > 0 && localPosts.length > 0) {
      const buildTimeLatest = Math.max(...buildTimePosts.map((p: any) => new Date(p.publishedAt || 0).getTime()));
      const localLatest = Math.max(...localPosts.map((p: any) => new Date(p.publishedAt || 0).getTime()));
      return localLatest >= buildTimeLatest ? localPosts : buildTimePosts;
    }
    return localPosts.length > 0 ? localPosts : buildTimePosts;
  });
  const [loading, setLoading] = useState(posts.length === 0);
  const [searchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'blogPosts'), orderBy('publishedAt', 'desc')));
        const fresh = snap.docs.map(d => ({ id: d.id, ...d.data() } as BlogPost));
        setPosts(fresh);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(fresh)); } catch {}
      } catch (e) {
        console.error('Error fetching blog posts:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  const categories = [...new Set(posts.map(p => p.category).filter(Boolean))];
  const filteredPosts = selectedCategory
    ? posts.filter(p => p.category && p.category.toLowerCase().includes(selectedCategory.toLowerCase()))
    : posts;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Vida Auto Blog - Auto Parts Guides & Tips',
    description: 'Expert guides on choosing, installing, and maintaining auto parts. How-to articles for headlight covers, bulbs, and more.',
    url: 'https://autoparts.fit/blog',
    publisher: {
      '@type': 'Organization',
      name: 'Guangzhou Vida Auto Parts Co., Ltd.',
      url: 'https://autoparts.fit',
    },
  };

  return (
    <div>
      {/* Hero Banner */}
      <div className="relative w-full h-[320px] md:h-[400px] overflow-hidden">
        <img
          src="https://picsum.photos/seed/vida-blog-hero/1920/600"
          alt="Blog"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{t('blog.title', 'Auto Parts Blog')}</h1>
          <p className="text-white/80 max-w-xl text-sm md:text-base">{t('blog.subtitle', 'Expert guides, how-to articles, and industry insights')}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <SEO
          title="Auto Parts Blog - How-to Guides & Industry Tips | Vida Auto"
          description="Expert guides on choosing, installing, and maintaining auto parts. Learn how to select headlight covers, bulbs, brake pads, and more."
          path="/blog"
          jsonLd={jsonLd}
          breadcrumbs={[
            { name: 'Home', url: '/' },
            { name: 'Blog', url: '/blog' },
          ]}
        />

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!selectedCategory ? 'bg-brand text-white' : 'bg-white text-charcoal/60 hover:text-charcoal border border-stone-200'}`}
          >
            {t('blog.all', 'All')}
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategory === cat ? 'bg-brand text-white' : 'bg-white text-charcoal/60 hover:text-charcoal border border-stone-200'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-16 h-16 text-charcoal/60/30 mx-auto mb-4" />
          <p className="text-charcoal/60 text-lg">{t('blog.no_posts', 'No articles yet. Check back soon!')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map(post => (
            <Link
              key={post.id}
              to={`/blog/${post.slug || post.id}`}
              className="bg-white rounded-xl border border-stone-100 overflow-hidden hover:border-brand/50 transition-all hover:-translate-y-1 duration-300 group flex flex-col"
            >
              {post.coverImage ? (
                <div className="h-48 overflow-hidden">
                  <img src={post.coverImage} alt={post.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              ) : (
                <div className="h-48 bg-gradient-to-br from-brand/10 to-cream flex items-center justify-center">
                  <BookOpen className="w-12 h-12 text-brand/30" />
                </div>
              )}
              <div className="p-5 flex flex-col flex-1">
                {post.category && (
                  <span className="text-xs text-brand font-medium mb-2 uppercase tracking-wide">{post.category}</span>
                )}
                <h2 className="text-lg font-semibold text-charcoal mb-2 line-clamp-2 group-hover:text-brand transition-colors">{post.title}</h2>
                <p className="text-sm text-charcoal/60 mb-4 flex-1 line-clamp-3">{post.excerpt}</p>
                <div className="flex items-center justify-between text-xs text-charcoal/60">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" />{post.publishedAt?.split('T')[0] || ''}</span>
                    {post.readTime && <span className="flex items-center"><Clock className="w-3 h-3 mr-1" />{post.readTime}</span>}
                  </div>
                  <ArrowRight className="w-4 h-4 text-brand opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
    </div>
  );
}
