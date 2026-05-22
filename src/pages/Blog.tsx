import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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

export default function Blog() {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'blogPosts'), orderBy('publishedAt', 'desc')));
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BlogPost)));
      } catch (e) {
        console.error('Error fetching blog posts:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  const categories = [...new Set(posts.map(p => p.category).filter(Boolean))];
  const filteredPosts = selectedCategory ? posts.filter(p => p.category === selectedCategory) : posts;

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

      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-[#E6F1FF] mb-3">
          <BookOpen className="inline w-8 h-8 mr-2 text-[#FFB300]" />
          {t('blog.title', 'Auto Parts Blog')}
        </h1>
        <p className="text-[#8892B0] text-lg">{t('blog.subtitle', 'Expert guides, how-to articles, and industry insights')}</p>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!selectedCategory ? 'bg-[#FFB300] text-[#0A192F]' : 'bg-[#112240] text-[#8892B0] hover:text-white border border-white/10'}`}
          >
            {t('blog.all', 'All')}
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategory === cat ? 'bg-[#FFB300] text-[#0A192F]' : 'bg-[#112240] text-[#8892B0] hover:text-white border border-white/10'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-[#8892B0]">{t('common.loading', 'Loading...')}</div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-16 h-16 text-[#8892B0]/30 mx-auto mb-4" />
          <p className="text-[#8892B0] text-lg">{t('blog.no_posts', 'No articles yet. Check back soon!')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map(post => (
            <Link
              key={post.id}
              to={`/blog/${post.slug || post.id}`}
              className="bg-[#112240] rounded-xl border border-white/5 overflow-hidden hover:border-[#FFB300]/50 transition-all hover:-translate-y-1 duration-300 group flex flex-col"
            >
              {post.coverImage ? (
                <div className="h-48 overflow-hidden">
                  <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              ) : (
                <div className="h-48 bg-gradient-to-br from-[#FFB300]/10 to-[#0A192F] flex items-center justify-center">
                  <BookOpen className="w-12 h-12 text-[#FFB300]/30" />
                </div>
              )}
              <div className="p-5 flex flex-col flex-1">
                {post.category && (
                  <span className="text-xs text-[#FFB300] font-medium mb-2 uppercase tracking-wide">{post.category}</span>
                )}
                <h2 className="text-lg font-semibold text-[#E6F1FF] mb-2 line-clamp-2 group-hover:text-[#FFB300] transition-colors">{post.title}</h2>
                <p className="text-sm text-[#8892B0] mb-4 flex-1 line-clamp-3">{post.excerpt}</p>
                <div className="flex items-center justify-between text-xs text-[#8892B0]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" />{post.publishedAt?.split('T')[0] || ''}</span>
                    {post.readTime && <span className="flex items-center"><Clock className="w-3 h-3 mr-1" />{post.readTime}</span>}
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#FFB300] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
