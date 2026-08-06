/**
 * Sets Gurugram-targeted metaTitle/metaDescription on the live course
 * catalogue (MASTER_TASK_BOARD.md C4). These are currently empty on most/all
 * courses, so course detail pages fall back to a placeless
 * "${title} Course" title with zero local-search signal.
 *
 * Only touches metaTitle/metaDescription via $set on existing documents by
 * slug — never upserts (a slug with no match is almost certainly a typo,
 * not a course to create) and never touches any other field.
 *
 * SAFE BY DEFAULT: runs as a dry run unless --apply is passed. Point
 * MONGODB_URI at whichever environment you mean to update — dev, staging,
 * or production — this script has no environment awareness of its own.
 *
 *   npx ts-node src/scripts/seedCourseSeoMetadata.ts           # dry run
 *   npx ts-node src/scripts/seedCourseSeoMetadata.ts --apply   # writes
 */
import mongoose from 'mongoose';
import env from '../config/env';
import Course from '../models/Course';

// No trailing "— WebiGeeks" on any of these — courses/[slug]/page.tsx's
// generateMetadata sets `title: course.metaTitle`, which flows through the
// root layout's `%s | WebiGeeks Gurugram` template. Including the brand name
// here too produced a duplicated "...— WebiGeeks | WebiGeeks Gurugram" tail,
// caught via live curl verification against the /mern-course-gurugram page
// before this script was ever run against production.
const seoCopy: Record<string, { metaTitle: string; metaDescription: string }> = {
  'mern-stack-development': {
    metaTitle: 'MERN Stack Course in Gurugram | Full Stack Training',
    metaDescription:
      '7-month offline/online MERN Stack course in Sector-14, Gurugram. React, Node, MongoDB, 10+ live projects, 100% placement support. Batches of 15.',
  },
  'python-programming': {
    metaTitle: 'Python Course in Gurugram | Beginner to Advanced',
    metaDescription:
      'Learn Python from scratch in Gurugram — OOP, Flask/Django, 3 milestone projects. Offline classes in Sector-14 or online, with placement assistance.',
  },
  'data-analytics': {
    metaTitle: 'Data Analytics Course in Gurugram | Excel to Power BI',
    metaDescription:
      'Data Analytics training in Gurugram: Excel, SQL, Python, Power BI & Tableau. 6-7 month offline/online programme with real business projects.',
  },
  'power-bi': {
    metaTitle: 'Power BI Training in Gurgaon | Dashboards & DAX',
    metaDescription:
      '2-month Power BI course in Gurugram — DAX, data modeling, real dashboards, certification. Offline classes at our Sector-14 campus or online.',
  },
  'data-science': {
    metaTitle: 'Data Science Course in Gurugram | ML & Deep Learning',
    metaDescription:
      '4-month Data Science programme in Gurugram covering Python, ML, Deep Learning, NLP and GenAI, with production model deployment.',
  },
  'artificial-intelligence': {
    metaTitle: 'AI Course in Gurugram | Neural Networks to GenAI',
    metaDescription:
      'Advanced Artificial Intelligence training in Gurugram — Computer Vision, NLP, Transformers, Generative AI. 5-month hybrid programme.',
  },
  'java-programming': {
    metaTitle: 'Java Course in Gurugram | OOP to Spring Boot',
    metaDescription:
      '3-month offline Java programming course in Gurugram — OOP, Collections, JDBC, intro to Spring Boot. Interview-ready curriculum.',
  },
  'c-cpp-programming': {
    metaTitle: 'C / C++ Course in Gurugram | DSA Foundations',
    metaDescription:
      '2-month offline C/C++ classes in Gurugram building strong pointer, memory-management and DSA fundamentals for competitive coding.',
  },
  sql: {
    metaTitle: 'SQL Course in Gurugram | Joins to Window Functions',
    metaDescription:
      '6-week SQL training in Gurugram — joins, subqueries, window functions, CTEs. 100+ practice problems on real databases.',
  },
  'ms-excel': {
    metaTitle: 'MS Excel Course in Gurugram | Business Analysis',
    metaDescription:
      '4-week Excel training in Gurugram — advanced formulas, PivotTables, macros and VBA for business and data roles.',
  },
  'react-js': {
    metaTitle: 'React JS Course in Gurugram | Modern Frontend',
    metaDescription:
      'Hands-on React.js training in Gurugram — hooks, Redux Toolkit, routing and real project builds. Offline and online batches.',
  },
  typescript: {
    metaTitle: 'TypeScript Course in Gurugram | Type-Safe JavaScript',
    metaDescription:
      'TypeScript training in Gurugram for JS developers — generics, interfaces, React & Node integration. Small offline batches.',
  },
};

async function run() {
  const apply = process.argv.includes('--apply');

  await mongoose.connect(env.MONGODB_URI);
  console.log(`Connected to ${env.MONGODB_URI}`);
  console.log(apply ? 'Mode: APPLY (writing changes)' : 'Mode: DRY RUN (no writes — pass --apply to write)');
  console.log('');

  let matched = 0;
  let wouldChange = 0;
  const missingSlugs: string[] = [];

  for (const [slug, copy] of Object.entries(seoCopy)) {
    const course = await Course.findOne({ slug });
    if (!course) {
      missingSlugs.push(slug);
      continue;
    }
    matched++;

    const changed = course.metaTitle !== copy.metaTitle || course.metaDescription !== copy.metaDescription;
    if (changed) wouldChange++;

    console.log(`${changed ? '~' : '='} ${slug}`);
    if (changed) {
      console.log(`    metaTitle:       "${course.metaTitle ?? '(empty)'}" -> "${copy.metaTitle}"`);
      console.log(`    metaDescription: "${course.metaDescription ?? '(empty)'}" -> "${copy.metaDescription}"`);
    }

    if (apply && changed) {
      await Course.updateOne({ slug }, { $set: copy });
    }
  }

  console.log('');
  console.log(`Matched ${matched}/${Object.keys(seoCopy).length} slugs, ${wouldChange} would change.`);
  if (missingSlugs.length > 0) {
    console.log(`No course found for these slugs (skipped, not created): ${missingSlugs.join(', ')}`);
  }
  if (!apply && wouldChange > 0) {
    console.log('Dry run only — re-run with --apply to write these changes.');
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
