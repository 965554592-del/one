import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, ArrowRight, FileText } from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  categoryName: string;
  price: number;
  imageUrls?: string[];
  catalogUrl?: string;
}

interface Category {
  id: string;
  name: string;
  order: number;
}

export default function Products() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      setSelectedCategoryIds([categoryParam]);
    }
    const searchParam = searchParams.get('search');
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsSnap, categoriesSnap] = await Promise.all([
          getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'categories'), orderBy('order', 'asc')))
        ]);
        
        setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
        setCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[]);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds(prev => 
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategoryIds.length === 0 || selectedCategoryIds.includes(product.categoryId);
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-[#E6F1FF] mb-4 md:mb-0">{t('products.title')}</h1>
        
        <form onSubmit={(e) => e.preventDefault()} className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder={t('products.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-4 pr-10 py-2 border border-[#FFB300]/20 bg-black/20 text-white rounded-md focus:ring-[#FFB300] focus:border-[#FFB300] w-full sm:w-64"
            />
            <button type="submit" className="absolute right-2 p-1 text-[#8892B0] hover:text-[#FFB300] transition-colors">
              <Search className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>

      {/* Category Chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setSelectedCategoryIds([])}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedCategoryIds.length === 0 
              ? 'bg-[#FFB300] text-[#0A192F]' 
              : 'bg-[#112240] text-[#8892B0] border border-white/10 hover:border-[#FFB300]/50'
          }`}
        >
          {t('products.all')}
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => toggleCategory(cat.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategoryIds.includes(cat.id)
                ? 'bg-[#FFB300] text-[#0A192F]'
                : 'bg-[#112240] text-[#8892B0] border border-white/10 hover:border-[#FFB300]/50'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="bg-[#112240] rounded-xl shadow-sm border border-white/5 overflow-hidden animate-pulse">
              <div className="w-full h-48 bg-white/5"></div>
              <div className="p-4">
                <div className="h-3 w-1/3 bg-white/10 rounded mb-2"></div>
                <div className="h-5 w-3/4 bg-white/10 rounded mb-2"></div>
                <div className="h-4 w-1/2 bg-white/10 rounded mb-4"></div>
                <div className="flex items-center justify-between">
                   <div className="h-6 w-1/4 bg-white/10 rounded"></div>
                   <div className="h-4 w-1/4 bg-white/10 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <Link key={product.id} to={`/products/${product.id}`} className="group">
              <div className="bg-[#112240] rounded-xl shadow-sm border border-white/5 overflow-hidden hover:border-[#FFB300]/50 transition-colors">
                <div className="aspect-w-4 aspect-h-3 bg-[#0A192F]">
                  {product.imageUrls && product.imageUrls.length > 0 ? (
                    <img 
                      src={product.imageUrls[0]} 
                      alt={product.name} 
                      loading="lazy"
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <img 
                      src={`https://picsum.photos/seed/nanabuana-${product.id}/400/300`} 
                      alt={product.name} 
                      loading="lazy"
                      className="w-full h-48 object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
                <div className="p-4">
                  <div className="text-xs text-[#FFB300] font-semibold mb-1 uppercase tracking-wider">{product.categoryName}</div>
                  <h3 className="text-lg font-bold text-white mb-1 truncate">{product.name}</h3>
                  <p className="text-sm text-[#8892B0] mb-3">SKU: {product.sku}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-white">${product.price.toFixed(2)}</span>
                    <div className="flex items-center space-x-2">
                      {product.catalogUrl && (
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            if (!auth.currentUser) {
                              alert(t('common.login_required'));
                              return;
                            }
                            window.open(product.catalogUrl, '_blank');
                          }}
                          className="p-1 px-2 bg-white/5 hover:bg-white/10 rounded text-[#FFB300] transition-colors"
                          title={t('product.manual_catalog')}
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                      <span className="text-sm font-medium text-[#FFB300] group-hover:text-[#FFCA28] flex items-center">
                        {t('home.view_details')} <ArrowRight className="ml-1 w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full text-center py-12 text-[#8892B0]">
              {t('products.no_products')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
