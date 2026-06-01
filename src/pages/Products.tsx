import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, ArrowRight, FileText, ArrowLeft } from 'lucide-react';
import SEO from '../components/SEO';
import YMMSelect from '../components/YMMSelect';
import { trackEvent } from '../lib/pixel';
import { gtagEvent } from '../lib/gtag';

interface VehicleFitment {
  year?: number | string;
  make?: string;
  model?: string;
  displayName?: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  categoryName: string;
  price: number;
  imageUrls?: string[];
  imageUrl?: string;
  catalogUrl?: string;
  oemNumber?: string;
  techSpecs?: { compatibility?: string };
  fitments?: VehicleFitment[];
}

interface Category {
  id: string;
  name: string;
  order: number;
}

const CACHE_KEY_PRODUCTS = 'vida_products';
const CACHE_KEY_CATEGORIES = 'vida_categories';

export default function Products() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_PRODUCTS);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_CATEGORIES);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(products.length === 0 || categories.length === 0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedParentCategory, setSelectedParentCategory] = useState('');
  const [selectedProductName, setSelectedProductName] = useState('');
  // YMM cascading filter state
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMake, setSelectedMake] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
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
    const yearParam = searchParams.get('year');
    if (yearParam) setSelectedYear(yearParam);
    const makeParam = searchParams.get('make');
    if (makeParam) setSelectedMake(makeParam);
    const modelParam = searchParams.get('model');
    if (modelParam) setSelectedModel(modelParam);
  }, [searchParams]);

  // Debounced search event tracking (fires 800ms after the user stops typing)
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) return;
    const timer = setTimeout(() => {
      trackEvent('Search', { search_string: searchTerm });
      gtagEvent('search', { search_term: searchTerm });
    }, 800);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsSnap, categoriesSnap] = await Promise.all([
          getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'))),
          getDocs(query(collection(db, 'categories'), orderBy('order', 'asc')))
        ]);
        
        const freshProducts = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
        const freshCategories = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[];
        setProducts(freshProducts);
        setCategories(freshCategories);
        try {
          localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify(freshProducts));
          localStorage.setItem(CACHE_KEY_CATEGORIES, JSON.stringify(freshCategories));
        } catch {}
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

  // Get unique product names for the selected parent category
  const productNamesInCategory = selectedParentCategory
    ? [...new Set(products.filter(p => p.categoryId === selectedParentCategory).map(p => p.name))].sort()
    : [];

  // === YMM cascading dropdown options (derived from product fitments) ===
  const allFitments: VehicleFitment[] = products.flatMap(p => p.fitments || []);

  const yearOptions = [...new Set(
    allFitments.map(f => f.year != null ? String(f.year) : '').filter(Boolean)
  )].sort((a, b) => Number(b) - Number(a)); // newest first

  const makeOptions = [...new Set(
    allFitments
      .filter(f => !selectedYear || String(f.year) === selectedYear)
      .map(f => f.make || '')
      .filter(Boolean)
  )].sort();

  const modelOptions = [...new Set(
    allFitments
      .filter(f => !selectedYear || String(f.year) === selectedYear)
      .filter(f => !selectedMake || f.make === selectedMake)
      .map(f => f.model || '')
      .filter(Boolean)
  )].sort();

  // Match a product against the YMM filters (returns true if no YMM filter is set).
  const matchesYMM = (product: Product) => {
    if (!selectedYear && !selectedMake && !selectedModel) return true;
    const fits = product.fitments || [];
    if (fits.length === 0) return false;
    return fits.some(f =>
      (!selectedYear || String(f.year) === selectedYear) &&
      (!selectedMake || f.make === selectedMake) &&
      (!selectedModel || f.model === selectedModel)
    );
  };

  const filteredProducts = products.filter(product => {
    const term = searchTerm.toLowerCase();
    // P0: search now also matches free-text compatibility + YMM displayName/triple
    const fitmentText = (product.fitments || [])
      .map(f => f.displayName || [f.year, f.make, f.model].filter(Boolean).join(' '))
      .join(' ')
      .toLowerCase();
    const matchesSearch = !term ||
      product.name.toLowerCase().includes(term) ||
      product.sku.toLowerCase().includes(term) ||
      (product.oemNumber || '').toLowerCase().includes(term) ||
      (product.techSpecs?.compatibility || '').toLowerCase().includes(term) ||
      fitmentText.includes(term);
    const matchesCategory = selectedCategoryIds.length === 0 || selectedCategoryIds.includes(product.categoryId);
    const matchesParent = !selectedParentCategory || product.categoryId === selectedParentCategory;
    const matchesName = !selectedProductName || product.name === selectedProductName;
    return matchesSearch && matchesCategory && matchesParent && matchesName && matchesYMM(product);
  });

  const resetYMM = () => {
    setSelectedYear('');
    setSelectedMake('');
    setSelectedModel('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <SEO
        title="Auto Parts Catalog - Vida Auto Wholesale"
        description="Browse Vida Auto's full catalog of OEM and aftermarket auto parts. Filter by category, search by SKU, and request bulk wholesale quotes."
        path="/products"
        noindex={searchParams.toString().length > 0}
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Products', url: '/products' },
        ]}
      />
      <Link to="/" className="inline-flex items-center text-sm text-[#8892B0] hover:text-[#FFB300] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> {t('products.back_to_home', 'Back to Home')}
      </Link>
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

      {/* Dropdown Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={selectedParentCategory}
          onChange={(e) => { setSelectedParentCategory(e.target.value); setSelectedProductName(''); }}
          className="px-3 py-2 border border-[#FFB300]/20 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 text-sm min-w-[160px]"
        >
          <option value="">{t('products.all_categories', '全部分类')}</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        {selectedParentCategory && productNamesInCategory.length > 0 && (
          <select
            value={selectedProductName}
            onChange={(e) => setSelectedProductName(e.target.value)}
            className="px-3 py-2 border border-[#FFB300]/20 bg-[#112240] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50 text-sm min-w-[160px]"
          >
            <option value="">{t('products.all_products', '全部产品')}</option>
            {productNamesInCategory.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
      </div>

      {/* YMM (Year / Make / Model) cascading filter — only shows when product fitment data exists */}
      {yearOptions.length > 0 && (
        <div className="mb-4">
          <div className="text-xs uppercase tracking-wider text-[#8892B0] mb-2">{t('products.find_for_vehicle', 'Find parts for your vehicle')}</div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <div className="w-full sm:w-[140px]">
              <YMMSelect
                value={selectedYear}
                onChange={(v) => { setSelectedYear(v); setSelectedMake(''); setSelectedModel(''); }}
                placeholder={t('products.year', 'Year')}
                options={yearOptions}
              />
            </div>
            <div className="w-full sm:w-[160px]">
              <YMMSelect
                value={selectedMake}
                onChange={(v) => { setSelectedMake(v); setSelectedModel(''); }}
                placeholder={t('products.make', 'Make')}
                options={makeOptions}
                disabled={makeOptions.length === 0}
              />
            </div>
            <div className="w-full sm:w-[180px]">
              <YMMSelect
                value={selectedModel}
                onChange={setSelectedModel}
                placeholder={t('products.model', 'Model')}
                options={modelOptions}
                disabled={modelOptions.length === 0}
              />
            </div>
            {(selectedYear || selectedMake || selectedModel) && (
              <button
                type="button"
                onClick={resetYMM}
                className="col-span-3 sm:col-auto text-xs text-[#FFB300] hover:underline text-left sm:text-center"
              >
                {t('products.clear_filter', 'Clear')}
              </button>
            )}
          </div>
        </div>
      )}

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
                <div className="bg-[#0A192F] flex items-center justify-center">
                  {(product.imageUrls && product.imageUrls.length > 0) || product.imageUrl ? (
                    <img 
                      src={product.imageUrls?.[0] || product.imageUrl} 
                      alt={product.name} 
                      loading="lazy"
                      className="w-full h-48 object-contain p-3 group-hover:scale-[1.03] transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://picsum.photos/seed/nanabuana-${product.id}/400/300`;
                      }}
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
                  <p className="text-sm text-[#8892B0] mb-1">SKU: {product.sku}</p>
                  {product.oemNumber && <p className="text-xs text-[#8892B0] mb-2">OEM: {product.oemNumber}</p>}
                  <div className="flex items-center justify-between">
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
