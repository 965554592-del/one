const admin = require('firebase-admin');
const serviceAccount = require('c:/Users/ASUS/Downloads/gen-lang-client-0915949910-firebase-adminsdk-fbsvc-e9858b8e4e.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'ai-studio-3112dc56-9c5d-41d4-8544-f79c07c29140' });

const posts = [
  {
    title: 'How to Choose the Right Headlight Lens Cover for Your Vehicle',
    slug: 'how-to-choose-headlight-lens-cover',
    category: 'How-to',
    readTime: '5 min',
    author: 'Vida Auto',
    tags: ['headlight', 'lens cover', 'guide', 'OEM'],
    excerpt: 'A complete guide to selecting the correct headlight lens cover by vehicle make, model, and year. Learn about OEM part numbers, material differences, and installation tips.',
    content: `<h2>Why Replace Your Headlight Lens Cover?</h2>
<p>Over time, headlight lens covers become yellowed, hazy, or cracked due to UV exposure, road debris, and temperature changes. A cloudy lens can reduce light output by up to 80%, creating a serious safety hazard and causing your vehicle to fail inspection.</p>

<h2>Step 1: Identify Your Vehicle's Make, Model & Year</h2>
<p>The most critical step is matching the correct lens cover to your exact vehicle. Headlight designs change between model years, so a 2018 Toyota Camry uses a completely different lens than a 2020 model. Always verify:</p>
<ul>
<li><strong>Make</strong> — e.g., Toyota, BMW, Audi</li>
<li><strong>Model</strong> — e.g., Camry, 3 Series, A4</li>
<li><strong>Year range</strong> — e.g., 2018–2020</li>
</ul>

<h2>Step 2: Check the OEM Part Number</h2>
<p>The OEM part number is the most reliable way to ensure compatibility. You can find it on your existing headlight assembly or by checking your vehicle's parts catalog. For example, a BMW 3 Series (2019-2023) uses OEM number 63117214961 / 63117214962.</p>

<h2>Step 3: Material Considerations</h2>
<p>Quality headlight lens covers are made from <strong>polycarbonate (PC)</strong>, which offers excellent clarity, impact resistance, and UV stability. Avoid cheap acrylic alternatives that yellow quickly.</p>

<h2>Step 4: Verify Left/Right Orientation</h2>
<p>Headlight lens covers are side-specific. Most OEM numbers come in pairs (left/right). Always order the correct side for your replacement needs.</p>

<h2>Step 5: Installation Tips</h2>
<p>Professional installation is recommended, but if you're doing it yourself:</p>
<ul>
<li>Use a heat gun to soften the original adhesive (typically butyl sealant)</li>
<li>Clean all surfaces thoroughly before applying new sealant</li>
<li>Allow 24 hours for the sealant to fully cure before driving</li>
</ul>

<h2>Wholesale Buyers</h2>
<p>If you're a distributor or auto parts shop, Vida Auto offers competitive FOB pricing on bulk orders with full OEM part number cross-referencing. <a href="/products">Browse our catalog</a> or <a href="/#contact">contact us for a quote</a>.</p>`,
  },
  {
    title: 'Complete Guide to Auto Bulb Types: H1, H7, H11, 9005, and More',
    slug: 'auto-bulb-types-guide',
    category: 'How-to',
    readTime: '7 min',
    author: 'Vida Auto',
    tags: ['bulb', 'halogen', 'LED', 'HID', 'guide'],
    excerpt: 'Understanding the differences between H1, H7, H11, 9005, 9006, D1S, D2S, and other auto bulb types. Learn which bulb fits your vehicle and the pros and cons of halogen vs HID vs LED.',
    content: `<h2>Understanding Auto Bulb Socket Types</h2>
<p>Auto bulbs come in dozens of socket types, each designed for specific headlight housings. Using the wrong bulb type can result in poor fitment, overheating, or electrical issues. Here's what you need to know.</p>

<h2>H-Series Halogen Bulbs</h2>
<p>The most common bulb family for passenger vehicles:</p>
<ul>
<li><strong>H1</strong> — Single filament, used for high beam or fog lights</li>
<li><strong>H4</strong> — Dual filament (high/low beam), common in older vehicles</li>
<li><strong>H7</strong> — Single filament low beam, very popular in European vehicles</li>
<li><strong>H11</strong> — L-shaped base, widely used for low beam and fog lights</li>
<li><strong>H13</strong> — Dual filament, common in American trucks and SUVs</li>
</ul>

<h2>HB / 9000 Series</h2>
<ul>
<li><strong>9005 (HB3)</strong> — High beam, also used as daytime running light</li>
<li><strong>9006 (HB4)</strong> — Low beam, very common in Japanese vehicles</li>
<li><strong>9007 (HB5)</strong> — Dual filament, used in some American vehicles</li>
</ul>

<h2>D-Series HID/Xenon Bulbs</h2>
<p>Factory-installed HID systems use D-series bulbs:</p>
<ul>
<li><strong>D1S</strong> — With integrated igniter, most common factory HID</li>
<li><strong>D2S</strong> — Without igniter (external ballast), older systems</li>
<li><strong>D3S</strong> — Mercury-free version of D1S</li>
<li><strong>D4S</strong> — Mercury-free version of D2S</li>
</ul>

<h2>Halogen vs HID vs LED: Which Is Best?</h2>
<table>
<tr><th>Feature</th><th>Halogen</th><th>HID/Xenon</th><th>LED</th></tr>
<tr><td>Brightness</td><td>~1,000 lm</td><td>~3,000 lm</td><td>~2,500 lm</td></tr>
<tr><td>Lifespan</td><td>500–1,000 hrs</td><td>2,000–3,000 hrs</td><td>25,000+ hrs</td></tr>
<tr><td>Color Temp</td><td>3,200K (warm)</td><td>4,300–6,000K</td><td>5,000–6,500K</td></tr>
<tr><td>Cost</td><td>Low</td><td>Medium</td><td>Medium-High</td></tr>
</table>

<h2>How to Find Your Bulb Type</h2>
<p>Check your vehicle's owner manual, or use our <a href="/products">product catalog</a> to search by vehicle make and model. You can also search by OEM part number for exact matching.</p>`,
  },
  {
    title: '5 Common Mistakes When Importing Auto Parts from China',
    slug: 'mistakes-importing-auto-parts-from-china',
    category: 'Industry',
    readTime: '6 min',
    author: 'Vida Auto',
    tags: ['import', 'wholesale', 'China', 'tips'],
    excerpt: 'Avoid costly errors when sourcing auto parts from Chinese manufacturers. Learn about quality verification, shipping terms, customs documentation, and payment security.',
    content: `<h2>Mistake #1: Not Verifying OEM Compatibility</h2>
<p>The biggest mistake importers make is ordering parts based on generic descriptions rather than OEM part numbers. Always request the exact OEM cross-reference before placing an order. A reputable supplier like Vida Auto provides OEM part numbers for every product.</p>

<h2>Mistake #2: Ignoring Quality Inspection</h2>
<p>Never skip pre-shipment inspection, especially for your first order. Options include:</p>
<ul>
<li><strong>Factory photos/videos</strong> — Free, basic verification</li>
<li><strong>Third-party inspection</strong> — SGS, Bureau Veritas, or TÜV</li>
<li><strong>Sample order</strong> — Order 5–10 pieces before committing to bulk</li>
</ul>

<h2>Mistake #3: Choosing the Wrong Shipping Terms</h2>
<p>Understand Incoterms before negotiating:</p>
<ul>
<li><strong>FOB (Free on Board)</strong> — You handle shipping from the port. Best for experienced importers.</li>
<li><strong>CIF (Cost, Insurance, Freight)</strong> — Supplier handles shipping to your port. Simpler but less control.</li>
<li><strong>DDP (Delivered Duty Paid)</strong> — Supplier handles everything including customs. Most expensive but hassle-free.</li>
</ul>

<h2>Mistake #4: Insufficient Customs Documentation</h2>
<p>Ensure your supplier provides:</p>
<ul>
<li>Commercial Invoice with HS codes</li>
<li>Packing List with weights and dimensions</li>
<li>Certificate of Origin (if applicable for tariff benefits)</li>
<li>Material Safety Data Sheet (for certain products)</li>
</ul>

<h2>Mistake #5: Unsecured Payment</h2>
<p>Protect your investment:</p>
<ul>
<li><strong>First order</strong>: Use Alibaba Trade Assurance, PayPal, or Letter of Credit</li>
<li><strong>Established relationship</strong>: T/T (30% deposit + 70% before shipment) is standard</li>
<li><strong>Never</strong>: Pay 100% upfront to a new supplier via wire transfer</li>
</ul>

<p>Working with an established manufacturer like Vida Auto reduces these risks. We provide full documentation, OEM part number verification, and flexible payment terms for qualified buyers. <a href="/#contact">Contact us</a> to discuss your requirements.</p>`,
  },
];

async function main() {
  for (const post of posts) {
    await db.collection('blogPosts').add({
      ...post,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`✓ Published: ${post.title}`);
  }
  console.log(`\n✅ Seeded ${posts.length} blog posts`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
