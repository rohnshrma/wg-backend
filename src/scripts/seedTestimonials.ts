/**
 * One-time seed: real Google Business reviews for WebiGeeks, pasted by the
 * user from the actual Google Maps listing. Safe to re-run — upserts by
 * (studentName, testimonialText) so it won't duplicate on a second run.
 *
 * Source text didn't include a star rating (only heart/pray reaction
 * counts), so every entry defaults to 5 — every review here reads as
 * satisfied and none expressed a complaint. Five reviews were cut off
 * mid-sentence by Google's own "…More" truncation in the copied text; those
 * are trimmed to the last complete sentence rather than guessing how they
 * end. Four reviews with no actual review text (just a reviewer name and
 * review count) and the business owner's own reply ("Thanx") were excluded
 * entirely — there's no real testimonial content to seed for those.
 *
 * 2026-08-10 update: appended a second batch (Dev Thakran through Shanu
 * Thakur below) from a fresh set of Google reviews the user supplied. Same
 * rules applied — "kashish Kumar Verma" had no review text and was
 * excluded, a few entries were trimmed at Google's "…More" cutoff, and
 * obvious typos (e.g. "WEEBIGEEK" -> "WebiGeeks") were lightly corrected
 * without changing the substance of what was written.
 */
import mongoose from 'mongoose';
import env from '../config/env';
import Testimonial from '../models/Testimonial';

interface SeedTestimonial {
  studentName: string;
  courseName: string;
  testimonialText: string;
  rating: number;
}

const GENERIC_COURSE = 'General Programming Courses';

const testimonials: SeedTestimonial[] = [
  {
    studentName: 'Siddharth Singh',
    courseName: 'Full Stack Development',
    testimonialText:
      'This is a one-stop solution for those who are passionate about upgrading their skills in the IT sector. I have started my learning journey with the Full Stack Development course from scratch.',
    rating: 5,
  },
  {
    studentName: 'Nakul Hans',
    courseName: 'MERN Stack Development',
    testimonialText:
      "I'm currently taking the MERN Stack course, and it's been great so far! The curriculum covers MongoDB, Express.js, React, and Node.js with practical projects like building an e-commerce app. Instructors are knowledgeable and make complex topics like APIs and React hooks easy to grasp.",
    rating: 5,
  },
  {
    studentName: 'Arya Rana',
    courseName: 'Full Stack Development',
    testimonialText:
      "I've had an exceptional experience with my full stack development teacher Rohan Sir over the past 2 months. In just 1.5 months, I successfully completed HTML, CSS, and Bootstrap and I'm currently diving into JavaScript.",
    rating: 5,
  },
  {
    studentName: 'Deepak Singh',
    courseName: 'MERN Stack Development',
    testimonialText:
      'Exceptional MERN coaching providing clear explanations, practical projects, and supportive guidance, helping learners build confidence and master full-stack development effectively.',
    rating: 5,
  },
  {
    studentName: 'Himanshu Beniwal',
    courseName: 'Full Stack Development',
    testimonialText:
      "I'm currently halfway through the Full-Stack Web Development course at WebiGeeks and am already impressed. The course material is comprehensive and up-to-date. The instructor is knowledgeable and supportive.",
    rating: 5,
  },
  {
    studentName: 'Archna Kashyap',
    courseName: 'Python Programming',
    testimonialText:
      "Rohan Sir's Python classes at this institution offer an exceptional learning experience. His passion, practical approach, and ability to simplify complex concepts create a dynamic and engaging classroom environment. I highly recommend his classes for anyone looking to build a strong foundation in Python and other programming languages.",
    rating: 5,
  },
  {
    studentName: 'Naitik Kushwaha',
    courseName: 'Full Stack Development',
    testimonialText:
      'WebiGeeks is the best coaching centre in Gurgaon Sector 14. My journey through the WebiGeeks full stack course was an absolute delight.',
    rating: 5,
  },
  {
    studentName: 'Ayush Mishra',
    courseName: GENERIC_COURSE,
    testimonialText:
      'Good for beginners. Teaching is very simple and easily understandable, even for someone who knows nothing about tech or IT. Highly recommend, friendly environment.',
    rating: 5,
  },
  {
    studentName: 'Tarun Baldia',
    courseName: GENERIC_COURSE,
    testimonialText:
      'One of the very few coaching centres in Sector 14 where the teacher is seriously dedicated in teaching and providing personalised support. It is recommended to visit this centre at least once if you are seeking to up-skill your programming skills.',
    rating: 5,
  },
  {
    studentName: 'Aditya Dixit',
    courseName: 'Full Stack Development',
    testimonialText:
      "Hats off to WebiGeeks! Just finished their full stack dev course, and wow! They're the real MVPs when it comes to setting you up for success. The focus on placement support, job assistance, and nailing interviews is on point.",
    rating: 5,
  },
  {
    studentName: 'Pradeep Jaiswal',
    courseName: 'Full Stack Development',
    testimonialText:
      'Took the full stack course from WebiGeeks and now working as a successful freelancer after completing it. They helped me with resume building, interview preparations and placement too.',
    rating: 5,
  },
  {
    studentName: 'Yogesh Kataria',
    courseName: 'MS Excel',
    testimonialText:
      'I am doing my Excel course from here, Rohan sir clears all my doubts in classes. He has good teaching skills.',
    rating: 5,
  },
  {
    studentName: 'Akshay Baldia',
    courseName: 'MERN Stack Development',
    testimonialText:
      'I really appreciate Rohan sir. I completed my MERN stack course and he is the best teacher in Sector 14 I found.',
    rating: 5,
  },
  {
    studentName: 'Aniket Vishnoi',
    courseName: GENERIC_COURSE,
    testimonialText:
      'Good experience of learning from them, knowledgeable faculty, and teaching is best. They resolve your doubts and guidance is very good from them. I recommend, please go through their courses, you will not feel regret at all.',
    rating: 5,
  },
  {
    studentName: 'Manisha Bhadana',
    courseName: GENERIC_COURSE,
    testimonialText:
      'Best sir for always helping me in every doubt. Thank you sir for your class. The way of taking it has been the best.',
    rating: 5,
  },
  {
    studentName: 'Akash Rajput',
    courseName: 'Full Stack Development',
    testimonialText: 'Perfect for study full stack, JavaScript, MERN, etc.',
    rating: 5,
  },
  {
    studentName: 'Suraj Partap',
    courseName: GENERIC_COURSE,
    testimonialText: 'Such a nice place for the beginner coders.',
    rating: 5,
  },
  {
    studentName: 'Sahil Vishan',
    courseName: GENERIC_COURSE,
    testimonialText: 'A trusted qualification that will progress your career faster.',
    rating: 5,
  },
  {
    studentName: 'Ravi Prajapat',
    courseName: GENERIC_COURSE,
    testimonialText: 'This is the best place to learn any coding language.',
    rating: 5,
  },
  {
    studentName: 'Subham Sharma',
    courseName: GENERIC_COURSE,
    testimonialText: 'This is the best place to learn any coding language.',
    rating: 5,
  },
  {
    studentName: 'Dev Thakran',
    courseName: 'Python Programming',
    testimonialText:
      "I'm currently learning Python through WebiGeeks, and my experience so far has been really positive. Till now, everything I've studied has been explained in a very clear and easy-to-understand way.",
    rating: 5,
  },
  {
    studentName: 'Aryan Saini',
    courseName: GENERIC_COURSE,
    testimonialText: 'The vibe is pretty chill, and the teachers are friendly and supportive.',
    rating: 5,
  },
  {
    studentName: 'Dhrona Blaggan',
    courseName: 'Full Stack Development',
    testimonialText:
      'I did my Python course and am currently doing the Full Stack Development course in Gurugram from WebiGeeks. Rohan Sir explains concepts really well and makes sure everyone understands before moving ahead.',
    rating: 5,
  },
  {
    studentName: 'Vinay Kumar Maurya',
    courseName: GENERIC_COURSE,
    testimonialText:
      'It was a great learning experience with such a great and friendly mentor, which made learning more interesting and effective. Every concept was explained clearly with real-life day-to-day examples. Thanks WebiGeeks, for guiding and helping me with my first coding language.',
    rating: 5,
  },
  {
    studentName: 'Kanika Tyagi',
    courseName: GENERIC_COURSE,
    testimonialText: 'Great teacher, practical learning, real-life projects, and doubt sessions.',
    rating: 5,
  },
  {
    studentName: 'sandeep singh',
    courseName: 'Data Analytics with Python',
    testimonialText:
      'A great learning experience in the Data Analyst course at WebiGeeks under the guidance of Rohan Sir. His teaching style is clear, structured, and very easy to understand, even for beginners.',
    rating: 5,
  },
  {
    studentName: 'Tanisha Solanki',
    courseName: GENERIC_COURSE,
    testimonialText: 'Excellent teaching skills.',
    rating: 5,
  },
  {
    studentName: 'Shanu Thakur',
    courseName: GENERIC_COURSE,
    testimonialText:
      "Joining WebiGeeks center was one of the best decisions I've made. The faculty is extremely knowledgeable, approachable, and always willing to clear doubts. The study material is well-structured, making complex topics easy to understand.",
    rating: 5,
  },
];

async function seed() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB. Seeding testimonials...');

  for (const [index, t] of testimonials.entries()) {
    await Testimonial.findOneAndUpdate(
      { studentName: t.studentName, testimonialText: t.testimonialText },
      {
        $set: {
          studentName: t.studentName,
          courseName: t.courseName,
          testimonialText: t.testimonialText,
          rating: t.rating,
          source: 'google',
          isActive: true,
          displayOrder: index,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    console.log(`  upserted: ${t.studentName}`);
  }

  console.log(`Done. ${testimonials.length} testimonials seeded.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
