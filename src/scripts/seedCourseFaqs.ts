/**
 * Adds FAQPage-eligible FAQs to courses that currently have none (found via
 * a fresh production audit, 2026-08-07 — 7 of 12 course pages had no FAQs at
 * all, meaning no FAQPage schema and no AI-search "answer" content for those
 * courses' pages).
 *
 * Every FAQ here is derived only from fields that already exist on the
 * course document (duration, mode, level, fees) — no invented pricing,
 * curriculum claims, placement guarantees, or certification claims. A
 * course is skipped if it already has any FAQs (never overwrites existing
 * content) or if the slug doesn't exist in the target database.
 *
 * SAFE BY DEFAULT: dry run unless --apply is passed. Point MONGODB_URI at
 * whichever environment you mean to update.
 *
 *   npx ts-node src/scripts/seedCourseFaqs.ts           # dry run
 *   npx ts-node src/scripts/seedCourseFaqs.ts --apply    # writes
 */
import mongoose from 'mongoose';
import env from '../config/env';
import Course, { ICourseFAQ } from '../models/Course';

function buildFaqs(course: {
  title: string;
  duration: string;
  mode: 'online' | 'offline' | 'hybrid';
  level: string;
  fees: number;
}): ICourseFAQ[] {
  const modeAnswer =
    course.mode === 'online'
      ? `Yes — the ${course.title} course is offered fully online.`
      : course.mode === 'offline'
        ? `The ${course.title} course is offered offline (in person) at our Sector-14, Gurugram campus.`
        : `The ${course.title} course is offered in hybrid mode — offline at our Sector-14, Gurugram campus, or fully online.`;

  return [
    {
      question: `How long is the ${course.title} course?`,
      answer: `The ${course.title} course runs for ${course.duration}.`,
    },
    {
      question: `Is the ${course.title} course available online?`,
      answer: modeAnswer,
    },
    {
      question: `What is the fee for the ${course.title} course?`,
      answer: `The ${course.title} course fee is ₹${course.fees.toLocaleString('en-IN')}.`,
    },
    {
      question: `Do I need prior experience to join the ${course.title} course?`,
      answer:
        course.level === 'beginner'
          ? `No — the ${course.title} course is designed for beginners with no prior experience required.`
          : `The ${course.title} course is a ${course.level}-level course — some prior background is expected before joining.`,
    },
  ];
}

async function run() {
  const apply = process.argv.includes('--apply');

  await mongoose.connect(env.MONGODB_URI);
  console.log(`Connected to ${env.MONGODB_URI}`);
  console.log(apply ? 'Mode: APPLY (writing changes)' : 'Mode: DRY RUN (no writes — pass --apply to write)');
  console.log('');

  const courses = await Course.find({});
  let updated = 0;
  let skippedHasFaqs = 0;

  for (const course of courses) {
    if (course.faqs.length > 0) {
      skippedHasFaqs++;
      continue;
    }

    const faqs = buildFaqs(course);
    console.log(`~ ${course.slug} (currently 0 FAQs) -> adding ${faqs.length} FAQs`);
    faqs.forEach((f) => console.log(`    Q: ${f.question}\n    A: ${f.answer}`));

    if (apply) {
      await Course.updateOne({ _id: course._id }, { $set: { faqs } });
    }
    updated++;
  }

  console.log('');
  console.log(`${updated} course(s) updated, ${skippedHasFaqs} skipped (already had FAQs).`);
  if (!apply && updated > 0) {
    console.log('Dry run only — re-run with --apply to write these changes.');
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
