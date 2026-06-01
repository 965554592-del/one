import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Calendar, Clock, ArrowLeft, User } from 'lucide-react';
import SEO from '../components/SEO';
import { trackEvent } from '../lib/pixel';
import { gtagEvent } from '../lib/gtag';

interface BlogPostData {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  coverImage: string;
  category: string;
  readTime: string;
  publishedAt: string;
  author: string;
  tags: string[];
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const [post, setPost] = useState<BlogPostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) return;
      try {
        // Try by slug first
        const q = query(collection(db, 'blogPosts'), where('slug', '==', slug));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setPost({ id: snap.docs[0].id, ...snap.docs[0].data() } as BlogPostData);
        } else {
          // Fallback: try by document ID
          const docSnap = await getDoc(doc(db, 'blogPosts', slug));
          if (docSnap.exists()) {
            setPost({ id: docSnap.id, ...docSnap.data() } as BlogPostData);
          }
        }
      } catch (e) {
        console.error('Error fetching blog post:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [slug]);

  // Track article view once post is loaded
  useEffect(() => {
    if (!post) return;
    trackEvent('ViewContent', {
      content_ids: [post.id],
      content_name: post.title,
      content_category: post.category || 'blog',
      content_type: 'article',
    });
    gtagEvent('select_content', {
      content_type: 'article',
      item_id: post.id,
      item_name: post.title,
      category: post.category,
    });
  }, [post]);

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-12 text-center text-[#8892B0]">{t('common.loading', 'Loading...')}</div>;
  }

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-[#E6F1FF] mb-4">{t('blog.not_found', 'Article not found')}</h1>
        <Link to="/blog" className="text-[#FFB300] hover:underline">{t('blog.back_to_blog', '← Back to Blog')}</Link>
      </div>
    );
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage || undefined,
    datePublished: post.publishedAt,
    author: {
      '@type': 'Organization',
      name: post.author || 'Vida Auto',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Guangzhou Vida Auto Parts Co., Ltd.',
      url: 'https://autoparts.fit',
    },
    mainEntityOfPage: `https://autoparts.fit/blog/${post.slug || post.id}`,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <SEO
        title={`${post.title} | Vida Auto Blog`}
        description={post.excerpt}
        path={`/blog/${post.slug || post.id}`}
        image={post.coverImage}
        jsonLd={jsonLd}
        type="article"
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Blog', url: '/blog' },
          { name: post.title, url: `/blog/${post.slug || post.id}` },
        ]}
      />

      <nav className="text-sm text-[#8892B0] mb-6">
        <Link to="/blog" className="hover:text-[#FFB300] flex items-center inline-flex">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('blog.back_to_blog', 'Back to Blog')}
        </Link>
      </nav>

      {post.coverImage && (
        <div className="rounded-xl overflow-hidden mb-8 max-h-[400px]">
          <img src={post.coverImage} alt={post.title} loading="lazy" className="w-full h-full object-cover" />
        </div>
      )}

      <article>
        <header className="mb-8">
          {post.category && (
            <span className="text-xs text-[#FFB300] font-medium uppercase tracking-wide">{post.category}</span>
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-[#E6F1FF] mt-2 mb-4">{post.title}</h1>
          <div className="flex items-center gap-4 text-sm text-[#8892B0]">
            {post.author && <span className="flex items-center"><User className="w-4 h-4 mr-1" />{post.author}</span>}
            <span className="flex items-center"><Calendar className="w-4 h-4 mr-1" />{post.publishedAt?.split('T')[0]}</span>
            {post.readTime && <span className="flex items-center"><Clock className="w-4 h-4 mr-1" />{post.readTime}</span>}
          </div>
        </header>

        <div
          className="prose prose-invert prose-lg max-w-none
            prose-headings:text-[#E6F1FF] prose-headings:font-bold
            prose-p:text-[#8892B0] prose-p:leading-relaxed
            prose-a:text-[#FFB300] prose-a:no-underline hover:prose-a:underline
            prose-strong:text-[#E6F1FF]
            prose-li:text-[#8892B0]
            prose-img:rounded-xl
            prose-blockquote:border-[#FFB300] prose-blockquote:text-[#8892B0]"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {post.tags && post.tags.length > 0 && (
          <div className="mt-10 pt-6 border-t border-white/10">
            <span className="text-sm text-[#8892B0] mr-2">Tags:</span>
            {post.tags.map(tag => (
              <span key={tag} className="inline-block px-3 py-1 bg-[#112240] border border-white/10 rounded-full text-xs text-[#8892B0] mr-2 mb-2">{tag}</span>
            ))}
          </div>
        )}
      </article>

      <div className="mt-12 bg-gradient-to-r from-[#FFB300]/10 to-transparent rounded-xl border border-[#FFB300]/20 p-6 text-center">
        <h3 className="text-lg font-bold text-[#E6F1FF] mb-2">{t('blog.cta_title', 'Need Auto Parts?')}</h3>
        <p className="text-sm text-[#8892B0] mb-4">{t('blog.cta_desc', 'Browse our catalog or contact us for wholesale pricing.')}</p>
        <div className="flex gap-4 justify-center">
          <Link to="/products" className="px-5 py-2 bg-[#FFB300] text-[#0A192F] rounded-lg font-medium text-sm hover:bg-[#FFCA28] transition-colors">
            {t('blog.browse_catalog', 'Browse Catalog')}
          </Link>
          <Link to="/#contact" className="px-5 py-2 border border-[#FFB300] text-[#FFB300] rounded-lg font-medium text-sm hover:bg-[#FFB300]/10 transition-colors">
            {t('blog.get_quote', 'Get a Quote')}
          </Link>
        </div>
      </div>
    </div>
  );
}
