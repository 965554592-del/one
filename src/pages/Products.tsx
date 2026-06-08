import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, ArrowRight, FileText, ArrowLeft, Eye } from 'lucide-react';
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
    const buildTimeProducts = (typeof window !== 'undefined' && (window as any).__PRODUCTS__) || [];
    let localProducts: Product[] = [];
    try {
      const cached = localStorage.getItem(CACHE_KEY_PRODUCTS);
      if (cached) localProducts = JSON.parse(cached);
    } catch {}

    if (buildTimeProducts.length > 0 && localProducts.length > 0) {
      const buildTimeLatest = Math.max(...buildTimeProducts.map((p: any) => new Date(p.createdAt || 0).getTime()));
      const localLatest = Math.max(...localProducts.map((p: any) => new Date(p.createdAt || 0).getTime()));
      return localLatest >= buildTimeLatest ? localProducts : buildTimeProducts;
    }
    return localProducts.length > 0 ? localProducts : buildTimeProducts;
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    const buildTimeCats = (typeof window !== 'undefined' && (window as any).__CATEGORIES__) || [];
    let localCats: Category[] = [];
    try {
      const cached = localStorage.getItem(CACHE_KEY_CATEGORIES);
      if (cached) localCats = JSON.parse(cached);
    } catch {}

    return localCats.length >= buildTimeCats.length ? localCats : buildTimeCats;
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
    <div>
      {/* Hero Banner */}
      <div className="relative w-full h-[420px] md:h-[520px] overflow-hidden">
        <img
          src="https://picsum.photos/seed/vida-products-hero/1920/700"
          alt="Products"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">{t('products.title', 'Product Catalog')}</h1>
          <p className="text-white/80 max-w-2xl text-sm md:text-lg">
            {t('products.hero_desc', 'Premium OEM & aftermarket auto parts. Browse our full catalog and find the perfect fit for your vehicle.')}
          </p>
        </div>
      </div>

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
        <Link to="/" className="inline-flex items-center text-sm text-charcoal/60 hover:text-brand mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('products.back_to_home', 'Back to Home')}
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-charcoal mb-4 md:mb-0">{t('products.browse', 'Browse Products')}</h2>
          <form onSubmit={(e) => e.preventDefault()} className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder={t('products.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-4 pr-10 py-2 border border-brand/20 bg-stone-100 text-charcoal rounded-md focus:ring-brand focus:border-brand w-full sm:w-64"
              />
              <button type="submit" className="absolute right-2 p-1 text-charcoal/60 hover:text-brand transition-colors">
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
          className="px-3 py-2 border border-brand/20 bg-white text-charcoal rounded-md focus:outline-none focus:border-brand/50 text-sm min-w-[160px]"
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
            className="px-3 py-2 border border-brand/20 bg-white text-charcoal rounded-md focus:outline-none focus:border-brand/50 text-sm min-w-[160px]"
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
          <div className="text-xs uppercase tracking-wider text-charcoal/60 mb-2">{t('products.find_for_vehicle', 'Find parts for your vehicle')}</div>
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
                className="col-span-3 sm:col-auto text-xs text-brand hover:underline text-left sm:text-center"
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
              ? 'bg-brand text-white' 
              : 'bg-white text-charcoal/60 border border-stone-200 hover:border-brand/50'
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
                ? 'bg-brand text-white'
                : 'bg-white text-charcoal/60 border border-stone-200 hover:border-brand/50'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <section className="animate-gradient-flow -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-10 rounded-2xl">
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-2xl overflow-hidden aspect-[4/3] bg-stone-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Link key={product.id} to={`/products/${product.id}`} className="group relative rounded-2xl overflow-hidden block aspect-[4/3] bg-cream">
              {(product.imageUrls && product.imageUrls.length > 0) || product.imageUrl ? (
                <img
                  src={product.imageUrls?.[0] || product.imageUrl}
                  alt={product.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://picsum.photos/seed/nanabuana-${product.id}/600/450`;
                  }}
                />
              ) : (
                <img
                  src={`https://picsum.photos/seed/nanabuana-${product.id}/600/450`}
                  alt={product.name}
                  loading="lazy"
                  className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                <span className="text-white font-semibold text-lg drop-shadow truncate pr-3">{product.name}</span>
                <div className="flex items-center gap-1.5 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-charcoal group-hover:bg-brand group-hover:text-white transition-colors shrink-0">
                  <Eye size={14} /> {t('home.view_details', 'View')}
                </div>
              </div>
            </Link>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full text-center py-12 text-charcoal/60">
              {t('products.no_products')}
            </div>
          )}
        </div>
      )}
      </section>
    </div>
    </div>
  );
}
