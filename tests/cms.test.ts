import request from 'supertest';
import app from '../src/app';
import User from '../src/models/User';
import { connectTestDB, clearTestDB, disconnectTestDB } from './setup/db';

beforeAll(async () => {
  await connectTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

async function adminAgent() {
  await User.create({ email: 'admin@example.com', password: 'Password123', role: 'admin' });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: 'admin@example.com', password: 'Password123' });
  return agent;
}

async function studentAgent() {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email: 'student@example.com', password: 'Password123' });
  return agent;
}

describe('Testimonials CMS', () => {
  it('lets an admin create a testimonial, and it appears on the public endpoint', async () => {
    const admin = await adminAgent();
    const create = await admin.post('/api/testimonials').send({
      studentName: 'Jane Doe',
      courseName: 'Data Science',
      testimonialText: 'Great course!',
      rating: 5,
    });
    expect(create.status).toBe(201);

    const publicList = await request(app).get('/api/testimonials');
    expect(publicList.status).toBe(200);
    expect(publicList.body.data).toHaveLength(1);
    expect(publicList.body.data[0].studentName).toBe('Jane Doe');
  });

  it('excludes inactive testimonials from the public endpoint but includes them for admins', async () => {
    const admin = await adminAgent();
    await admin.post('/api/testimonials').send({
      studentName: 'Inactive Student',
      courseName: 'Python',
      testimonialText: 'Hidden',
      rating: 4,
      isActive: false,
    });

    const publicList = await request(app).get('/api/testimonials');
    expect(publicList.body.data).toHaveLength(0);

    const adminList = await admin.get('/api/testimonials/admin/all');
    expect(adminList.body.data).toHaveLength(1);
  });

  it('blocks a non-admin student from creating a testimonial', async () => {
    const student = await studentAgent();
    const res = await student.post('/api/testimonials').send({
      studentName: 'x', courseName: 'x', testimonialText: 'x', rating: 5,
    });
    expect(res.status).toBe(401);
  });
});

describe('Gallery CMS', () => {
  it('lets an admin upload and delete a gallery image', async () => {
    const admin = await adminAgent();
    const create = await admin.post('/api/gallery').send({
      imageUrl: 'https://example.com/a.jpg',
      thumbnailUrl: 'https://example.com/a-thumb.jpg',
      category: 'classroom',
      caption: 'Test image',
    });
    expect(create.status).toBe(201);
    const id = create.body.data._id;

    const publicList = await request(app).get('/api/gallery');
    expect(publicList.body.data).toHaveLength(1);

    const del = await admin.delete(`/api/gallery/${id}`);
    expect(del.status).toBe(200);

    const afterDelete = await request(app).get('/api/gallery');
    expect(afterDelete.body.data).toHaveLength(0);
  });

  it('filters the public gallery by category', async () => {
    const admin = await adminAgent();
    await admin.post('/api/gallery').send({
      imageUrl: 'https://example.com/a.jpg', thumbnailUrl: 'https://example.com/a.jpg', category: 'classroom',
    });
    await admin.post('/api/gallery').send({
      imageUrl: 'https://example.com/b.jpg', thumbnailUrl: 'https://example.com/b.jpg', category: 'events',
    });

    const events = await request(app).get('/api/gallery?category=events');
    expect(events.body.data).toHaveLength(1);
    expect(events.body.data[0].category).toBe('events');
  });
});

describe('Blog CMS', () => {
  it('lets an admin create a published blog post visible on the public endpoints, and hides drafts', async () => {
    const admin = await adminAgent();
    const create = await admin.post('/api/blogs').send({
      title: 'Hello World',
      excerpt: 'An excerpt',
      content: 'Full content here',
      coverImageUrl: 'https://example.com/cover.jpg',
      category: 'Tech',
      isPublished: true,
    });
    expect(create.status).toBe(201);
    expect(create.body.data.slug).toBe('hello-world');

    const draft = await admin.post('/api/blogs').send({
      title: 'Draft Post',
      excerpt: 'Not yet',
      content: 'wip',
      coverImageUrl: 'https://example.com/cover2.jpg',
      category: 'Tech',
      isPublished: false,
    });
    expect(draft.status).toBe(201);

    const publicList = await request(app).get('/api/blogs');
    expect(publicList.body.data).toHaveLength(1);
    expect(publicList.body.data[0].title).toBe('Hello World');

    const bySlug = await request(app).get('/api/blogs/hello-world');
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.data.content).toBe('Full content here');

    const draftBySlug = await request(app).get('/api/blogs/draft-post');
    expect(draftBySlug.status).toBe(404);

    const adminAll = await admin.get('/api/blogs/admin/all');
    expect(adminAll.body.data).toHaveLength(2);
  });

  it('increments view count when a published post is fetched by slug', async () => {
    const admin = await adminAgent();
    await admin.post('/api/blogs').send({
      title: 'Popular Post',
      excerpt: 'x',
      content: 'x',
      coverImageUrl: 'https://example.com/c.jpg',
      category: 'Tech',
      isPublished: true,
    });

    await request(app).get('/api/blogs/popular-post');
    const second = await request(app).get('/api/blogs/popular-post');
    expect(second.body.data.viewCount).toBe(2);
  });
});
