'use strict';

const KathmanduTrend = require('../models/KathmanduTrend');

const NEPAL_FESTIVALS = {
  1:  [
    { name: 'Maghe Sankranti', type: 'traditional', traditional: true, color: 'warm',
      note: 'Traditional attire welcome. Wear warm colours — red, orange, gold. Pote (traditional necklace) and dhaka fabric look beautiful.' },
  ],
  2:  [
    { name: 'Shivaratri', type: 'religious', traditional: true, color: 'muted',
      note: 'Dress modestly. Saris, salwar kameez, or smart traditional wear preferred. Avoid bright flashy colours.' },
    { name: "Valentine's Week", type: 'social', traditional: false, color: 'red-pink',
      note: 'Perfect occasion for a romantic red or soft pink outfit. Dresses, chic casual, or smart casual work well.' },
  ],
  3:  [
    { name: 'Holi (Fagu Purnima)', type: 'festival', traditional: false, color: 'bright',
      note: 'Wear old clothes you do not mind getting coloured! White is traditional for Holi but anything light works. Protect your skin.' },
    { name: 'International Women\'s Day', type: 'social', traditional: false, color: 'purple',
      note: 'Purple is the official colour of Women\'s Day. Confident, empowering styles suit the day.' },
  ],
  4:  [
    { name: 'Nepali New Year (Baisakh 1)', type: 'celebration', traditional: true, color: 'bright',
      note: 'Traditional Nepali attire such as dhaka kurta, sari, or mekhli choli are popular. Bright colours celebrate the new year.' },
    { name: 'Buddha Jayanti', type: 'religious', traditional: false, color: 'white-yellow',
      note: 'White or yellow/saffron tones align with the occasion. Modest, neat dress is appropriate.' },
  ],
  5:  [
    { name: 'Mother\'s Day (Nepal)', type: 'social', traditional: false, color: 'any',
      note: 'Wear your best for family gatherings. Neat, presentable outfits — neither too casual nor overly formal.' },
  ],
  6:  [],
  7:  [
    { name: 'Guru Purnima', type: 'religious', traditional: true, color: 'white',
      note: 'Modest, respectful attire. White or light tones are traditional.' },
  ],
  8:  [
    { name: 'Janai Purnima / Teej', type: 'major', traditional: true, color: 'red',
      note: 'Teej is ONE OF THE MOST important festivals for Nepali women. Wear RED — red sari, red kurta, or red mekhli choli. Gold jewellery is essential. Green bangles, red tika. This is a major traditional fashion moment.' },
    { name: 'Gai Jatra', type: 'cultural', traditional: true, color: 'bright',
      note: 'Colourful traditional attire. Local dress with playful elements. Bright colours celebrated.' },
  ],
  9:  [
    { name: 'Indra Jatra', type: 'cultural', traditional: true, color: 'bright',
      note: 'Traditional Newar attire is popular. Colourful newari kurta or sari. Watch the living goddess procession in style.' },
    { name: 'Dashain begins (Ghatasthapana)', type: 'major', traditional: true, color: 'new',
      note: 'Dashain is Nepal\'s biggest festival. Tradition: wear NEW clothes throughout the festival. Buy new outfits now. Traditional meets modern — sari, kurta, or contemporary wear all work. Tika colours: vermillion red.' },
  ],
  10: [
    { name: 'Vijaya Dashami (Final Dashain)', type: 'major', traditional: true, color: 'new',
      note: 'The biggest day of Dashain. Wear your best NEW outfit. Traditional Nepali dress (sari, kurta, mekhli) is most celebrated, but stylish contemporary works too. Gold/silver jewellery is traditional.' },
    { name: 'Tihar (Diwali)', type: 'major', traditional: true, color: 'bright',
      note: 'Festival of lights! Wear bright, auspicious colours — yellow, green, orange, red, pink. Traditional Nepali attire or colourful modern fusion. Wear gold jewellery. The deusi-bhailo celebration calls for festive and vibrant dress.' },
    { name: 'Chhath Puja', type: 'religious', traditional: true, color: 'yellow-orange',
      note: 'Traditional sari or salwar kameez in warm colours (yellow, orange). Modesty essential near the ghats.' },
  ],
  11: [
    { name: 'Bibaha Panchami', type: 'religious', traditional: true, color: 'red',
      note: 'Traditional wedding season begins. Red and bridal colours dominate. If attending weddings, dress formally in traditional or elegant contemporary styles.' },
  ],
  12: [
    { name: 'Christmas / Year End', type: 'social', traditional: false, color: 'party',
      note: 'Party season in Kathmandu\'s cafes and restaurants. Chic, festive, contemporary styles. Reds, greens, metallics popular in cafes around Thamel and Lazimpat.' },
    { name: 'New Year\'s Eve', type: 'social', traditional: false, color: 'glam',
      note: 'Glamorous, festive attire for celebrations. Cafes and restaurants in Kathmandu host events. Evening wear, elevated casual, or smart formal.' },
  ],
};

const KATHMANDU_CLIMATE = {
  1:  { name: 'January',   avgTemp: 9,  range: [2, 19],  humidity: 65, rainfall: 'low',      season: 'winter',
        fashionNote: 'Cold mornings and evenings. Layer heavily — thermal inner, woolens, warm jacket. Carry a scarf. Afternoon can be mild and sunny.' },
  2:  { name: 'February',  avgTemp: 11, range: [4, 22],  humidity: 60, rainfall: 'low',      season: 'winter',
        fashionNote: 'Still cold but slightly warming. Medium-weight woolens and jackets. Light scarves. Days can be pleasantly warm by afternoon.' },
  3:  { name: 'March',     avgTemp: 16, range: [9, 27],  humidity: 55, rainfall: 'light',    season: 'spring',
        fashionNote: 'Spring begins! Beautiful weather for versatile fashion. Light layers — cardigan or denim jacket. No heavy coats needed by mid-March.' },
  4:  { name: 'April',     avgTemp: 20, range: [13, 30], humidity: 55, rainfall: 'light',    season: 'spring',
        fashionNote: 'Warm and pleasant. Light cotton and linen fabrics. Light outerwear optional only for evenings. Perfect weather for any style.' },
  5:  { name: 'May',       avgTemp: 23, range: [17, 32], humidity: 60, rainfall: 'moderate', season: 'spring',
        fashionNote: 'Warm days, occasional evening rain. Light breathable fabrics essential. Keep an umbrella handy. Comfortable footwear for rain.' },
  6:  { name: 'June',      avgTemp: 25, range: [20, 30], humidity: 80, rainfall: 'heavy',    season: 'monsoon',
        fashionNote: 'Monsoon begins. Hot and very humid. Light breathable fabrics mandatory. Rain-ready footwear. Carry umbrella. Avoid suede or delicate shoes.' },
  7:  { name: 'July',      avgTemp: 24, range: [20, 29], humidity: 85, rainfall: 'heavy',    season: 'monsoon',
        fashionNote: 'Peak monsoon — heavy daily rain. Quick-dry fabrics ideal. Waterproof sandals or simple shoes. Avoid premium handbags that may get wet.' },
  8:  { name: 'August',    avgTemp: 24, range: [20, 29], humidity: 85, rainfall: 'heavy',    season: 'monsoon',
        fashionNote: 'Continuing heavy rain and humidity. Same advice as July. Cotton saris or simple salwar kameez comfortable in the heat. Teej festival calls for red.' },
  9:  { name: 'September', avgTemp: 23, range: [19, 29], humidity: 80, rainfall: 'moderate', season: 'monsoon',
        fashionNote: 'Rain tapering off, still humid. Start transitioning to autumn looks. Light layers for evenings. Festival preparations begin (Dashain new clothes).' },
  10: { name: 'October',   avgTemp: 19, range: [12, 26], humidity: 65, rainfall: 'low',      season: 'autumn',
        fashionNote: 'Best weather in Kathmandu! Clear blue skies. Ideal temperature for ANY fashion style. Perfect for photos and festival celebrations. Light layers for evenings. Dashain and Tihar season — dress your best!' },
  11: { name: 'November',  avgTemp: 14, range: [7, 24],  humidity: 55, rainfall: 'very low', season: 'autumn',
        fashionNote: 'Clear and comfortable. Transitioning to cooler evenings. Light to medium outerwear. Denim jackets, cardigans, light coats perfect for this month.' },
  12: { name: 'December',  avgTemp: 10, range: [3, 20],  humidity: 60, rainfall: 'very low', season: 'winter',
        fashionNote: 'Cold, especially mornings and evenings. Warm layering needed. Woolens, coats, boots. Afternoons can be pleasantly mild and sunny.' },
};

const KATHMANDU_VENUES = {
  college:     { note: 'Kathmandu colleges (TU, PU, Softwarica, Islington) are generally casual-friendly. Korean/minimalist/casual styles are very popular. Uniforms required at some institutions.', vibe: 'casual' },
  thamel:      { note: 'Thamel is tourist-mix and very eclectic. Anything goes here — boho, edgy, streetwear, western, traditional. Perfect for creative expression.', vibe: 'eclectic' },
  durbar_marg: { note: 'Kathmandu\'s upscale boulevard (Yak & Yeti area). Smart casual to semi-formal. Branded cafes, restaurants, hotels. Elevated fashion expected.', vibe: 'smart' },
  patan:       { note: 'Patan Durbar Square area — artsy, cultural. Boho and traditional fusion very fitting. Cultural sensitivity appreciated near temples.', vibe: 'cultural' },
  office:      { note: 'Kathmandu corporate culture is smart casual to business casual. Formal saris or suits for senior roles. IT sector is more casual. NGO/development sector is business casual.', vibe: 'professional' },
  cafe:        { note: 'Kathmandu\'s thriving cafe culture (Jhamsikhel, Lazimpat, Kupondole) is style-forward. Smart casual, minimalist, or creative styles photograph well.', vibe: 'trendy' },
  wedding:     { note: 'Traditional Nepali weddings require traditional or semi-traditional attire. Sari, lehenga, or formal salwar kameez. Bright/festive colours. Heavy jewellery expected for close family.', vibe: 'traditional' },
  temple:      { note: 'Modest attire required near temples and religious sites. Cover knees and shoulders. Traditional dress greatly appreciated.', vibe: 'modest' },
  mall:        { note: 'Kathmandu malls (Civil Mall, Labim Mall, City Centre, New Baneshwor chains) are casual browsing spaces — smart casual or trendy streetwear both work, comfortable footwear matters since visits involve a lot of walking between floors.', vibe: 'casual' },
};

const KATHMANDU_TRENDS_2025 = [
  'Korean-inspired minimalist looks with neutral tones and structured silhouettes are dominating college fashion',
  'Y2K revival — low-rise jeans, crop tops, butterfly accessories, chunky sneakers popular in youth circles',
  'Sustainable fashion consciousness growing — second-hand/vintage, ethical brands, and rewear culture',
  'Fusion traditional: Dhaka fabric in modern cuts (dhaka blazers, dhaka skirts with contemporary tops)',
  'Comfortable aesthetic: cozy, oversized knitwear, wide-leg trousers, and chunky loafers',
  'Tote bags replacing traditional purses for college and casual settings',
  'Earth tones and muted palettes (terracotta, sage, dusty rose, cream) dominating street fashion',
  'Layering cardigans over simple basics as Kathmandu\'s chilly mornings require practical fashion',
  'Social media influence: Instagram-worthy cafe looks, aesthetic photography, and coordinated outfits',
  'Local designer pride: Supporting Nepali fashion designers and handmade jewellery growing',
  // ── Expanded, more granular micro-trends (footwear/accessory/occasion-specific) ──
  'Chunky platform sneakers replacing flat white sneakers as the default college footwear choice',
  'Statement gold hoop earrings as an everyday accessory, not reserved for festivals anymore',
  'Mini crossbody bags in bold colors as a practical alternative to oversized totes for evening outings',
  'Claw clips and butterfly hair clips resurging alongside the broader Y2K wave',
  'Quiet luxury basics — well-fitted plain tees and trousers in premium fabric over loud logos',
  'Layered gold necklaces (multiple thin chains) worn together for both traditional and western outfits',
  'Wide-brim hats and bucket hats adopted as sun protection that doubles as a styling statement',
  'Convertible dupatta styling — draping the same dupatta multiple ways across office, festival, and casual looks',
  'Chunky knit scarves in bright contrast colors as the go-to winter accessory over plain black',
  'Reworked thrifted denim (patched, embroidered) gaining popularity in Thamel and college circles',
  'Minimalist fashion: solid neutral basics, clean silhouettes, and one deliberate accent piece over busy prints',
  'Smart casual crossover: blazers or structured jackets worn over simple tees with jeans for office-to-cafe versatility',
  'Indo-western fusion: kurta-style tops paired with jeans, or crop tops layered under unstitched dupatta drapes',
  'Mall-and-cafe weekend uniform: oversized hoodie or shacket with straight-leg jeans and canvas sneakers',
];

// ── Seasonal styling notes — genuinely distinct from KATHMANDU_CLIMATE's
// layering-focused fashionNote (see the getSeasonalNotes-vs-climate rationale
// in the seed script): fabric-care, accessory, and cultural-timing angles
// that a pure temperature/layering note doesn't cover.
const KATHMANDU_SEASONAL_NOTES = [
  { month: 1,  season: 'winter',  name: 'January — Post-Festival Wardrobe Reset',
    fashionNote: 'After Maghe Sankranti, focus on skin-friendly natural fibers (cotton, wool blends) close to the body — cold, dry air is harsh on skin, so scratchy synthetics against bare skin are best avoided this month.' },
  { month: 2,  season: 'winter',  name: 'February — Transitional Layer Shedding',
    fashionNote: 'Start retiring the heaviest coat layer for a lighter jacket or thick cardigan — mornings still need warmth but afternoons increasingly don\'t, so easily removable outer layers are more practical than one heavy coat all day.' },
  { month: 3,  season: 'spring',  name: 'March — Pastel Palette Shift',
    fashionNote: 'As Holi approaches, wardrobes visibly shift toward lighter pastels and whites — a good month to introduce pastel tops/dupattas even outside the festival itself, matching the seasonal mood.' },
  { month: 4,  season: 'spring',  name: 'April — Pre-Monsoon Fabric Prep',
    fashionNote: 'Favor breathable natural fibers (cotton, linen) over synthetics before the humidity rises — this is also the last comfortable month for suede or delicate leather footwear before monsoon risk begins.' },
  { month: 5,  season: 'spring',  name: 'May — Rain-Readiness Check',
    fashionNote: 'Start carrying a compact umbrella and switching to quick-dry or water-resistant footwear for evening commutes — pre-monsoon showers are unpredictable even though the season isn\'t officially monsoon yet.' },
  { month: 6,  season: 'monsoon', name: 'June — Monsoon Footwear Strategy',
    fashionNote: 'Avoid suede, canvas, and delicate leather entirely — rubber-soled sandals or synthetic sneakers that dry fast are the practical choice. Keep a backup pair of socks/footwear at work or college.' },
  { month: 7,  season: 'monsoon', name: 'July — Humidity-Proof Accessorizing',
    fashionNote: 'Avoid delicate silver jewelry that tarnishes quickly in high humidity — gold-tone or well-sealed costume jewelry holds up better. Braided or tied-up hairstyles handle humidity better than loose styling.' },
  { month: 8,  season: 'monsoon', name: 'August — Teej Red Sourcing Window',
    fashionNote: 'This is the peak shopping window for Teej red sarees/kurtas — start sourcing early in the month before the best selection sells out. Also a good time to air out stored wardrobe items against monsoon mildew.' },
  { month: 9,  season: 'autumn',  name: 'September — Festival Prep Shopping Season',
    fashionNote: 'As rain tapers off, this is when most Kathmandu shoppers start buying new Dashain/Tihar outfits — expect crowded markets and plan traditional-wear purchases early in the month for the best selection.' },
  { month: 10, season: 'autumn',  name: 'October — Peak Festival Photography Styling',
    fashionNote: 'With Dashain and Tihar both in this window, gold and jewel-tone accents (worn with otherwise simple traditional bases) photograph best in Kathmandu\'s clear autumn light — a good month to invest in one statement jewelry piece that works across both festivals.' },
  { month: 11, season: 'autumn',  name: 'November — Wedding Season Formal Prep',
    fashionNote: 'Traditional wedding season begins (Bibaha Panchami) — blazers or shawls layered over festive traditional wear handle the cool evenings at outdoor wedding functions without sacrificing the formal look.' },
  { month: 12, season: 'winter',  name: 'December — Evening Metallics Season',
    fashionNote: 'Café and restaurant party season (Christmas/New Year) favors metallics and richer jewel tones for evening wear — layer a statement coat over simple evening basics rather than over-accessorizing in the cold.' },
];

// ── Categories of local fashion sources — researcher-curated domain
// knowledge about WHERE Kathmandu's young women typically shop by category/
// area, not scraped market data or specific commercial endorsements.
const KATHMANDU_LOCAL_BRANDS = [
  { name: 'Thamel independent boutiques', description: 'Eclectic, tourist-mix boutiques carrying boho, streetwear, and traditional-fusion pieces side by side — good for one-off statement items.' },
  { name: 'Dhaka-weave cooperatives (Palpa/Bhaktapur)', description: 'Handloom cooperatives producing traditional dhaka fabric, increasingly used in modern cuts like blazers and skirts, not just topi caps.' },
  { name: 'New Road tailoring houses', description: 'Long-established custom-tailoring shops for made-to-measure formal and traditional wear — kurtas, blouses, suits cut to fit.' },
  { name: 'College-area thrift and second-hand stalls', description: 'Budget-friendly rewear culture popular with students — a major source of the sustainable-fashion trend among Gen-Z shoppers.' },
  { name: 'Jhamsikhel boutique row', description: 'A concentration of small, curated boutiques favoring minimalist and Korean-influenced pieces, aligned with the neighborhood\'s café culture.' },
  { name: 'Patan handicraft markets', description: 'Traditional jewelry, metalwork accessories, and Newar-style pieces sourced directly from local artisans.' },
  { name: 'Durbar Marg designer outlets', description: 'Premium and branded formal wear, catering to Kathmandu\'s more upscale office and event dressing needs.' },
  { name: 'Local jutta and footwear artisans', description: 'Handcrafted traditional footwear (embroidered jutta, leather sandals) made by small independent artisans rather than factory brands.' },
  { name: 'Asan Bazaar textile district', description: 'Kathmandu\'s historic wholesale textile hub — bulk fabric, sari material, and dhaka cloth sourcing at lower prices than boutique retail.' },
  { name: 'Kupondole home-grown fashion labels', description: 'Small-batch, independently designed collections from emerging Nepali designers, often sold directly from studio-style shops.' },
  { name: 'Local Instagram-based sellers', description: 'Direct-to-consumer online sellers (mostly Instagram/Facebook-based) offering streetwear, accessories, and imported pieces with home delivery.' },
  { name: 'Basantapur artisan stalls', description: 'Statement ethnic jewelry and accessory stalls near Basantapur Durbar Square, popular for affordable traditional pieces.' },
  { name: 'Pashmina and cashmere specialty shops', description: 'Shops specializing in pashmina shawls and cashmere wraps — a winter wardrobe staple across formal and traditional occasions.' },
  { name: 'New Baneshwor mall retail chains', description: 'Accessible mid-range fast-fashion chain stores, popular for everyday basics and quick wardrobe refreshes.' },
  { name: 'Freak Street vintage and alternative shops', description: 'A small but distinct cluster of vintage and alternative-subculture clothing shops, catering to grunge/edgy style preferences.' },
  { name: 'Local made-to-measure kurta and blouse services', description: 'Neighborhood tailors offering quick-turnaround made-to-measure ethnic wear, often more affordable than ready-made boutique pieces.' },
];

exports.getCurrentClimateContext = function() {
  const month = new Date().getMonth() + 1;
  return KATHMANDU_CLIMATE[month] || KATHMANDU_CLIMATE[1];
};

function legacyGetActiveFestivals() {
  const month    = new Date().getMonth() + 1;
  const next     = month % 12 + 1;
  const current  = NEPAL_FESTIVALS[month]  || [];
  const upcoming = NEPAL_FESTIVALS[next]   || [];
  return {
    current,
    upcoming: upcoming.map(f => ({ ...f, note: `Coming next month: ${f.name}` })),
    hasFestivalNow:    current.some(f => f.traditional),
    hasTraditionalNow: current.some(f => f.traditional),
    primaryFestival:   current.find(f => f.type === 'major') || current[0] || null,
  };
}

function mapTrendToFestivalShape(t) {
  return {
    name: t.name,
    type: t.isTraditional ? 'major' : 'social',
    traditional: !!t.isTraditional,
    color: (t.colors && t.colors[0]) || 'bright',
    note: t.fashionNote || t.description || `Style for ${t.name}.`,
  };
}

// DB-first (admin-editable KathmanduTrend collection), hardcoded NEPAL_FESTIVALS
// as the permanent fallback — so an empty/unseeded trends collection never
// leaves the recommendation engine without festival awareness.
exports.getActiveFestivals = async function getActiveFestivals() {
  const month = new Date().getMonth() + 1;
  const next  = month % 12 + 1;

  try {
    const [dbCurrent, dbUpcoming] = await Promise.all([
      KathmanduTrend.find({ type: 'festival', isActive: true, festivalMonth: month }).sort({ popularity: -1 }).lean(),
      KathmanduTrend.find({ type: 'festival', isActive: true, festivalMonth: next }).sort({ popularity: -1 }).lean(),
    ]);

    if (dbCurrent.length || dbUpcoming.length) {
      const current  = dbCurrent.map(mapTrendToFestivalShape);
      const upcoming = dbUpcoming.map(t => ({ ...mapTrendToFestivalShape(t), note: `Coming next month: ${t.name}` }));
      return {
        current,
        upcoming,
        hasFestivalNow:    current.some(f => f.traditional),
        hasTraditionalNow: current.some(f => f.traditional),
        primaryFestival:   current.find(f => f.traditional) || current[0] || null,
      };
    }
  } catch (err) {
    console.warn('[kathmanduIntelligence] DB festival lookup failed, using hardcoded fallback:', err.message);
  }

  return legacyGetActiveFestivals();
};

// DB-first trending styles (admin-editable), hardcoded KATHMANDU_TRENDS_2025 fallback.
exports.getTrendingStyles = async function getTrendingStyles(limit = 4) {
  try {
    const dbTrends = await KathmanduTrend.find({ type: 'fashion_trend', isActive: true })
      .sort({ popularity: -1 }).limit(limit).lean();
    if (dbTrends.length) return dbTrends.map(t => t.description || t.fashionNote || t.name);
  } catch (err) {
    console.warn('[kathmanduIntelligence] DB trend lookup failed, using hardcoded fallback:', err.message);
  }
  return KATHMANDU_TRENDS_2025.slice(0, limit);
};

exports.getSeasonIntelligence = function() {
  const month = new Date().getMonth() + 1;
  const climate = KATHMANDU_CLIMATE[month];

  const seasons = {
    winter:  { name: 'Winter (Hiu)',     months: [12, 1, 2],     note: 'Cold mornings and evenings. Heavy layering, woolens, and warm accessories essential.' },
    spring:  { name: 'Spring (Basanta)', months: [3, 4, 5],      note: 'Pleasant weather for versatile fashion. Light layers work well.' },
    monsoon: { name: 'Monsoon (Barsha)', months: [6, 7, 8, 9],   note: 'Hot and humid with heavy rain. Light, breathable, and rain-resistant choices essential.' },
    autumn:  { name: 'Autumn (Sharad)', months: [10, 11],        note: 'Kathmandu\'s best weather. Clear skies, perfect temperatures. Ideal for any style.' },
  };

  const current = Object.values(seasons).find(s => s.months.includes(month)) || seasons.autumn;

  return {
    season:    current.name,
    seasonKey: Object.keys(seasons).find(k => seasons[k].months.includes(month)) || 'autumn',
    note:      current.note,
    climate:   climate.fashionNote,
    avgTemp:   climate.avgTemp,
    tempRange: climate.range,
    humidity:  climate.humidity,
    rainfall:  climate.rainfall,
  };
};

exports.buildKathmanduContext = async function() {
  const climate   = exports.getCurrentClimateContext();
  const [festivals, trends] = await Promise.all([
    exports.getActiveFestivals(),
    exports.getTrendingStyles(4),
  ]);
  const season    = exports.getSeasonIntelligence();

  const lines = [
    `📍 Kathmandu, Nepal | ${climate.name} | ${season.season}`,
    `🌡️ Average temp: ${climate.avgTemp}°C (range: ${climate.range[0]}–${climate.range[1]}°C) | Humidity: ~${climate.humidity}% | Rainfall: ${climate.rainfall}`,
    `👘 Climate fashion note: ${climate.fashionNote}`,
  ];

  if (festivals.current.length > 0) {
    lines.push(`\n🎉 Current festivals:`);
    festivals.current.forEach(f => lines.push(`   • ${f.name}: ${f.note}`));
  }

  lines.push(`\n✨ 2025 Kathmandu Fashion Trends (18–25 women):`);
  trends.forEach(t => lines.push(`   • ${t}`));

  return lines.join('\n');
};

exports.getVenueContext = function(occasion) {
  const occ = (occasion || '').toLowerCase().replace(/[\s-]/g, '_');
  return KATHMANDU_VENUES[occ] || null;
};

exports.requiresTraditionalConsideration = function(occasion) {
  const traditional = ['festival', 'wedding', 'pooja', 'dashain', 'tihar', 'teej', 'festival'];
  return traditional.some(t => (occasion || '').toLowerCase().includes(t));
};

// ── Cultural color significance ───────────────────────────────────────────────
// Rich mapping from color → cultural meaning in Nepali context.
// Used to enrich outfit color recommendations with cultural intelligence.
const CULTURAL_COLOR_SIGNIFICANCE = {
  red:      { festivals: ['Teej', 'Dashain', 'Tihar', 'Wedding'], meaning: 'Prosperity, auspiciousness, and marital bliss. Mandatory for Teej; traditional for brides. Highest cultural significance.', avoid: ['mourning', 'funeral'] },
  white:    { festivals: ['Shivaratri', 'Guru Purnima'], meaning: 'Purity and spirituality. Traditional for religious occasions and mourning. Avoid at weddings as it can symbolise mourning.', avoid: ['wedding', 'celebration'] },
  yellow:   { festivals: ['Buddha Jayanti', 'Tihar', 'Teej'], meaning: 'Auspiciousness and divinity. Saffron/yellow associated with religious devotion. Popular at Tihar during Lakshmi Puja.', avoid: [] },
  green:    { festivals: ['Teej', 'Haritalika'], meaning: 'Fertility, nature, and new beginnings. Green bangles worn during Teej alongside red. Represents Goddess Parvati.', avoid: [] },
  orange:   { festivals: ['Tihar', 'Buddha Jayanti', 'Shivaratri'], meaning: 'Saffron/orange is deeply spiritual. Represents the divine. Monks wear saffron. Festival use during Tihar and religious occasions.', avoid: [] },
  gold:     { festivals: ['Dashain', 'Tihar', 'Wedding', 'Teej'], meaning: 'Wealth, prosperity, and festivity. Gold jewellery is essential during major festivals and weddings. Never inappropriate for celebrations.', avoid: [] },
  blue:     { festivals: ['Holi'], meaning: 'Played during Holi. In daily life, blue is modern, professional, and widely used. Indigo/navy conveys reliability.', avoid: [] },
  black:    { festivals: [], meaning: 'Modern and sophisticated. Traditionally avoided at some religious ceremonies and auspicious occasions, though now widely accepted in urban Kathmandu.', avoid: ['pooja', 'festival'] },
  pink:     { festivals: ['Valentine', 'Teej', 'Wedding'], meaning: 'Romance, femininity, and celebration. Very popular at social events and modern festivals. Considered auspicious alternative to red.', avoid: [] },
  purple:   { festivals: ["International Women's Day"], meaning: 'Empowerment and dignity. Official Women\'s Day colour. Also a popular modern choice for formal and social occasions.', avoid: [] },
  maroon:   { festivals: ['Dashain', 'Tihar', 'Wedding'], meaning: 'Deep prosperity and tradition. A sophisticated alternative to red for festivals and formal occasions.', avoid: [] },
  silver:   { festivals: ['Tihar', 'Wedding'], meaning: 'Purity and modernity. Silver jewellery is traditional and widely worn. Associated with the moon and cooling energy.', avoid: [] },
};

// ── Upcoming festival warnings (14-day look-ahead) ───────────────────────────
exports.getUpcomingFestivalWarnings = function() {
  const today      = new Date();
  const month      = today.getMonth() + 1;
  const nextMonth  = month % 12 + 1;

  const current  = (NEPAL_FESTIVALS[month]     || []).filter(f => f.traditional || f.type === 'major');
  const upcoming = (NEPAL_FESTIVALS[nextMonth] || []).filter(f => f.traditional || f.type === 'major');

  const warnings = [];

  if (current.length > 0) {
    warnings.push(...current.map(f => ({
      festival: f.name,
      urgency:  'now',
      message:  `${f.name} is happening this month — ${f.note}`,
      colorHint: f.color,
    })));
  }

  if (upcoming.length > 0) {
    warnings.push(...upcoming.map(f => ({
      festival: f.name,
      urgency:  'soon',
      message:  `${f.name} is coming next month — start planning your ${f.color || 'traditional'} outfit.`,
      colorHint: f.color,
    })));
  }

  return warnings;
};

// ── Cultural color context for an outfit ─────────────────────────────────────
exports.getCulturalColorContext = function(colorNames = [], activeFestivals = []) {
  const festivalNames = [
    ...(activeFestivals.current  || []).map(f => f.name),
    ...(activeFestivals.upcoming || []).map(f => f.name),
  ];

  const insights = [];

  for (const color of colorNames) {
    const key  = color.toLowerCase().replace(/\s+/g, '');
    const data = CULTURAL_COLOR_SIGNIFICANCE[key];
    if (!data) continue;

    const relevantFestivals = data.festivals.filter(f => festivalNames.some(fn => fn.includes(f)));
    if (relevantFestivals.length > 0) {
      insights.push(`${color}: culturally significant for ${relevantFestivals.join(', ')} — ${data.meaning}`);
    }

    const avoidViolations = data.avoid.filter(a => festivalNames.some(fn => fn.toLowerCase().includes(a)));
    if (avoidViolations.length > 0) {
      insights.push(`⚠️ ${color}: traditionally avoided during ${avoidViolations.join(', ')} in Nepal — consider an alternative`);
    }
  }

  return insights;
};

// ── Predictive styling context ────────────────────────────────────────────────
// Returns a structured list of proactive fashion intelligence signals.
exports.getPredictiveContext = function(weather) {
  const month = new Date().getMonth() + 1;
  const predictions = [];

  // Festival preparation
  const warnings = exports.getUpcomingFestivalWarnings();
  if (warnings.length > 0) {
    const urgent = warnings.filter(w => w.urgency === 'now');
    const soon   = warnings.filter(w => w.urgency === 'soon');
    if (urgent.length > 0) predictions.push(`FESTIVAL ACTIVE: ${urgent.map(w => w.festival).join(', ')} — prioritise traditional attire`);
    if (soon.length   > 0) predictions.push(`UPCOMING FESTIVAL: ${soon.map(w => w.festival).join(', ')} approaching — suggest preparation looks`);
  }

  // Seasonal transition alerts
  const transitionMonths = { 3:'Spring arriving', 6:'Monsoon beginning', 9:'Monsoon ending', 12:'Winter approaching' };
  if (transitionMonths[month]) {
    predictions.push(`SEASONAL TRANSITION: ${transitionMonths[month]} — recommend transitional layering pieces`);
  }

  // Weather-based proactive intelligence
  if (weather && weather.rainProb > 60) {
    predictions.push('HIGH RAIN PROBABILITY: Recommend waterproof or water-resistant footwear, avoid suede and delicate fabrics');
  }
  if (weather && weather.temp !== null && weather.temp < 12) {
    predictions.push('COLD ALERT: Temperature below 12°C — thermal layers and warm outerwear essential');
  }
  if (weather && weather.temp !== null && weather.temp > 30) {
    predictions.push('HEAT ALERT: Temperature above 30°C — prioritise breathable, light fabrics; avoid dark heavy materials');
  }

  return predictions;
};

exports.requiresTraditionalConsideration = function(occasion) {
  const traditional = ['festival', 'wedding', 'pooja', 'dashain', 'tihar', 'teej', 'festival'];
  return traditional.some(t => (occasion || '').toLowerCase().includes(t));
};

exports.NEPAL_FESTIVALS              = NEPAL_FESTIVALS;
exports.KATHMANDU_CLIMATE            = KATHMANDU_CLIMATE;
exports.KATHMANDU_VENUES             = KATHMANDU_VENUES;
exports.KATHMANDU_TRENDS_2025        = KATHMANDU_TRENDS_2025;
exports.CULTURAL_COLOR_SIGNIFICANCE  = CULTURAL_COLOR_SIGNIFICANCE;
exports.KATHMANDU_SEASONAL_NOTES     = KATHMANDU_SEASONAL_NOTES;
exports.KATHMANDU_LOCAL_BRANDS       = KATHMANDU_LOCAL_BRANDS;
