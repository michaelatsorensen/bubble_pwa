// ══════════════════════════════════════════════════════════
//  CURATED TAG DATABASE
//  Categories: rolle, branche, kompetence, interesse
//  Each tag has: label, category, usage_count (local tracking)
// ══════════════════════════════════════════════════════════
const TAG_CATEGORIES = {
  rolle:      { label: 'Rolle & Titel', icon: 'user', color: '#8B7FFF' },
  branche:    { label: 'Branche',       icon: 'building', color: '#E85D8A' },
  kompetence: { label: 'Kompetencer',   icon: 'cpu', color: '#10B981' },
  interesse:  { label: 'Interesser',    icon: 'rocket', color: '#38BDF8' },
};

const TAG_DATABASE = {
  rolle: [
    'Founder','Co-Founder','CEO','CTO','CFO','COO','CMO','CPO',
    'VP','Director','Partner','Board Member',
    'Product Manager','Project Manager','Team Lead',
    'Developer','Designer','Data Scientist','Engineer',
    'Consultant','Advisor','Mentor','Coach',
    'Investor','Business Angel','VC','LP',
    'Sales','Marketing','Growth','HR','Legal',
    'Freelancer','Iværksætter','Serial Entrepreneur',
    'Student','PhD','Professor','Researcher',
  ],
  branche: [
    'SaaS','Fintech','Healthtech','Edtech','Cleantech','Biotech',
    'E-commerce','Martech','Proptech','Legaltech','Insurtech',
    'Foodtech','Agritech','Logistik','Mobility','SpaceTech',
    'Gaming','Entertainment','Media','Publishing',
    'Cybersecurity','Cloud','Infrastructure','DevTools',
    'AI/ML','Blockchain','IoT','Robotics','AR/VR','Quantum',
    'Energi','Bæredygtighed','Circular Economy',
    'Sundhed','Pharma','MedTech','Mental Health',
    'Finans','Banking','Crypto','DeFi',
    'Retail','Fashion','Luxury','D2C',
    'B2B','B2C','Marketplace','Platform',
    'Deep Tech','Hardware','Embedded','Semiconductors',
    'Consulting','Agency','Service',
    'NGO','GovTech','Civic Tech','Impact',
  ],
  kompetence: [
    'Product Development','UX/UI Design','Frontend','Backend','Full-Stack',
    'Mobile (iOS)','Mobile (Android)','React','Python','Node.js',
    'Data Analytics','Machine Learning','NLP','Computer Vision',
    'Growth Hacking','SEO/SEM','Content Marketing','Social Media',
    'Paid Acquisition','Email Marketing','CRO','Analytics',
    'Sales Strategy','Enterprise Sales','Partnerships','BD',
    'Fundraising','Pitch Deck','Financial Modeling','Due Diligence',
    'People Ops','Talent Acquisition','Culture','Org Design',
    'Operations','Supply Chain','Procurement',
    'Brand Strategy','PR/Comms','Storytelling',
    'Legal/Compliance','IP/Patent','GDPR',
    'DevOps','Security','Architecture','API Design',
    'Research','Innovation','Strategy','Facilitation',
    'Sustainability','ESG','Carbon Accounting',
  ],
  interesse: [
    'Open Source','Web3','Decentralization','Privacy',
    'Climate Action','Social Impact','Diversity & Inclusion',
    'Future of Work','Remote Work','Digital Nomad',
    'Leadership','Management','Entrepreneurship',
    'Venture Capital','Angel Investing','Crowdfunding',
    'Networking','Community Building','Events',
    'Public Speaking','Writing','Podcasting',
    'Design Thinking','Lean Startup','Agile',
    'Personal Development','Mindfulness','Biohacking',
    'Nordic Startups','European Tech','Global Markets',
    'Smart Cities','Digital Health',
    'Creator Economy','No-Code','Low-Code',
    'AI Ethics','Responsible AI','AI Safety',
    'Internationalisering','Skalering','Exit Strategy',
  ],
};

// Flatten for search/autocomplete
const ALL_TAGS = [];
Object.entries(TAG_DATABASE).forEach(([cat, tags]) => {
  tags.forEach(t => ALL_TAGS.push({ label: t, category: cat }));
});

// Search tags by query (fuzzy)
function searchTags(query) {
  if (!query || query.length < 1) return [];
  var q = query.toLowerCase();
  return ALL_TAGS.filter(t => t.label.toLowerCase().includes(q)).slice(0, 12);
}

// Get tag category info
function getTagCategory(label) {
  for (var cat in TAG_DATABASE) {
    if (TAG_DATABASE[cat].indexOf(label) >= 0) return cat;
  }
  return 'custom';
}

// Category color for a tag
function tagCategoryColor(label) {
  var cat = getTagCategory(label);
  return TAG_CATEGORIES[cat]?.color || 'var(--accent)';
}
