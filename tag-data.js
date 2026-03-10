// ══════════════════════════════════════════════════════════
//  CURATED TAG DATABASE v2
//  ~400 tags across 4 categories
//  Expanded to cover all 11 interest areas × 7 lifestages
// ══════════════════════════════════════════════════════════
const TAG_CATEGORIES = {
  rolle:      { label: 'Rolle & Titel', icon: 'user', color: '#8B7FFF' },
  branche:    { label: 'Branche',       icon: 'building', color: '#E85D8A' },
  kompetence: { label: 'Kompetencer',   icon: 'cpu', color: '#10B981' },
  interesse:  { label: 'Interesser',    icon: 'rocket', color: '#38BDF8' },
};

const TAG_DATABASE = {
  rolle: [
    // Leadership & C-suite
    'Founder','Co-Founder','CEO','CTO','CFO','COO','CMO','CPO',
    'VP','Director','Partner','Board Member',
    'General Manager','Country Manager','Managing Director',
    // Management & project
    'Product Manager','Project Manager','Team Lead','Afdelingsleder',
    'Program Manager','Scrum Master','Agile Coach',
    // Tech & development
    'Developer','Software Engineer','Frontend Developer','Backend Developer',
    'Data Scientist','Data Engineer','ML Engineer','DevOps Engineer',
    'QA Engineer','Solutions Architect','Tech Lead',
    // Design & creative
    'Designer','UX Designer','UI Designer','Graphic Designer',
    'Art Director','Creative Director','Content Creator','Fotograf',
    'Journalist','Kommunikationsrådgiver',
    // Advisory & consulting
    'Consultant','Advisor','Mentor','Coach','Business Coach',
    'Management Consultant','Strategisk Rådgiver',
    // Investment
    'Investor','Business Angel','VC','LP','Fund Manager',
    // Sales & marketing
    'Sales','Sales Manager','Account Manager','Key Account Manager',
    'Marketing','Marketing Manager','Growth Manager','Brand Manager',
    'Digital Marketing Manager','Social Media Manager',
    // HR & people
    'HR','HR Manager','Recruiter','People Partner','CHRO',
    'Legal','Legal Counsel','Compliance Officer',
    // Operations
    'Operations','Operations Manager','Supply Chain Manager','Logistics Manager',
    'Indkøber','Produktionsleder','Kvalitetschef',
    // Entrepreneurship
    'Freelancer','Iværksætter','Serial Entrepreneur','Selvstændig',
    'Håndværker','Mester','Installatør',
    // Education & research
    'Student','PhD','Professor','Researcher','Underviser','Lektor',
    'Pædagog','Lærer','Skoleleder',
    // Health & care
    'Sygeplejerske','Læge','Tandlæge','Fysioterapeut','Psykolog',
    'Ergoterapeut','Jordemoder','Sundhedsplejerske',
    'Farmaceut','Bioanalytiker','Radiograf',
    'Sosu-assistent','Sosu-hjælper','Plejehjemsleder',
    // Public sector
    'Kommunaldirektør','Kontorchef','Sagsbehandler','Socialrådgiver',
    'Embedsmand','Forvaltningschef',
    // Trades & industry
    'Tømrer','Elektriker','VVS-installatør','Murer','Maler',
    'Smed','Mekaniker','Maskinmester','Ingeniør',
    'Industritekniker','Procesoperatør','CNC-operatør',
    'Landmand','Gartner','Skovfoged',
    // Service & hospitality
    'Kok','Tjener','Hotelchef','Restaurantchef','Bartender',
    'Butiksbestyrer','Butikschef','Ejendomsmægler',
    // Community
    'Frivillig','Bestyrelsesmedlem','Formand','Næstformand',
    'Træner','Instruktør','Terapeut',
  ],
  branche: [
    // Tech
    'SaaS','Fintech','AI/ML','Cybersecurity','Cloud','Infrastructure',
    'DevTools','IoT','Robotics','AR/VR','Quantum','Blockchain',
    'Deep Tech','Hardware','Embedded','Semiconductors',
    // Health & life science
    'Healthtech','MedTech','Pharma','Biotech','Mental Health',
    'Sundhed','Velfærdsteknologi','Tandpleje','Genoptræning',
    // Green & energy
    'Cleantech','Energi','Bæredygtighed','Circular Economy',
    'Vindenergi','Solenergi','Grøn Omstilling','Affaldshåndtering',
    'Vandteknologi','Carbon Capture',
    // Education & research
    'Edtech','Forskning','Universitet','Efteruddannelse',
    'Erhvervsskole',
    // Food & agriculture
    'Foodtech','Agritech','Landbrug','Økologi','Fødevarer',
    'Restaurant','Hotel','Turisme','Catering',
    // Construction & industry
    'Byggeri','Anlæg','Renovering','Boligbyggeri',
    'Produktion','Industri','Automation',
    'Transport','Logistik','Shipping','Mobility','Lager',
    // Commerce & retail
    'E-commerce','Retail','Fashion','Luxury','D2C','B2B','B2C',
    'Marketplace','Platform','Abonnement',
    'Detail','Dagligvarer',
    // Finance & insurance
    'Finans','Banking','Forsikring','Pension','Revision',
    'Crypto','DeFi','Investering','Kapitalforvaltning',
    // Media & creative
    'Media','Publishing','Gaming','Entertainment',
    'Reklame','Film','Musik','Kultur',
    'Martech','Kommunikation','PR',
    // Consulting & services
    'Consulting','Agency','Service','Advokatbranchen',
    'Rekruttering','Vikarbranchen','Facility Management',
    // Public & NGO
    'NGO','GovTech','Civic Tech','Impact',
    'Kommune','Region','Stat','Forening',
    'Socialøkonomi','Frivilligsektor',
    // Real estate
    'Proptech','Ejendomme','Bolig',
    // Other
    'Legaltech','Insurtech','SpaceTech',
  ],
  kompetence: [
    // Product & development
    'Product Development','UX/UI Design','Frontend','Backend','Full-Stack',
    'Mobile (iOS)','Mobile (Android)','React','Python','Node.js',
    'Java','C#','TypeScript','Go','Rust','PHP','Swift',
    'API Design','Architecture','System Design',
    'DevOps','CI/CD','Security','Cloud Architecture',
    // Data & AI
    'Data Analytics','Machine Learning','NLP','Computer Vision',
    'Deep Learning','Data Engineering','Data Visualization',
    'Business Intelligence','Power BI','Excel/Sheets',
    // Marketing & growth
    'Growth Hacking','SEO/SEM','Content Marketing','Social Media',
    'Paid Acquisition','Email Marketing','CRO','Analytics',
    'Influencer Marketing','Branding','Copywriting',
    'Google Ads','Meta Ads','LinkedIn Marketing',
    // Sales & business
    'Sales Strategy','Enterprise Sales','Partnerships','BD',
    'Key Account Management','Forhandling','Kundeservice',
    'Pipeline Management','CRM',
    // Finance & fundraising
    'Fundraising','Pitch Deck','Financial Modeling','Due Diligence',
    'Budgettering','Regnskab','Controlling','Økonomiansvar',
    'Bogføring','Revision',
    // People & org
    'People Ops','Talent Acquisition','Culture','Org Design',
    'Medarbejderudvikling','Onboarding','Employer Branding',
    'Konfliktløsning','Coaching','Mentoring',
    // Operations & logistics
    'Operations','Supply Chain','Procurement','Lagerstyring',
    'Lean Manufacturing','Six Sigma','Kvalitetsstyring','ISO',
    'Produktionsplanlægning','Vedligeholdelse',
    // Communication & branding
    'Brand Strategy','PR/Comms','Storytelling','Krisekommunikation',
    'Intern Kommunikation','Pressearbejde','Eventplanlægning',
    // Legal & compliance
    'Legal/Compliance','IP/Patent','GDPR','Kontraktret',
    'Persondataret','Udbudsret',
    // Research & innovation
    'Research','Innovation','Strategy','Facilitation',
    'Design Thinking','Prototyping','User Research',
    'Forretningsudvikling','Markedsanalyse','Konkurrentanalyse',
    // Sustainability
    'Sustainability','ESG','Carbon Accounting','LCA',
    'Miljøledelse','Energioptimering','Grøn Certificering',
    // Trade skills
    'Projektledelse','Byggeledelse','Tilbudskalkulation',
    'Tegning/CAD','3D-modellering','BIM',
    'Energiinstallation','Elinstallation','VVS',
    // Health skills
    'Klinisk Arbejde','Patientpleje','Medicinhåndtering',
    'Rehabilitering','Tværfagligt Samarbejde','Dokumentation',
    // Teaching & training
    'Undervisning','Kursusudvikling','E-læring',
    'Pædagogik','Didaktik','Vejledning',
  ],
  interesse: [
    // Tech & open
    'Open Source','Web3','Decentralization','Privacy',
    'AI Ethics','Responsible AI','AI Safety',
    'No-Code','Low-Code','Maker Culture',
    // Climate & sustainability
    'Climate Action','Social Impact','Grøn Omstilling',
    'Regenerativt Landbrug','Biodiversitet','Havmiljø',
    // Work & leadership
    'Future of Work','Remote Work','Digital Nomad',
    'Leadership','Management','Entrepreneurship',
    'Intrapreneurship','Selvledelse','Work-Life Balance',
    // Investment & scaling
    'Venture Capital','Angel Investing','Crowdfunding',
    'Nordic Startups','European Tech','Global Markets',
    'Internationalisering','Skalering','Exit Strategy',
    // Community & networking
    'Networking','Community Building','Events',
    'Foreningsliv','Frivilligt Arbejde','Lokalt Engagement',
    'Mentorordninger','Erfa-grupper','Branchenetværk',
    // Personal & creative
    'Personal Development','Mindfulness','Biohacking',
    'Public Speaking','Writing','Podcasting',
    'Fotografi','Musik','Kunst','Håndarbejde',
    // Methods & frameworks
    'Design Thinking','Lean Startup','Agile','Scrum',
    'OKR','Kaizen','Systems Thinking',
    // Digital & innovation
    'Smart Cities','Digital Health','Digital Transformation',
    'Industry 4.0','Automation','PropTech Innovation',
    // Diversity & inclusion
    'Diversity & Inclusion','Gender Equality','Tilgængelighed',
    // Education & knowledge
    'Livslang Læring','Faglig Udvikling','Videndeling',
    'Tværfaglighed','Forskning & Udvikling',
    // Sector specific
    'Patientinddragelse','Velfærdsinnovation','Sundhedsfremme',
    'Bygningskultur','Cirkulært Byggeri','Energirenovering',
    'Fødevaresikkerhed','Madkultur','Gastronomi',
    'Creator Economy','Iværksætterkultur','Startup Økosystem',
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
