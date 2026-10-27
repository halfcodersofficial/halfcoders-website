import { prisma } from "../lib/prisma";
import { generateCategorySlug } from "./slug";

/**
 * The course categories Half Coders offers, in the order they're listed: every
 * field a course could belong to, so an admin picks one rather than making it
 * up. `icon` is a key of the client's CategoryIcon map.
 *
 * A category shows on the homepage and in the catalogue filters only once it
 * has a published course, so a long list costs students nothing.
 */
export interface CatalogueCategory {
    title: string;
    icon: string;
    description: string;
}

export const CATEGORY_CATALOGUE: CatalogueCategory[] = [
    // ---- The original categories, in their original order
    { title: "Web Development", icon: "code", description: "Front-end, back-end and full-stack web programmes" },
    { title: "Programming", icon: "terminal", description: "Programming fundamentals in any language" },
    { title: "Graphic Design", icon: "palette", description: "Visual design for print and screen" },
    { title: "Digital Marketing", icon: "megaphone", description: "Reaching and converting customers online" },
    { title: "Data & AI", icon: "brain", description: "Data, analytics and artificial intelligence" },
    { title: "Freelancing", icon: "briefcase", description: "Finding clients and working for yourself" },
    { title: "Mobile App Development", icon: "smartphone", description: "Apps for Android and iOS" },
    { title: "UI/UX Design", icon: "pen-tool", description: "Designing interfaces and experiences people love" },
    { title: "Video Editing & Animation", icon: "video", description: "Editing, effects and animation" },
    { title: "Photography", icon: "camera", description: "Shooting, lighting and composition" },
    { title: "Cyber Security", icon: "shield", description: "Protecting systems, networks and data" },
    { title: "Cloud & DevOps", icon: "cloud", description: "Cloud platforms, automation and delivery" },
    { title: "Database Management", icon: "database", description: "Designing and running databases" },
    { title: "Game Development", icon: "gamepad", description: "Designing and building games" },
    { title: "Content Writing", icon: "pen-line", description: "Writing for the web and for business" },
    { title: "Language Learning", icon: "languages", description: "Learning a new language" },
    { title: "Office Productivity", icon: "file-spreadsheet", description: "Everyday office software, done well" },
    { title: "Business & Entrepreneurship", icon: "line-chart", description: "Starting and growing a business" },
    { title: "Accounting & Finance", icon: "calculator", description: "Accounts, finance and financial reporting" },
    { title: "Career & Soft Skills", icon: "presentation", description: "The skills every job needs" },
    { title: "Music & Audio", icon: "music", description: "Music, sound and audio production" },

    // ---- Software development
    { title: "Frontend Development", icon: "layout-template", description: "HTML, CSS, JavaScript and modern frameworks for the browser" },
    { title: "Backend Development", icon: "server", description: "Servers, APIs, databases and the logic behind every app" },
    { title: "Full-Stack Development", icon: "layers", description: "Front end to back end — complete web applications" },
    { title: "MERN Stack", icon: "layers", description: "MongoDB, Express, React and Node.js, end to end" },
    { title: "JavaScript", icon: "braces", description: "The language of the web, from basics to advanced patterns" },
    { title: "TypeScript", icon: "braces", description: "Typed JavaScript for larger, safer codebases" },
    { title: "Python", icon: "file-code", description: "Python for scripting, automation, web and data work" },
    { title: "Java", icon: "coffee", description: "Core Java, OOP and enterprise development" },
    { title: "C & C++", icon: "cpu", description: "Systems programming, memory and performance" },
    { title: "C# & .NET", icon: "hash", description: "Desktop, web and game development on .NET" },
    { title: "Go (Golang)", icon: "code-xml", description: "Fast, simple back-end services with Go" },
    { title: "Rust", icon: "cog", description: "Safe systems programming with Rust" },
    { title: "PHP & Laravel", icon: "code-xml", description: "Server-side PHP and the Laravel framework" },
    { title: "Ruby on Rails", icon: "gem", description: "Rapid web development with Ruby" },
    { title: "React", icon: "code", description: "Components, hooks and state for modern interfaces" },
    { title: "Next.js", icon: "code", description: "Full-stack React with server rendering and routing" },
    { title: "Angular", icon: "code", description: "Enterprise front ends with Angular" },
    { title: "Vue.js", icon: "code", description: "Approachable, progressive front-end development" },
    { title: "Node.js", icon: "server", description: "JavaScript on the server" },
    { title: "Django", icon: "server", description: "Batteries-included web development with Python" },
    { title: "Android Development", icon: "smartphone", description: "Native Android apps with Kotlin" },
    { title: "iOS Development", icon: "tablet-smartphone", description: "Native iPhone and iPad apps with Swift" },
    { title: "Flutter", icon: "tablet-smartphone", description: "Cross-platform apps from one Dart codebase" },
    { title: "React Native", icon: "tablet-smartphone", description: "Mobile apps for iOS and Android with React" },
    { title: "WordPress", icon: "globe", description: "Sites, themes and plugins on WordPress" },
    { title: "Shopify", icon: "shopping-bag", description: "Building and customising Shopify stores" },
    { title: "Software Testing & QA", icon: "bug", description: "Manual testing, test plans and bug reporting" },
    { title: "Test Automation", icon: "flask-conical", description: "Selenium, Playwright and automated test suites" },
    { title: "Software Engineering", icon: "network", description: "Design, architecture and engineering practice" },
    { title: "Data Structures & Algorithms", icon: "binary", description: "Problem solving for interviews and beyond" },
    { title: "Competitive Programming", icon: "trophy", description: "Contest problem solving and speed coding" },
    { title: "API Development", icon: "plug", description: "REST, GraphQL and APIs others rely on" },
    { title: "Microservices", icon: "boxes", description: "Designing and running distributed services" },
    { title: "Git & GitHub", icon: "git-branch", description: "Version control and collaboration" },
    { title: "Linux", icon: "square-terminal", description: "The Linux command line and administration" },
    { title: "Computer Networking", icon: "network", description: "Networks, protocols and CCNA fundamentals" },
    { title: "System Administration", icon: "server-cog", description: "Running servers, users and infrastructure" },
    { title: "Docker & Kubernetes", icon: "container", description: "Containers and orchestration in production" },
    { title: "AWS", icon: "cloud", description: "Amazon Web Services from fundamentals to certification" },
    { title: "Microsoft Azure", icon: "cloud", description: "Building and certifying on Azure" },
    { title: "Google Cloud", icon: "cloud", description: "Google Cloud Platform services and certification" },
    { title: "Blockchain & Web3", icon: "link", description: "Smart contracts, dApps and decentralised systems" },
    { title: "Embedded Systems & IoT", icon: "cpu", description: "Microcontrollers, sensors and connected devices" },
    { title: "Robotics", icon: "bot", description: "Building and programming robots" },
    { title: "Low-Code & No-Code", icon: "blocks", description: "Apps and automations without heavy coding" },
    { title: "Unity Game Development", icon: "gamepad", description: "2D and 3D games with Unity and C#" },
    { title: "Unreal Engine", icon: "gamepad", description: "High-end 3D games and real-time graphics" },
    { title: "AR & VR Development", icon: "glasses", description: "Augmented and virtual reality experiences" },
    { title: "Ethical Hacking", icon: "shield-alert", description: "Penetration testing and thinking like an attacker" },
    { title: "Network Security", icon: "shield", description: "Securing networks, firewalls and traffic" },
    { title: "Digital Forensics", icon: "fingerprint", description: "Investigating incidents and recovering evidence" },

    // ---- Data & AI
    { title: "Data Science", icon: "line-chart", description: "Turning data into insight with Python and statistics" },
    { title: "Data Analysis", icon: "chart-column", description: "Cleaning, exploring and presenting data" },
    { title: "Machine Learning", icon: "brain", description: "Models that learn from data" },
    { title: "Deep Learning", icon: "brain-circuit", description: "Neural networks for vision, language and more" },
    { title: "Generative AI", icon: "sparkles", description: "Building with large language models and image generators" },
    { title: "Prompt Engineering", icon: "message-square-text", description: "Getting reliable results from AI tools" },
    { title: "AI Automation & Agents", icon: "bot", description: "Automating work with AI agents and workflows" },
    { title: "Natural Language Processing", icon: "message-square-text", description: "Teaching computers to understand text" },
    { title: "Computer Vision", icon: "scan-eye", description: "Images, video and visual recognition" },
    { title: "Big Data", icon: "database", description: "Processing data at scale with Spark and friends" },
    { title: "Data Engineering", icon: "workflow", description: "Pipelines, warehouses and data infrastructure" },
    { title: "Business Intelligence", icon: "chart-pie", description: "Dashboards with Power BI, Tableau and Looker" },
    { title: "SQL", icon: "database", description: "Querying and shaping data with SQL" },
    { title: "Statistics", icon: "sigma", description: "Probability, inference and statistical thinking" },
    { title: "Advanced Excel", icon: "file-spreadsheet", description: "Formulas, pivot tables, dashboards and automation" },
    { title: "MLOps", icon: "workflow", description: "Deploying and running machine learning in production" },

    // ---- Design & creative
    { title: "Logo & Brand Identity", icon: "award", description: "Logos, brand guides and visual identity" },
    { title: "Adobe Photoshop", icon: "image", description: "Photo editing, compositing and design" },
    { title: "Adobe Illustrator", icon: "pen-tool", description: "Vector graphics and illustration" },
    { title: "Figma", icon: "frame", description: "Interface design and prototyping in Figma" },
    { title: "Canva", icon: "layout-template", description: "Quick, professional designs with Canva" },
    { title: "Motion Graphics", icon: "clapperboard", description: "Animated graphics with After Effects" },
    { title: "3D Modeling & Rendering", icon: "box", description: "Models, materials and renders" },
    { title: "Blender", icon: "box", description: "3D modelling, animation and rendering in Blender" },
    { title: "2D Animation", icon: "film", description: "Frame-by-frame and character animation" },
    { title: "Illustration & Digital Art", icon: "brush", description: "Drawing and painting on a tablet" },
    { title: "Web Design", icon: "monitor", description: "Designing websites people enjoy using" },
    { title: "Print & Packaging Design", icon: "printer", description: "Brochures, labels and packaging" },
    { title: "Typography", icon: "type", description: "Choosing and setting type well" },
    { title: "Product Design", icon: "package", description: "Designing physical and digital products" },
    { title: "Interior Design", icon: "sofa", description: "Planning and styling interior spaces" },
    { title: "Architecture & AutoCAD", icon: "ruler", description: "Drafting and architectural design" },
    { title: "Fashion Design", icon: "shirt", description: "Clothing design, patterns and collections" },
    { title: "Filmmaking", icon: "clapperboard", description: "Shooting, directing and producing video" },
    { title: "YouTube Content Creation", icon: "monitor-play", description: "Growing a channel with content people watch" },
    { title: "Podcasting", icon: "mic", description: "Planning, recording and publishing podcasts" },
    { title: "Music Production", icon: "music", description: "Producing, mixing and mastering tracks" },
    { title: "Singing & Vocal Training", icon: "mic-vocal", description: "Voice technique and performance" },
    { title: "Guitar", icon: "guitar", description: "Guitar from first chords to solos" },
    { title: "Piano & Keyboard", icon: "piano", description: "Playing piano and keyboard" },
    { title: "Drawing & Painting", icon: "palette", description: "Traditional drawing and painting skills" },
    { title: "Calligraphy", icon: "pen-line", description: "Hand lettering and calligraphy" },
    { title: "Mobile Photography", icon: "camera", description: "Great photos with just a phone" },
    { title: "Photo Editing", icon: "image", description: "Lightroom and retouching workflows" },
    { title: "Voice Over", icon: "mic", description: "Voice acting and narration" },

    // ---- Marketing
    { title: "Search Engine Optimization", icon: "search", description: "Ranking on Google with SEO" },
    { title: "Social Media Marketing", icon: "share", description: "Growing brands on social platforms" },
    { title: "Facebook & Instagram Ads", icon: "target", description: "Paid campaigns on Meta platforms" },
    { title: "Google Ads", icon: "mouse-pointer-click", description: "Search, display and YouTube advertising" },
    { title: "Content Marketing", icon: "newspaper", description: "Attracting customers with useful content" },
    { title: "Email Marketing", icon: "mail", description: "Lists, campaigns and automation" },
    { title: "Affiliate Marketing", icon: "link", description: "Earning commissions by promoting products" },
    { title: "Influencer Marketing", icon: "star", description: "Working with creators to reach audiences" },
    { title: "Branding", icon: "gem", description: "Building a brand people remember" },
    { title: "Copywriting", icon: "quote", description: "Words that sell" },
    { title: "Marketing Analytics", icon: "line-chart", description: "Measuring what marketing actually does" },
    { title: "E-commerce Marketing", icon: "shopping-cart", description: "Driving sales for online stores" },
    { title: "Growth Hacking", icon: "rocket", description: "Fast, experiment-driven growth" },
    { title: "Public Relations", icon: "megaphone", description: "Media, reputation and communications" },

    // ---- Business & management
    { title: "Project Management", icon: "clipboard-list", description: "Planning and delivering projects on time" },
    { title: "Agile & Scrum", icon: "iteration", description: "Agile teams, sprints and Scrum roles" },
    { title: "Product Management", icon: "package", description: "Deciding what to build and why" },
    { title: "Business Analysis", icon: "chart-column", description: "Requirements, processes and analysis" },
    { title: "Human Resources", icon: "users", description: "People management and HR practice" },
    { title: "Recruitment", icon: "user-search", description: "Hiring and talent acquisition" },
    { title: "Sales", icon: "handshake", description: "Selling, prospecting and closing deals" },
    { title: "Customer Service", icon: "headphones", description: "Support that keeps customers happy" },
    { title: "Leadership & Management", icon: "crown", description: "Leading people and teams" },
    { title: "Operations Management", icon: "settings", description: "Running processes efficiently" },
    { title: "Supply Chain & Logistics", icon: "truck", description: "Moving goods from source to customer" },
    { title: "Import & Export", icon: "ship", description: "International trade and documentation" },
    { title: "E-commerce Business", icon: "shopping-cart", description: "Starting and running an online store" },
    { title: "Dropshipping", icon: "package", description: "Selling without holding stock" },
    { title: "Real Estate", icon: "building", description: "Property, investment and sales" },
    { title: "Startups", icon: "rocket", description: "From idea to funded company" },
    { title: "Business Strategy", icon: "target", description: "Competing and growing deliberately" },
    { title: "Consulting", icon: "briefcase", description: "Advising clients and running engagements" },
    { title: "Virtual Assistant", icon: "headset", description: "Remote admin and support work for clients" },
    { title: "Freelance Marketplaces", icon: "laptop", description: "Winning work on Upwork, Fiverr and similar sites" },
    { title: "Microsoft Office", icon: "file-text", description: "Word, Excel, PowerPoint and Outlook" },
    { title: "Google Workspace", icon: "folder", description: "Docs, Sheets, Slides and Drive" },
    { title: "Data Entry", icon: "keyboard", description: "Accurate, fast data entry work" },
    { title: "Remote Work", icon: "laptop", description: "Working well from anywhere" },

    // ---- Finance
    { title: "Personal Finance", icon: "wallet", description: "Budgeting, saving and managing money" },
    { title: "Stock Market & Investing", icon: "trending-up", description: "Shares, funds and long-term investing" },
    { title: "Cryptocurrency", icon: "bitcoin", description: "How crypto works, and its risks" },
    { title: "Banking", icon: "landmark", description: "Banking operations and financial services" },
    { title: "Tax & VAT", icon: "receipt", description: "Tax returns, VAT and compliance" },
    { title: "Bookkeeping", icon: "notebook", description: "Recording transactions and keeping books" },
    { title: "Financial Analysis & Modeling", icon: "line-chart", description: "Valuation, forecasting and financial models" },
    { title: "Tally & Accounting Software", icon: "calculator", description: "Accounting with Tally, QuickBooks and similar" },
    { title: "Islamic Finance", icon: "landmark", description: "Shariah-compliant banking and finance" },
    { title: "Insurance", icon: "umbrella", description: "Insurance products and practice" },

    // ---- Personal development
    { title: "Communication Skills", icon: "message-circle", description: "Speaking and writing clearly at work" },
    { title: "Public Speaking", icon: "mic", description: "Presenting with confidence" },
    { title: "Time Management", icon: "clock", description: "Getting the important things done" },
    { title: "Productivity", icon: "list-checks", description: "Systems for focus and output" },
    { title: "Problem Solving & Critical Thinking", icon: "lightbulb", description: "Thinking clearly about hard problems" },
    { title: "Emotional Intelligence", icon: "heart", description: "Understanding yourself and others" },
    { title: "Interview Preparation", icon: "user-check", description: "Answering well and getting the offer" },
    { title: "CV & Resume Writing", icon: "file-text", description: "CVs that get interviews" },
    { title: "Personal Branding & LinkedIn", icon: "user", description: "Building a professional presence" },
    { title: "Negotiation", icon: "handshake", description: "Reaching better agreements" },
    { title: "Mental Health & Wellbeing", icon: "leaf", description: "Stress, resilience and self-care" },
    { title: "Parenting", icon: "baby", description: "Raising children with confidence" },

    // ---- Languages
    { title: "Spoken English", icon: "message-circle", description: "Everyday and workplace English conversation" },
    { title: "IELTS Preparation", icon: "graduation-cap", description: "Scoring well in every IELTS module" },
    { title: "TOEFL & PTE", icon: "graduation-cap", description: "Preparing for TOEFL and PTE Academic" },
    { title: "Business English", icon: "briefcase", description: "English for meetings, email and presentations" },
    { title: "Arabic", icon: "languages", description: "Learning Arabic" },
    { title: "Japanese", icon: "languages", description: "Learning Japanese, including JLPT" },
    { title: "Korean", icon: "languages", description: "Learning Korean, including TOPIK" },
    { title: "Chinese", icon: "languages", description: "Learning Mandarin Chinese, including HSK" },
    { title: "German", icon: "languages", description: "Learning German" },
    { title: "French", icon: "languages", description: "Learning French" },
    { title: "Spanish", icon: "languages", description: "Learning Spanish" },
    { title: "Bangla Language & Literature", icon: "book-open", description: "Bangla grammar, writing and literature" },

    // ---- Academics & exams
    { title: "Mathematics", icon: "sigma", description: "Maths from foundations to advanced topics" },
    { title: "Physics", icon: "atom", description: "Mechanics, electricity and modern physics" },
    { title: "Chemistry", icon: "flask-conical", description: "Organic, inorganic and physical chemistry" },
    { title: "Biology", icon: "dna", description: "Life sciences for school and beyond" },
    { title: "ICT", icon: "monitor", description: "ICT for SSC and HSC" },
    { title: "SSC Preparation", icon: "book-open", description: "Subject-wise SSC exam preparation" },
    { title: "HSC Preparation", icon: "book-open", description: "Subject-wise HSC exam preparation" },
    { title: "University Admission", icon: "school", description: "Admission test preparation" },
    { title: "BCS & Government Jobs", icon: "landmark", description: "Preparing for BCS and government job exams" },
    { title: "Bank Job Preparation", icon: "landmark", description: "Preparing for bank recruitment exams" },
    { title: "GRE & GMAT", icon: "graduation-cap", description: "Graduate admission test preparation" },
    { title: "Study Abroad", icon: "plane", description: "Applications, scholarships and visas" },
    { title: "Economics", icon: "trending-up", description: "Micro, macro and development economics" },
    { title: "Research & Academic Writing", icon: "book-marked", description: "Research methods and writing papers" },

    // ---- Engineering & technical trades
    { title: "Electrical Engineering", icon: "zap", description: "Circuits, power and electrical systems" },
    { title: "Electronics", icon: "circuit-board", description: "Components, circuits and PCB design" },
    { title: "Civil Engineering", icon: "construction", description: "Structures, surveying and construction" },
    { title: "Mechanical Engineering", icon: "cog", description: "Mechanics, machines and CAD" },
    { title: "Solar & Renewable Energy", icon: "sun", description: "Solar installation and clean energy" },
    { title: "Mobile & Computer Repair", icon: "wrench", description: "Diagnosing and fixing devices" },
    { title: "Electrical Wiring", icon: "plug-zap", description: "House and industrial wiring" },
    { title: "Driving & Automobile", icon: "car", description: "Driving skills and vehicle maintenance" },

    // ---- Health & lifestyle
    { title: "Health & Fitness", icon: "dumbbell", description: "Training, strength and staying fit" },
    { title: "Yoga", icon: "flower", description: "Yoga practice and breathing" },
    { title: "Nutrition & Diet", icon: "apple", description: "Eating well for health and goals" },
    { title: "First Aid", icon: "heart-pulse", description: "Emergency first aid skills" },
    { title: "Nursing & Caregiving", icon: "stethoscope", description: "Patient care and caregiving" },
    { title: "Cooking & Baking", icon: "chef-hat", description: "Home cooking and baking" },
    { title: "Beauty & Makeup", icon: "sparkles", description: "Makeup, skincare and beauty services" },
    { title: "Tailoring & Sewing", icon: "scissors", description: "Sewing, cutting and dressmaking" },
    { title: "Handicrafts", icon: "scissors", description: "Crafts to make and sell" },
    { title: "Gardening & Agriculture", icon: "sprout", description: "Growing crops and gardens" },
    { title: "Poultry & Livestock Farming", icon: "egg", description: "Raising poultry and livestock" },
    { title: "Fish Farming", icon: "fish", description: "Aquaculture and fish farming" },
    { title: "Travel & Tourism", icon: "plane", description: "Tourism, guiding and the travel business" },
    { title: "Hospitality & Hotel Management", icon: "hotel", description: "Hotels, restaurants and service" },
    { title: "Event Management", icon: "calendar", description: "Planning and running events" },

    // ---- Teaching, writing and more
    { title: "Teaching & Training", icon: "presentation", description: "Teaching well, in person and online" },
    { title: "Online Teaching", icon: "monitor-play", description: "Creating and running online courses" },
    { title: "Islamic Studies", icon: "moon-star", description: "Islamic history, fiqh and practice" },
    { title: "Quran Learning", icon: "book-open", description: "Recitation, tajweed and understanding" },
    { title: "Law & Legal Studies", icon: "scale", description: "Law for students and professionals" },
    { title: "Journalism", icon: "newspaper", description: "Reporting, writing and editing news" },
    { title: "Creative Writing", icon: "feather", description: "Fiction, poetry and storytelling" },
    { title: "Blogging", icon: "rss", description: "Writing and growing a blog" },
    { title: "Translation", icon: "languages", description: "Translating between languages professionally" },
];

/**
 * Adds every catalogue category the database doesn't have yet — matched by
 * title, ignoring case — after the existing ones, keeping the catalogue's
 * order. Never edits or removes a category an admin already has, so it is
 * safe to run again. Returns the titles it added.
 */
export const addMissingCategories = async (): Promise<string[]> => {
    const existing = await prisma.courseCategory.findMany({ select: { title: true, order: true } });
    const known = new Set(existing.map(({ title }) => title.trim().toLowerCase()));
    let order = existing.reduce((highest, category) => Math.max(highest, category.order), 0);

    const added: string[] = [];
    for (const category of CATEGORY_CATALOGUE) {
        if (known.has(category.title.toLowerCase())) continue;
        order += 1;
        await prisma.courseCategory.create({
            data: { ...category, order, slug: await generateCategorySlug(category.title) },
        });
        known.add(category.title.toLowerCase());
        added.push(category.title);
    }
    return added;
};
