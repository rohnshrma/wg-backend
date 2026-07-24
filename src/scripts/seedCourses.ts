/**
 * One-time migration: copies the real course catalogue that used to live
 * only in the frontend's static src/data/courses.ts into MongoDB, so the
 * public course pages and the admin course CRUD share one source of truth.
 * Safe to re-run — upserts by slug.
 */
import mongoose from 'mongoose';
import env from '../config/env';
import Course from '../models/Course';

const PLACEHOLDER_THUMBNAIL = '/images/course-placeholder.svg';

const mapMode = (mode: string): 'online' | 'offline' | 'hybrid' => {
  const m = mode.toLowerCase();
  if (m.includes('&') || m.includes('hybrid')) return 'hybrid';
  if (m.includes('online')) return 'online';
  return 'offline';
};

const mapLevel = (level: string): 'beginner' | 'intermediate' | 'advanced' => {
  const l = level.toLowerCase();
  if (l.startsWith('advanced')) return 'advanced';
  if (l.startsWith('intermediate')) return 'intermediate';
  return 'beginner';
};

interface SeedCourse {
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  duration: string;
  mode: string;
  level: string;
  fees: number;
  technologies: string[];
  curriculum: { moduleTitle: string; topics: string[] }[];
  projects: { title: string; description: string }[];
  careerOpportunities: string[];
  faqs: { question: string; answer: string }[];
  isFeatured: boolean;
  displayOrder: number;
}

const courses: SeedCourse[] = [
  {
    title: 'Full Stack / MERN Stack Development',
    slug: 'mern-stack-development',
    shortDescription:
      'Comprehensive 7-month training from HTML to full-stack deployment. Master React, Node.js, MongoDB, Express, TypeScript, and build 10+ industry-level projects.',
    fullDescription:
      'The WebiGeeks Full Stack / MERN Stack Development programme is a comprehensive, 7-month training designed to transform complete beginners and career-switchers into confident, job-ready developers. Every module is meticulously crafted to mirror real industry workflows — from writing your first line of HTML to deploying full-stack applications on the cloud.',
    duration: '7 Months',
    mode: 'Online & Offline',
    level: 'Beginner to Advanced',
    fees: 30000,
    technologies: [
      'HTML5', 'CSS3', 'Bootstrap 5', 'JavaScript ES6+', 'React.js',
      'Node.js', 'Express.js', 'MongoDB', 'Mongoose', 'Git & GitHub',
      'TypeScript', 'Redux Toolkit', 'REST APIs', 'JWT Auth', 'Deployment',
    ],
    curriculum: [
      { moduleTitle: 'Module 1 — HTML5: The Backbone of the Web', topics: ['Introduction to HTML & how browsers parse markup', 'HTML document structure: DOCTYPE, html, head, body', 'Headings, paragraphs, links (anchor tags), images, audio, video', 'Lists: ordered, unordered, and nested lists', 'Tables: tr, td, th, colspan, rowspan', 'HTML5 Semantic elements: header, footer, nav, section, article, aside', 'Forms: input types, labels, placeholders, required attributes, validation', 'Iframes, meta tags, SEO basics, ARIA accessibility'] },
      { moduleTitle: 'Module 2 — CSS3: Design, Style & Responsiveness', topics: ['Selectors, specificity & the cascade, box model', 'Typography: fonts, sizes, line-height, colors, backgrounds, gradients', 'Flexbox — complete mastery, CSS Grid — 2D layout system', 'Position: static, relative, absolute, fixed, sticky', 'Z-index, stacking contexts, CSS variables', 'Media queries & breakpoints, mobile-first design strategy', 'CSS transitions & keyframe animations', 'Pseudo-classes, pseudo-elements, CSS transforms'] },
      { moduleTitle: 'Module 3 — Bootstrap 5: Rapid UI Development', topics: ['Installing Bootstrap (CDN & npm), the 12-column Grid System', 'Containers, rows, columns, responsive breakpoints', 'Typography, colour & spacing utility classes', 'Navbar — responsive navigation, Cards, Buttons, Badges, Alerts', 'Modals, Tooltips, Popovers, Carousel (image sliders)', 'Forms & form validation UI, Tables, Pagination', 'Building complete responsive pages with Bootstrap'] },
      { moduleTitle: 'Module 4 — JavaScript: The Language of the Web', topics: ['Variables: var, let, const, data types, operators, type coercion', 'Conditionals: if/else, switch, ternary, loops: for, while, for...of', 'Functions: declarations, expressions, arrow functions', 'Scope, hoisting, closures', 'Arrays: map, filter, reduce, forEach, find', 'Objects: creation, destructuring, spread/rest, JSON', 'ES6+: classes, modules (import/export), template literals', 'Callbacks, Promises (.then/.catch), Async/Await, Fetch API', 'Event loop, call stack, microtasks'] },
      { moduleTitle: 'Module 5 & 6 — DOM Manipulation & jQuery', topics: ['Understanding the DOM tree structure', 'Selecting elements: getElementById, querySelector, querySelectorAll', 'Modifying text, innerHTML, changing styles and CSS classes', 'Creating, appending, removing DOM elements', 'Event listeners: click, submit, keydown, mouseover', 'Event delegation and event bubbling/capturing', 'Form handling and input validation, Local & Session Storage', 'jQuery selectors, events, animations, AJAX'] },
      { moduleTitle: 'Module 7 — Node.js: Server-Side JavaScript', topics: ['Event-driven, non-blocking I/O model', 'Installing Node.js, npm, Node.js REPL', 'Global objects: __dirname, __filename, process', 'Module system (CommonJS: require/module.exports)', 'Core modules: fs, path, os, http, events', 'npm ecosystem: package.json, local vs global packages', 'nodemon for development workflow'] },
      { moduleTitle: 'Module 8 — Express.js: Building Web Servers & APIs', topics: ['Setting up Express, routing: GET, POST, PUT, DELETE', 'Route parameters, query strings, request & response objects', 'Static file serving with express.static()', 'Middleware pipeline: built-in, third-party (morgan, cors, helmet)', 'Writing custom middleware, error-handling middleware', 'EJS templating: rendering dynamic HTML, partials, layouts', 'Environment variables with dotenv'] },
      { moduleTitle: 'Module 9 — Git & GitHub: Version Control Essentials', topics: ['git init, clone, status, add, commit, log, diff', 'Branching, merging, merge conflicts, git rebase, stash, cherry-pick', 'Feature branch workflow for team collaboration', 'git push, pull, fetch, remote, pull requests, code reviews', 'Forking, contributing to open-source, GitHub Pages', '.gitignore, GitHub Actions basics, SSH key setup', 'Tags, releases, GitHub Projects and Issues'] },
      { moduleTitle: 'Module 10 & 11 — Databases: SQL, MongoDB & Mongoose', topics: ['Relational database concepts: tables, rows, columns, keys', 'SQL: SELECT, INSERT, UPDATE, DELETE, WHERE, ORDER BY', 'JOINs: INNER, LEFT, RIGHT, FULL OUTER', 'Aggregate functions, normalisation (1NF, 2NF, 3NF)', 'MongoDB: documents, collections, CRUD operations', 'MongoDB Atlas (cloud), Mongoose ODM: schemas & models', 'Mongoose validation, queries, population (joins), indexes'] },
      { moduleTitle: 'Module 12 & 13 — REST API & Authentication', topics: ['REST principles: statelessness, resources, HTTP verbs', 'API endpoint structure, HTTP status codes, Postman testing', 'CRUD API with Express + MongoDB', 'JWT (JSON Web Tokens): structure, signing, verifying', 'Passport.js: local strategy, OAuth (Google, GitHub)', 'Password hashing with bcrypt, protected routes, RBAC', 'CORS, Helmet.js, rate limiting, input sanitisation', 'Refresh tokens and token expiry strategies'] },
      { moduleTitle: 'Module 14 — React.js: Modern Frontend Development', topics: ['Virtual DOM & reconciliation, Create React App / Vite', 'JSX syntax, functional vs class components, props', 'useState, useEffect, useContext, useRef, useMemo, useCallback', 'Custom hooks: creating reusable logic', 'React Router v6: client-side navigation, dynamic routes', 'Axios / Fetch for API integration, forms & controlled components', 'Redux & Redux Toolkit: store, actions, reducers, createSlice', 'createAsyncThunk, RTK Query, useSelector & useDispatch'] },
      { moduleTitle: 'Module 15 — TypeScript: Scalable, Type-Safe JavaScript', topics: ['Type annotations: string, number, boolean, any, arrays, tuples, enums', 'Type inference, type aliases, union & intersection types', 'Typing function parameters and return types, interfaces', 'Generics: writing reusable typed code', 'Typing React props, useState, useRef, event handlers', 'Utility types: Partial, Required, Pick, Omit', 'TypeScript in Express.js backends', 'Migrating a JavaScript project to TypeScript'] },
      { moduleTitle: 'Module 16 — Deployment: Taking Your App Live', topics: ['Building React apps for production (npm run build)', 'Deploying to Vercel — automated GitHub integration', 'Netlify deployment and continuous deployment (CD)', 'Deploying Node.js/Express to Render.com & Railway.app', 'MongoDB Atlas for cloud database hosting', 'Environment configuration (production vs. development)', 'Custom domain configuration and DNS basics', 'Process management with PM2, AWS/GCP/Azure intro'] },
    ],
    projects: [
      { title: 'E-Commerce Platform', description: 'Product listing, shopping cart, user auth, payment simulation, admin panel' },
      { title: 'Food Ordering App', description: 'Dynamic menu, cart & checkout, order tracking, restaurant admin dashboard' },
      { title: 'Student Management System', description: 'CRUD operations, analytics dashboard, search/sort/filter, MongoDB integration' },
      { title: 'Job Portal System', description: 'Job posting, employer/seeker roles, resume upload, application tracking' },
      { title: 'Dice Game', description: 'DOM manipulation, randomisation, two-player logic' },
      { title: 'Blog Website', description: 'EJS templating, CRUD, Express backend' },
      { title: 'Weather App', description: 'Third-party API integration (OpenWeather), async/await' },
      { title: 'To-Do App', description: 'Full CRUD with MongoDB, React frontend + Node backend' },
    ],
    careerOpportunities: ['Full Stack Developer — ₹4–12 LPA', 'MERN Stack Developer', 'Frontend Developer (React.js)', 'Backend Developer (Node.js)'],
    faqs: [
      { question: 'Do I need prior coding experience?', answer: 'No! This programme starts from absolute zero — from your first line of HTML. Complete beginners are welcome.' },
      { question: 'What is the batch size?', answer: 'We keep batches intentionally small (max 15 students) to ensure personalised mentorship and direct instructor access.' },
      { question: 'Is placement support guaranteed?', answer: 'Yes, we provide 100% placement assistance including resume building, mock interviews, LinkedIn optimisation, and direct referrals to hiring partners.' },
      { question: 'Can I pay in installments?', answer: 'Yes, we offer flexible EMI/installment options. Contact us for details.' },
      { question: 'Are classes online or offline?', answer: 'Both! Choose fully online sessions with recorded backups, or attend in-person offline batches at our Gurugram centre.' },
      { question: 'Will I get a certificate?', answer: 'Yes, you will receive a course completion certificate along with project portfolio and GitHub profile review.' },
    ],
    isFeatured: true,
    displayOrder: 4,
  },
  {
    title: 'Data Analytics with Python',
    slug: 'data-analytics',
    shortDescription:
      'From Excel fundamentals to Power BI, Tableau, SQL, Python, Pandas, and MongoDB. Complete data analyst training with real-world projects.',
    fullDescription:
      'The WebiGeeks Data Analytics with Python programme is structured as a comprehensive, industry-aligned curriculum. Every module builds upon the previous, taking you from spreadsheet fundamentals to advanced visualisation and NoSQL databases — everything a modern data analyst needs to be job-ready.',
    duration: '6–7 Months',
    mode: 'Online & Offline',
    level: 'Beginner to Advanced',
    fees: 25000,
    technologies: ['Excel', 'SQL', 'Python', 'Pandas', 'NumPy', 'Matplotlib', 'Seaborn', 'SciPy', 'Power BI', 'Tableau', 'MongoDB', 'Jupyter Notebook'],
    curriculum: [
      { moduleTitle: 'Module 1 — Excel: Interface, Formulas, PivotTables & AI', topics: ['Navigate Excel: workbooks, worksheets, cells, named ranges', 'Formulas: SUM, SUMIF, AVERAGE, COUNT, IF, AND, OR, IFS, SWITCH', 'Text Functions: LEFT, RIGHT, MID, LEN, TRIM, CONCATENATE', 'VLOOKUP, HLOOKUP, INDEX + MATCH, XLOOKUP', 'Array formulas, FILTER, SORT, UNIQUE (dynamic arrays)', 'Data cleaning: duplicates, Text-to-Columns, conditional formatting', 'Charts: bar, column, line, pie, scatter, combo charts', 'PivotTables & PivotCharts: slicers, calculated fields', '50+ keyboard shortcuts, Flash Fill, Power Query, AI/Copilot features'] },
      { moduleTitle: 'Module 2 — SQL: Foundations to Window Functions', topics: ['Relational databases: tables, primary/foreign keys, normalisation', 'DDL: CREATE TABLE, ALTER TABLE, DROP TABLE, data types, constraints', 'SELECT, WHERE, ORDER BY, DISTINCT, LIMIT, BETWEEN, IN, LIKE', 'Aggregate functions: SUM, AVG, COUNT, MIN, MAX, GROUP BY, HAVING', 'CASE statements for conditional logic', 'JOINs: INNER, LEFT, RIGHT, FULL OUTER, CROSS, SELF JOIN', 'Subqueries & nested queries, EXISTS, correlated subqueries', 'Window Functions: ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD', 'CTEs (Common Table Expressions), recursive CTEs'] },
      { moduleTitle: 'Module 3 — Python Core Programming', topics: ['Variables, data types: integers, floats, strings, booleans', 'Core data structures: lists, tuples, dictionaries, sets', 'Control flow: if/elif/else, for and while loops', 'List comprehensions, user-defined functions, scope', 'map(), filter(), lambda expressions', 'Type casting, f-string formatting, Jupyter Notebook setup'] },
      { moduleTitle: 'Module 4 — Pandas: Data Handling & Preprocessing', topics: ['Reading & writing CSV, Excel, JSON, SQL data into DataFrames', 'Select columns/rows, filter with boolean masks, sort & rank', 'Apply functions with .apply() and .transform()', 'Handling missing data: .isnull(), fillna, dropna, forward fill', 'Outlier treatment: IQR and z-score methods', 'Remove duplicates, standardise column names, fix categorical values'] },
      { moduleTitle: 'Module 5 — EDA & Matplotlib Visualisation', topics: ['Descriptive statistics: .describe(), mean, median, mode, variance', 'Skewness, kurtosis, data distribution analysis', 'GroupBy operations, pivot tables, merge, join, reshape', 'Matplotlib: line charts, scatter plots, histograms, bar charts, box plots', 'Visualisation styling: themes, colour palettes, labels, annotations', 'Export publication-quality figures for reports'] },
      { moduleTitle: 'Module 6 — NumPy, Seaborn & Statistical Analysis', topics: ['NumPy: n-dimensional arrays, vectorised operations, broadcasting', 'Array slicing, reshaping, linear algebra essentials', 'Seaborn: heatmaps, pair plots, violin plots, swarm plots, regression plots', 'Probability distributions, inferential statistics', 'Hypothesis testing: null hypothesis, p-values, significance levels', 't-tests, chi-square tests, ANOVA, correlation tests using SciPy'] },
      { moduleTitle: 'Module 7 — Real-World Projects & Portfolio', topics: ['End-to-end data analysis: collect, clean, analyse, visualise', 'Business case studies: retail, finance, healthcare, e-commerce', 'Apply full analytics stack: SQL + Python + BI dashboards', 'Publish projects to GitHub with documented notebooks', 'Build professional analyst portfolio for recruiters'] },
      { moduleTitle: 'Module 8 — Power BI: From Data to Decisions', topics: ['Connect to Excel, SQL, Web, APIs; Power Query Editor', 'Build star schemas, define relationships & cardinality', 'DAX: calculated columns, measures, CALCULATE, FILTER, time intelligence', 'Build interactive dashboards, publish to Power BI Service', 'Drill-through, drill-down, cross-filtering, bookmarks, buttons', 'Real-time dashboards, forecasting, clustering, anomaly detection', 'AI visuals: Decomposition Tree, Key Influencers, Smart Narrative', 'Data storytelling: KPI cards, consistent design, executive reports'] },
      { moduleTitle: 'Module 9 — Tableau: Interactive Data Storytelling', topics: ['Tableau Desktop, workspace, shelves, dimensions vs measures', 'Data connections: Excel, CSV, SQL, cloud; live vs extract', 'Joins, unions, data blending across multiple sources', 'Multi-sheet dashboards with layout containers and actions', 'Filter actions, highlight actions, URL actions', 'Parameters, calculated fields, LOD expressions', 'Tableau Story Points for guided analytical narratives'] },
      { moduleTitle: 'Module 10 — MongoDB: NoSQL for Modern Analytics', topics: ['NoSQL fundamentals: document model vs tabular model', 'Collections & documents, schema flexibility', 'CRUD: insertOne, insertMany, find, updateOne, deleteOne', 'Query operators: $eq, $gt, $in, $set, $push', 'Aggregation pipelines for analytics', 'Connect MongoDB to Python using PyMongo', 'Export data to Pandas DataFrames for analysis'] },
    ],
    projects: [
      { title: 'End-to-End Data Analysis', description: 'Collect, clean, analyse, and visualise a real-world dataset with executive-ready report' },
      { title: 'Business Case Studies', description: 'Retail, finance, healthcare, and e-commerce analytics using SQL + Python + BI' },
      { title: 'Power BI Dashboard', description: 'Interactive business intelligence dashboard with DAX measures and storytelling' },
      { title: 'Tableau Visualization', description: 'Multi-sheet interactive dashboards with story points for stakeholder presentation' },
      { title: 'Portfolio Development', description: 'Published GitHub portfolio with documented notebooks, dashboards, and write-ups' },
    ],
    careerOpportunities: ['Data Analyst', 'Business Analyst', 'Junior Data Scientist', 'BI Developer', 'Analytics Consultant'],
    faqs: [
      { question: 'Do I need programming experience?', answer: 'No! We start from Excel basics and gradually introduce Python. Complete beginners are welcome.' },
      { question: 'What tools will I learn?', answer: 'Excel, SQL, Python (Pandas, NumPy, Matplotlib, Seaborn, SciPy), Power BI, Tableau, and MongoDB.' },
      { question: 'Is placement support included?', answer: 'Yes — résumé building, mock interviews, LinkedIn optimisation, and direct connections to our industry hiring network.' },
      { question: 'Can I attend online?', answer: 'Yes, choose fully online sessions or attend in-person offline batches at our Gurugram centre.' },
      { question: 'Will I get a certificate?', answer: 'Yes, you receive a course completion certificate along with your project portfolio.' },
    ],
    isFeatured: true,
    displayOrder: 2,
  },
  {
    title: 'Python Programming',
    slug: 'python-programming',
    shortDescription:
      'From setup to advanced OOP, decorators, generators, Flask & Django. 3 milestone projects and professional portfolio.',
    fullDescription:
      'A comprehensive Python programme covering everything from setup and fundamentals to advanced OOP, decorators, generators, and web development with Flask/Django. Master Python with hands-on projects and build a professional portfolio.',
    duration: '2–3 Months',
    mode: 'Online & Offline',
    level: 'Beginner to Advanced',
    fees: 15000,
    technologies: ['Python 3', 'Jupyter Notebook', 'Git & GitHub', 'VS Code', 'OOP', 'Flask', 'Django', 'APIs', 'Decorators', 'Generators', 'Unittest', 'Pylint', 'Web Scraping'],
    curriculum: [
      { moduleTitle: 'Chapter 1 — Python Setup & Environment', topics: ['Command line basics: navigate, run scripts, manage files', 'Installing Python on Windows, macOS, Linux; PATH variables', 'Python REPL, running script files, understanding the interpreter', 'Jupyter Notebook: interactive, cell-based coding', 'Git & GitHub overview: init, commit, push, pull, portfolio building', 'VS Code setup: Python extensions, linting, shortcuts'] },
      { moduleTitle: 'Chapter 2 — Data Types, Numbers & Strings', topics: ['Core data types: integers, floats, strings, booleans', 'Numbers & arithmetic: +, -, *, /, //, %, **, math module', 'Variables & assignment: dynamic typing, naming conventions', 'String indexing & slicing: [start:stop:step], negative indexing', "String methods: .upper(), .lower(), .replace(), .split(), .strip(), .find()", 'Print formatting: f-strings, .format(), % formatting'] },
      { moduleTitle: 'Chapter 3 — Data Structures', topics: ['Lists: create, append, remove, sort, slice, nested lists', 'Dictionaries: key-value pairs, .keys(), .values(), .items(), nesting', 'Tuples: immutable sequences, unpacking, function returns', 'Sets: unique values, union, intersection, difference, deduplication', 'Booleans: True/False, truthy/falsy values', 'File I/O: open, read, write, context managers (with open)'] },
      { moduleTitle: 'Chapter 4 — Operators & Logical Chaining', topics: ['Comparison operators: ==, !=, >, <, >=, <=', 'Logical operators: and, or, not', 'Chained comparisons: 1 < x < 10'] },
      { moduleTitle: 'Chapter 5 — Control Flow Statements', topics: ['if / elif / else branching, multiple cases with elif chains', 'for loops: iterate over lists, strings, ranges, dictionaries', 'enumerate, zip, range for powerful loops', 'while loops: break, continue, pass', 'List comprehensions: elegant one-liners', 'Useful operators: in, not in, is'] },
      { moduleTitle: 'Chapter 6 — Functions', topics: ['def keyword: parameters, return values, default arguments', 'Logic building: translating problems into function logic', '*args & **kwargs: flexible function signatures', 'Lambda functions, map, filter', 'Local vs global scope'] },
      { moduleTitle: 'Milestone Project 1 — Logic & Fundamentals', topics: ['Build a complete Python application from scratch', 'Apply: variables, strings, lists, dictionaries, loops, conditionals, functions', 'Code review: quality, logic, readability, best practices'] },
      { moduleTitle: 'Chapter 7 — Object-Oriented Programming (OOP)', topics: ['Classes & objects: blueprints and instances', 'Attributes & methods, __init__ constructor', 'Inheritance & polymorphism: class hierarchies, method overriding', 'Magic/dunder methods: __str__, __len__, __add__'] },
      { moduleTitle: 'Chapter 8 — Modules, Packages & Error Handling', topics: ['Creating and importing custom modules', 'Pip & PyPI: installing third-party libraries', "__name__ == '__main__', package folders", 'try / except / finally blocks', 'Raising custom exceptions', 'Pylint for code quality, Unittest for automated tests'] },
      { moduleTitle: 'Milestone Project 2 — OOP Application', topics: ['Design class hierarchies, define attributes and methods', 'Build with OOP principles, modular structure, exception handling', 'Write unit tests, Pylint review, expert code review & refactor'] },
      { moduleTitle: 'Chapter 9 — Decorators & Generators', topics: ['Decorators: wrap functions to add behaviour, @wraps, @property', 'Build custom decorators, understand framework decorators', 'Generators: yield keyword, memory-efficient iterators', 'Lazy processing for large datasets, file streaming, API pagination'] },
      { moduleTitle: 'Chapter 10 — Advanced Modules & Web Scraping', topics: ['Collections: Counter, defaultdict, namedtuple, deque', 'OS module: file system operations, directory management', 'datetime module, timeit for performance measurement', 'Regular expressions (re module)', 'Web scraping with BeautifulSoup & requests', 'Working with APIs: JSON, requests library'] },
      { moduleTitle: 'Chapter 11 — Web Development: Flask & Django', topics: ['Flask: routing, templates, REST APIs, deployment', 'Django: project structure, models, views, templates, admin', 'Building a complete web application'] },
      { moduleTitle: 'Milestone Project 3 — Final Capstone', topics: ['Full Python application using all concepts learned', 'Web application or automation project', 'GitHub portfolio, expert mentor review'] },
    ],
    projects: [
      { title: 'Milestone 1: Logic App', description: 'Complete Python application applying all fundamental concepts' },
      { title: 'Milestone 2: OOP Application', description: 'Object-oriented application with classes, inheritance, and testing' },
      { title: 'Milestone 3: Final Capstone', description: 'Full Python project — web app or automation with GitHub deployment' },
      { title: 'Web Scraper', description: 'BeautifulSoup + requests to scrape and analyse real web data' },
      { title: 'Flask/Django Web App', description: 'Build and deploy a complete web application' },
    ],
    careerOpportunities: ['Python Developer', 'Backend Developer', 'Automation Engineer', 'Data Analyst (Python)', 'Junior Software Developer'],
    faqs: [
      { question: 'Do I need prior coding experience?', answer: 'No! This course starts from absolute zero. We set up your environment and teach every concept step by step.' },
      { question: 'What will I be able to build after this course?', answer: "You'll be able to build Python applications, web apps with Flask/Django, automation scripts, web scrapers, and more." },
      { question: 'Is this course enough to get a job?', answer: "Yes, combined with the milestone projects and GitHub portfolio, you'll be well-prepared for junior Python developer roles." },
      { question: 'Are classes live or recorded?', answer: 'Both! Attend live classes online or offline, with recorded backups available for revision.' },
    ],
    isFeatured: true,
    displayOrder: 5,
  },
  {
    title: 'Data Science',
    slug: 'data-science',
    shortDescription:
      'Master Python, Statistics, Machine Learning, Deep Learning, NLP, and deploy AI models. Build 5+ real-world projects.',
    fullDescription:
      'Become a Data Scientist with our comprehensive, project-based Data Science course. Master Python, Statistics, Machine Learning, Deep Learning, NLP, and learn to deploy production-ready AI models.',
    duration: '4 Months',
    mode: 'Hybrid',
    level: 'Intermediate',
    fees: 35000,
    technologies: ['Python', 'NumPy', 'Pandas', 'Scikit-learn', 'TensorFlow', 'Keras', 'NLP', 'SQL', 'Matplotlib', 'Power BI'],
    curriculum: [
      { moduleTitle: 'Python for Data Science', topics: ['Python Basics', 'NumPy & Pandas', 'Data Manipulation', 'File Handling'] },
      { moduleTitle: 'Statistics & Probability', topics: ['Descriptive Stats', 'Probability', 'Hypothesis Testing', 'A/B Testing'] },
      { moduleTitle: 'Machine Learning', topics: ['Regression', 'Classification', 'Clustering', 'Model Evaluation'] },
      { moduleTitle: 'Deep Learning', topics: ['Neural Networks', 'CNNs', 'RNNs', 'Transfer Learning'] },
      { moduleTitle: 'NLP & GenAI', topics: ['Text Processing', 'Sentiment Analysis', 'LLMs', 'Prompt Engineering'] },
      { moduleTitle: 'Deployment & Projects', topics: ['Flask/FastAPI', 'Docker Basics', 'AWS/GCP', 'Capstone Project'] },
    ],
    projects: [
      { title: 'Customer Churn Prediction', description: 'Build an ML model to predict customer churn for a telecom company' },
      { title: 'Sentiment Analyzer', description: 'NLP pipeline to analyze product reviews and social media sentiment' },
      { title: 'Image Classifier', description: 'Deep learning model for image classification using CNNs' },
      { title: 'Recommendation Engine', description: 'Collaborative filtering system for e-commerce product recommendations' },
      { title: 'End-to-End ML Pipeline', description: 'Full capstone project from data collection to deployment' },
    ],
    careerOpportunities: ['Data Scientist', 'ML Engineer', 'Data Analyst', 'AI Researcher', 'Business Analyst'],
    faqs: [
      { question: 'Do I need prior programming experience?', answer: 'Basic programming knowledge is helpful but not mandatory. We start from Python basics.' },
      { question: 'Is this course suitable for freshers?', answer: 'Yes! Many of our freshers have landed jobs at top MNCs after completing this course.' },
      { question: 'What is the placement support?', answer: 'We provide resume building, mock interviews, job referrals, and interview preparation support.' },
      { question: 'Can I pay in installments?', answer: 'Yes, we offer flexible EMI options. Contact us for details.' },
    ],
    isFeatured: true,
    displayOrder: 1,
  },
  {
    title: 'Artificial Intelligence',
    slug: 'artificial-intelligence',
    shortDescription:
      'Deep dive into Neural Networks, Computer Vision, NLP, Reinforcement Learning, and Generative AI applications.',
    fullDescription:
      'Deep dive into Neural Networks, Computer Vision, NLP, Reinforcement Learning, and Generative AI applications.',
    duration: '5 Months',
    mode: 'Hybrid',
    level: 'Advanced',
    fees: 45000,
    technologies: ['Python', 'TensorFlow', 'PyTorch', 'Keras', 'OpenCV', 'NLP', 'GenAI', 'LangChain', 'Hugging Face'],
    curriculum: [
      { moduleTitle: 'Neural Network Foundations', topics: ['Perceptrons', 'Activation Functions', 'Backpropagation', 'Optimisers'] },
      { moduleTitle: 'Computer Vision', topics: ['CNNs', 'Object Detection', 'Image Segmentation', 'OpenCV'] },
      { moduleTitle: 'NLP & Transformers', topics: ['Word Embeddings', 'Attention Mechanism', 'BERT', 'GPT Architecture'] },
      { moduleTitle: 'Generative AI', topics: ['GANs', 'Diffusion Models', 'LLM Fine-tuning', 'Prompt Engineering'] },
      { moduleTitle: 'Reinforcement Learning', topics: ['Q-Learning', 'Policy Gradients', 'Deep RL', 'Gym Environments'] },
      { moduleTitle: 'AI in Production', topics: ['Model Serving', 'MLOps Basics', 'Docker', 'Cloud Deployment'] },
    ],
    projects: [
      { title: 'Image Recognition System', description: 'Build a CNN-based image classifier with transfer learning' },
      { title: 'Chatbot with LLM', description: 'Build an AI chatbot using LangChain and OpenAI/Hugging Face' },
      { title: 'Object Detection App', description: 'Real-time object detection using YOLO' },
    ],
    careerOpportunities: ['AI Engineer', 'ML Engineer', 'Computer Vision Engineer', 'NLP Engineer', 'Research Scientist'],
    faqs: [
      { question: 'What prerequisites are needed?', answer: 'Strong Python skills and basic ML knowledge. Our Data Science course is a recommended prerequisite.' },
      { question: 'Do you cover GenAI?', answer: 'Yes! We cover GANs, diffusion models, LLM fine-tuning, LangChain, and practical prompt engineering.' },
    ],
    isFeatured: true,
    displayOrder: 3,
  },
  {
    title: 'Power BI',
    slug: 'power-bi',
    shortDescription: 'Create stunning interactive dashboards and reports. Master DAX, data modeling, and business intelligence.',
    fullDescription: 'Create stunning interactive dashboards and reports. Master DAX, data modeling, and business intelligence.',
    duration: '2 Months',
    mode: 'Online & Offline',
    level: 'Beginner',
    fees: 12000,
    technologies: ['DAX', 'Dashboards', 'Data Modeling', 'ETL', 'Visualization'],
    curriculum: [],
    projects: [],
    careerOpportunities: [],
    faqs: [],
    isFeatured: true,
    displayOrder: 6,
  },
  {
    title: 'SQL',
    slug: 'sql',
    shortDescription: 'Master SQL queries, joins, subqueries, window functions, CTEs, and database design. Practice on real databases.',
    fullDescription: 'Master SQL queries, joins, subqueries, window functions, CTEs, and database design. Practice on real databases.',
    duration: '6 Weeks',
    mode: 'Online & Offline',
    level: 'Beginner',
    fees: 8000,
    technologies: ['MySQL', 'Queries', 'Joins', 'Window Functions', 'CTEs'],
    curriculum: [],
    projects: [],
    careerOpportunities: [],
    faqs: [],
    isFeatured: false,
    displayOrder: 7,
  },
  {
    title: 'Java Programming',
    slug: 'java-programming',
    shortDescription: 'Learn Java from scratch — OOP, Collections, Multithreading, JDBC, and introduction to Spring Boot.',
    fullDescription: 'Learn Java from scratch — OOP, Collections, Multithreading, JDBC, and introduction to Spring Boot.',
    duration: '3 Months',
    mode: 'Offline',
    level: 'Beginner',
    fees: 20000,
    technologies: ['Java', 'OOP', 'Collections', 'JDBC', 'Spring Boot'],
    curriculum: [],
    projects: [],
    careerOpportunities: [],
    faqs: [],
    isFeatured: false,
    displayOrder: 8,
  },
  {
    title: 'C/C++ Programming',
    slug: 'c-cpp-programming',
    shortDescription: 'Solid foundation in C and C++ — pointers, memory management, STL, and data structures basics.',
    fullDescription: 'Solid foundation in C and C++ — pointers, memory management, STL, and data structures basics.',
    duration: '2 Months',
    mode: 'Offline',
    level: 'Beginner',
    fees: 10000,
    technologies: ['C', 'C++', 'Pointers', 'STL', 'DSA Basics'],
    curriculum: [],
    projects: [],
    careerOpportunities: [],
    faqs: [],
    isFeatured: false,
    displayOrder: 9,
  },
  {
    title: 'MS Excel',
    slug: 'ms-excel',
    shortDescription: 'Master Excel for business — advanced formulas, pivot tables, macros, VBA, and data analysis.',
    fullDescription: 'Master Excel for business — advanced formulas, pivot tables, macros, VBA, and data analysis.',
    duration: '4 Weeks',
    mode: 'Online',
    level: 'Beginner',
    fees: 5000,
    technologies: ['Formulas', 'Pivot Tables', 'VBA', 'Macros', 'Charts'],
    curriculum: [],
    projects: [],
    careerOpportunities: [],
    faqs: [],
    isFeatured: false,
    displayOrder: 10,
  },
];

async function seed() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB. Seeding courses...');

  for (const c of courses) {
    await Course.findOneAndUpdate(
      { slug: c.slug },
      {
        $set: {
          title: c.title,
          shortDescription: c.shortDescription,
          fullDescription: c.fullDescription,
          thumbnailUrl: PLACEHOLDER_THUMBNAIL,
          duration: c.duration,
          mode: mapMode(c.mode),
          level: mapLevel(c.level),
          fees: c.fees,
          technologies: c.technologies,
          curriculum: c.curriculum,
          projects: c.projects,
          careerOpportunities: c.careerOpportunities,
          faqs: c.faqs,
          isFeatured: c.isFeatured,
          isActive: true,
          displayOrder: c.displayOrder,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    console.log(`  upserted: ${c.slug}`);
  }

  console.log(`Done. ${courses.length} courses seeded.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
