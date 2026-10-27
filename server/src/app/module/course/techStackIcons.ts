/**
 * The icon keys a tech-stack chip may use — tools and subjects for every kind
 * of course. A closed list rather than a free string because the client maps
 * each key to a bundled icon (`lib/techStackIcons.ts`, which holds the same
 * keys in the same groups): an unknown key would render nothing, and a URL
 * here would be a place to inject markup into the public page.
 */
export const COURSE_TECH_STACK_ICONS = [
    // Web development
    "html5", "css3", "javascript", "typescript", "react", "nextjs", "vuejs", "nuxt", "angular", "svelte",
    "astro", "tailwindcss", "bootstrap", "sass", "shadcnui", "materialui", "jquery", "redux", "reactquery",
    "vite", "webpack", "graphql", "restapi", "responsivedesign", "wordpress", "elementor", "webflow", "wix",
    // Programming & backend
    "c", "cplusplus", "csharp", "dotnet", "java", "spring", "kotlin", "python", "django", "flask", "fastapi",
    "nodejs", "express", "nestjs", "bun", "deno", "php", "laravel", "ruby", "rails", "go", "rust", "dart",
    "scala", "lua", "socketio", "jwt", "dsa", "oop",
    // Mobile apps
    "flutter", "reactnative", "android", "androidstudio", "jetpackcompose", "ios", "swift", "xcode", "expo",
    "ionic", "googleplay", "appstore",
    // Databases
    "database", "sql", "mongodb", "mongoose", "postgresql", "mysql", "sqlite", "mariadb", "sqlserver",
    "oracle", "redis", "firebase", "supabase", "prisma", "elasticsearch",
    // Cloud & DevOps
    "docker", "kubernetes", "aws", "googlecloud", "azure", "vercel", "netlify", "render", "heroku",
    "digitalocean", "cloudflare", "nginx", "apache", "linux", "ubuntu", "windows", "macos", "bash",
    "powershell", "terminal", "githubactions", "jenkins", "terraform", "ansible", "cicd",
    // Developer tools & testing
    "git", "github", "gitlab", "bitbucket", "vscode", "intellij", "pycharm", "postman", "swagger", "npm",
    "pnpm", "yarn", "eslint", "prettier", "jest", "vitest", "cypress", "playwright", "selenium", "storybook",
    "jira", "chrome", "stackoverflow", "leetcode", "codeforces", "hackerrank", "codechef",
    // Data science & AI
    "ai", "chatgpt", "claude", "gemini", "copilot", "perplexity", "midjourney", "promptengineering",
    "machinelearning", "deeplearning", "huggingface", "langchain", "tensorflow", "pytorch", "keras",
    "scikitlearn", "pandas", "numpy", "jupyter", "googlecolab", "kaggle", "opencv", "plotly", "r", "tableau",
    "powerbi", "lookerstudio", "bigquery", "apachespark", "hadoop", "airflow", "dataanalysis",
    "datavisualization", "statistics",
    // Cybersecurity & networking
    "cybersecurity", "ethicalhacking", "kalilinux", "parrotos", "wireshark", "metasploit", "burpsuite",
    "owasp", "hackthebox", "tryhackme", "cisco", "networking", "firewall", "cryptography", "virtualbox",
    "vmware",
    // Graphic & UI/UX design
    "figma", "photoshop", "illustrator", "indesign", "adobexd", "canva", "sketch", "framer", "coreldraw",
    "affinitydesigner", "gimp", "inkscape", "penpot", "miro", "dribbble", "behance", "uiux", "wireframing",
    "graphicdesign", "logodesign", "branding", "typography", "colortheory", "illustration", "printdesign",
    // Video, audio & photography
    "premierepro", "aftereffects", "lightroom", "audition", "davinciresolve", "finalcutpro", "capcut",
    "filmora", "kdenlive", "obs", "youtube", "audacity", "flstudio", "ableton", "logicpro", "videoediting",
    "motiongraphics", "contentcreation", "streaming", "photography", "podcasting", "voiceover", "sounddesign",
    // 3D, animation & game development
    "unity", "unrealengine", "godot", "blender", "maya", "threedsmax", "cinema4d", "houdini", "spline",
    "threejs", "webgl", "roblox", "gamedev", "animation", "modeling3d",
    // Engineering, CAD & electronics
    "autocad", "revit", "fusion360", "solidworks", "sketchup", "matlab", "ansys", "arduino", "raspberrypi",
    "esp32", "kicad", "electronics", "circuitdesign", "iot", "robotics", "plc", "printing3d", "mechanical",
    "electrical", "civil", "architecture",
    // Digital marketing & SEO
    "digitalmarketing", "seo", "googleads", "googleanalytics", "googletagmanager", "searchconsole", "adsense",
    "googlebusiness", "metaads", "semrush", "ahrefs", "yoast", "mailchimp", "hubspot", "buffer", "hootsuite",
    "emailmarketing", "contentmarketing", "copywriting", "socialmediamarketing", "affiliatemarketing",
    "growthmarketing", "marketresearch",
    // Social media & messaging
    "facebook", "instagram", "linkedin", "x", "tiktok", "threads", "pinterest", "snapchat", "reddit", "quora",
    "whatsapp", "telegram", "messenger", "discord", "medium", "blogger", "substack",
    // E-commerce & payments
    "ecommerce", "fcommerce", "dropshipping", "shopify", "woocommerce", "magento", "squarespace", "amazon",
    "ebay", "etsy", "alibaba", "aliexpress", "stripe", "paypal", "payoneer", "wise", "mobilebanking",
    "logistics",
    // Office & productivity
    "excel", "word", "powerpoint", "outlook", "teams", "microsoft365", "googlesheets", "googledocs",
    "googleslides", "googleforms", "googledrive", "gmail", "googlecalendar", "googlemeet", "googleworkspace",
    "appsscript", "libreoffice", "zoom", "slack", "notion", "obsidian", "evernote", "trello", "asana",
    "clickup", "monday", "todoist", "airtable", "zapier", "make", "n8n", "dropbox", "calendly", "typing",
    // Business & management
    "entrepreneurship", "businessstrategy", "businessanalysis", "projectmanagement", "agile", "sales",
    "customerservice", "crm", "salesforce", "zoho", "sap", "odoo", "hr", "supplychain", "law", "realestate",
    // Finance, accounting & crypto
    "accounting", "bookkeeping", "tally", "quickbooks", "xero", "taxation", "financialanalysis",
    "stockmarket", "investing", "banking", "personalfinance", "bitcoin", "ethereum", "blockchain", "solidity",
    "web3", "binance", "metamask",
    // Freelancing & career
    "freelancing", "fiverr", "upwork", "freelancer", "remotework", "portfolio", "resume", "interview",
    "careerplanning", "personalbranding", "clientcommunication",
    // Languages & soft skills
    "english", "spokenenglish", "ielts", "foreignlanguages", "duolingo", "grammarly", "communication",
    "publicspeaking", "presentation", "leadership", "teamwork", "negotiation", "timemanagement",
    "productivity", "criticalthinking", "problemsolving", "emotionalintelligence", "creativewriting",
    // Academic & science
    "mathematics", "physics", "chemistry", "biology", "medical", "psychology", "research", "academicwriting",
    "teaching", "latex", "overleaf", "zotero", "mendeley", "googlescholar", "googleclassroom", "moodle",
    "geogebra", "wolfram", "khanacademy", "coursera", "udemy",
    // Creative & lifestyle skills
    "drawing", "painting", "calligraphy", "music", "guitar", "singing", "cooking", "baking", "fitness",
    "yoga", "nutrition", "fashiondesign", "tailoring", "beauty", "interiordesign", "handicrafts", "gardening",
    "agriculture", "driving", "travel", "parenting", "petcare", "firstaid",
] as const;
