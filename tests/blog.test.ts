import request from 'supertest';
import app from '../src/app';
import User from '../src/models/User';
import Blog from '../src/models/Blog';
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

async function createBlogPost(admin: any, overrides: Record<string, any> = {}) {
  const defaults = {
    title: 'Getting Started with Data Science',
    excerpt: 'An introduction to data science concepts and career paths.',
    content: '<h1>Data Science</h1><p>Data science is an interdisciplinary field...</p>',
    contentType: 'html',
    coverImageUrl: 'https://res.cloudinary.com/demo/image/upload/cover.jpg',
    category: 'Career',
    tags: ['data-science', 'career', 'beginner'],
    isPublished: true,
  };
  const payload = { ...defaults, ...overrides };
  return admin.post('/api/blogs').send(payload);
}

describe('Blog CMS - Public Endpoints', () => {
  it('lists published blogs with pagination (public endpoint)', async () => {
    const admin = await adminAgent();

    for (let i = 0; i < 15; i++) {
      await createBlogPost(admin, {
        title: `Blog Post ${i + 1}`,
        slug: `blog-post-${i + 1}`,
      });
    }

    const res = await request(app).get('/api/blogs?page=1&limit=9');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(9);
    expect(res.body.meta.total).toBe(15);
    expect(res.body.meta.totalPages).toBe(2);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(9);
  });

  it('excludes unpublished drafts from public listing', async () => {
    const admin = await adminAgent();

    await createBlogPost(admin, { title: 'Published Post', isPublished: true });
    await createBlogPost(admin, { title: 'Draft Post', isPublished: false });

    const res = await request(app).get('/api/blogs');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Published Post');
  });

  it('excludes content field from public listing to reduce payload', async () => {
    const admin = await adminAgent();
    await createBlogPost(admin, { title: 'Test Post' });

    const res = await request(app).get('/api/blogs');
    expect(res.status).toBe(200);
    expect(res.body.data[0]).not.toHaveProperty('content');
    expect(res.body.data[0].title).toBe('Test Post');
  });

  it('filters blogs by category', async () => {
    const admin = await adminAgent();

    await createBlogPost(admin, { title: 'Career Post', category: 'Career' });
    await createBlogPost(admin, { title: 'AI Post', category: 'AI' });
    await createBlogPost(admin, { title: 'ML Post', category: 'Machine Learning' });

    const res = await request(app).get('/api/blogs?category=Career');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Career Post');
  });

  it('searches blogs by title', async () => {
    const admin = await adminAgent();

    await createBlogPost(admin, { title: 'Advanced Python Techniques' });
    await createBlogPost(admin, { title: 'Getting Started with JavaScript' });
    await createBlogPost(admin, { title: 'Python for Data Analysis' });

    const res = await request(app).get('/api/blogs?search=Python');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('searches blogs by excerpt', async () => {
    const admin = await adminAgent();

    await createBlogPost(admin, {
      title: 'Post 1',
      excerpt: 'This covers machine learning basics.',
    });
    await createBlogPost(admin, {
      title: 'Post 2',
      excerpt: 'A guide to web development.',
    });

    const res = await request(app).get('/api/blogs?search=machine');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Post 1');
  });

  it('searches blogs by tags', async () => {
    const admin = await adminAgent();

    await createBlogPost(admin, { tags: ['python', 'beginner'] });
    await createBlogPost(admin, { tags: ['javascript', 'advanced'] });

    const res = await request(app).get('/api/blogs?search=python');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('combines category filter and search', async () => {
    const admin = await adminAgent();

    await createBlogPost(admin, {
      title: 'Python Career',
      category: 'Career',
    });
    await createBlogPost(admin, {
      title: 'Python Tutorials',
      category: 'Tutorials',
    });

    const res = await request(app).get('/api/blogs?category=Career&search=Python');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].category).toBe('Career');
  });

  it('fetches a single published blog by slug', async () => {
    const admin = await adminAgent();
    const create = await createBlogPost(admin, { title: 'Unique Post', category: 'Tutorial' });
    const slug = create.body.data.slug;

    const res = await request(app).get(`/api/blogs/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Unique Post');
    expect(res.body.data.content).toBeDefined();
    expect(res.body.data.author).toBeDefined();
  });

  it('increments viewCount when fetching a blog by slug', async () => {
    const admin = await adminAgent();
    await createBlogPost(admin);

    const first = await request(app).get('/api/blogs/getting-started-with-data-science');
    expect(first.body.data.viewCount).toBe(1);

    const second = await request(app).get('/api/blogs/getting-started-with-data-science');
    expect(second.body.data.viewCount).toBe(2);

    const third = await request(app).get('/api/blogs/getting-started-with-data-science');
    expect(third.body.data.viewCount).toBe(3);
  });

  it('returns 404 for unpublished blog slug', async () => {
    const admin = await adminAgent();
    await createBlogPost(admin, {
      title: 'Draft Post',
      isPublished: false,
    });

    const res = await request(app).get('/api/blogs/draft-post');
    expect(res.status).toBe(404);
  });

  it('returns 404 for nonexistent blog slug', async () => {
    const res = await request(app).get('/api/blogs/nonexistent-slug');
    expect(res.status).toBe(404);
  });

  it('populates author email in public listing', async () => {
    const admin = await adminAgent();
    await createBlogPost(admin);

    const res = await request(app).get('/api/blogs');
    expect(res.status).toBe(200);
    expect(res.body.data[0].author).toBeDefined();
    expect(res.body.data[0].author.email).toBe('admin@example.com');
  });

  it('sorts public blogs by publishedAt descending', async () => {
    const admin = await adminAgent();

    const post1 = await createBlogPost(admin, { title: 'Post 1' });
    expect(post1.status).toBe(201);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const post2 = await createBlogPost(admin, { title: 'Post 2' });
    expect(post2.status).toBe(201);

    const res = await request(app).get('/api/blogs');
    expect(res.status).toBe(200);
    expect(res.body.data[0].title).toBe('Post 2');
    expect(res.body.data[1].title).toBe('Post 1');
  });
});

describe('Blog CMS - Admin Endpoints', () => {
  it('allows admin to create a blog post', async () => {
    const admin = await adminAgent();

    const res = await createBlogPost(admin, { title: 'My First Blog' });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('My First Blog');
    expect(res.body.data.slug).toBe('my-first-blog');
    expect(res.body.data.author).toBeDefined();
    expect(res.body.data.isPublished).toBe(true);
    expect(res.body.data.publishedAt).toBeDefined();
  });

  it('generates unique slug for blog posts', async () => {
    const admin = await adminAgent();

    const post1 = await createBlogPost(admin, { title: 'Unique Title' });
    expect(post1.status).toBe(201);
    expect(post1.body.data.slug).toBe('unique-title');

    const post2 = await createBlogPost(admin, { title: 'Unique Title' });
    expect(post2.status).toBe(201);
    expect(post2.body.data.slug).not.toBe('unique-title');
    expect(post2.body.data.slug).toMatch(/^unique-title/);
  });

  it('requires title when creating blog post', async () => {
    const admin = await adminAgent();

    const res = await admin.post('/api/blogs').send({
      excerpt: 'No title here',
      content: 'Some content',
      contentType: 'html',
      coverImageUrl: 'https://example.com/image.jpg',
      category: 'Tutorial',
    });

    expect(res.status).toBe(422);
  });

  it('requires excerpt when creating blog post', async () => {
    const admin = await adminAgent();

    const res = await admin.post('/api/blogs').send({
      title: 'Title Here',
      content: 'Some content',
      contentType: 'html',
      coverImageUrl: 'https://example.com/image.jpg',
      category: 'Tutorial',
    });

    expect(res.status).toBe(422);
  });

  it('enforces excerpt max length (300 chars)', async () => {
    const admin = await adminAgent();
    const longExcerpt = 'a'.repeat(301);

    const res = await admin.post('/api/blogs').send({
      title: 'Title',
      excerpt: longExcerpt,
      content: 'Some content',
      contentType: 'html',
      coverImageUrl: 'https://example.com/image.jpg',
      category: 'Tutorial',
    });

    expect(res.status).toBe(422);
  });

  it('creates draft posts without publishedAt', async () => {
    const admin = await adminAgent();

    const res = await createBlogPost(admin, {
      title: 'Draft Post',
      isPublished: false,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.isPublished).toBe(false);
    expect(res.body.data.publishedAt).toBeUndefined();
  });

  it('lists all blogs (including drafts) in admin endpoint', async () => {
    const admin = await adminAgent();

    await createBlogPost(admin, { title: 'Published Post', isPublished: true });
    await createBlogPost(admin, { title: 'Draft Post', isPublished: false });

    const res = await admin.get('/api/blogs/admin/all');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.some((b: any) => !b.isPublished)).toBe(true);
  });

  it('sorts admin blog listing by createdAt descending', async () => {
    const admin = await adminAgent();

    await createBlogPost(admin, { title: 'Older Post' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await createBlogPost(admin, { title: 'Newer Post' });

    const res = await admin.get('/api/blogs/admin/all');
    expect(res.status).toBe(200);
    expect(res.body.data[0].title).toBe('Newer Post');
    expect(res.body.data[1].title).toBe('Older Post');
  });

  it('allows admin to update blog post', async () => {
    const admin = await adminAgent();
    const create = await createBlogPost(admin, { title: 'Original Title' });
    const id = create.body.data._id;

    const update = await admin.put(`/api/blogs/${id}`).send({
      title: 'Updated Title',
      excerpt: 'Updated excerpt text here.',
    });

    expect(update.status).toBe(200);
    expect(update.body.data.title).toBe('Updated Title');
    expect(update.body.data.excerpt).toBe('Updated excerpt text here.');
  });

  it('updates slug when title changes', async () => {
    const admin = await adminAgent();
    const create = await createBlogPost(admin, { title: 'Original Title' });
    const id = create.body.data._id;

    const update = await admin.put(`/api/blogs/${id}`).send({
      title: 'New Different Title',
    });

    expect(update.status).toBe(200);
    expect(update.body.data.slug).toBe('new-different-title');
  });

  it('does not reset publishedAt when updating already-published post', async () => {
    const admin = await adminAgent();
    const create = await createBlogPost(admin, {
      title: 'Original',
      isPublished: true,
    });
    const originalPublishedAt = create.body.data.publishedAt;
    const id = create.body.data._id;

    await new Promise((resolve) => setTimeout(resolve, 10));

    const update = await admin.put(`/api/blogs/${id}`).send({
      title: 'Updated',
      isPublished: true,
    });

    expect(update.status).toBe(200);
    expect(update.body.data.publishedAt).toBe(originalPublishedAt);
  });

  it('sets publishedAt only on first publish transition', async () => {
    const admin = await adminAgent();
    const create = await createBlogPost(admin, {
      title: 'Draft',
      isPublished: false,
    });
    expect(create.body.data.publishedAt).toBeUndefined();
    const id = create.body.data._id;

    const publish = await admin.put(`/api/blogs/${id}`).send({
      isPublished: true,
    });

    expect(publish.status).toBe(200);
    expect(publish.body.data.publishedAt).toBeDefined();

    const secondTime = publish.body.data.publishedAt;
    await new Promise((resolve) => setTimeout(resolve, 10));

    const updateAgain = await admin.put(`/api/blogs/${id}`).send({
      excerpt: 'New excerpt',
    });

    expect(updateAgain.body.data.publishedAt).toBe(secondTime);
  });

  it('fetches full blog with content for admin edit view', async () => {
    const admin = await adminAgent();
    const create = await createBlogPost(admin, {
      title: 'Full Content Post',
      content: '<h1>Long content</h1><p>This is the full article content.</p>',
    });
    const id = create.body.data._id;

    const res = await admin.get(`/api/blogs/admin/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.content).toBeDefined();
    expect(res.body.data.content).toContain('Long content');
  });

  it('populates author and related posts in admin edit view', async () => {
    const admin = await adminAgent();
    const related = await createBlogPost(admin, { title: 'Related Post' });
    const create = await createBlogPost(admin, {
      title: 'Main Post',
      relatedPosts: [related.body.data._id],
    });
    const id = create.body.data._id;

    const res = await admin.get(`/api/blogs/admin/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.author).toBeDefined();
    expect(res.body.data.author.email).toBe('admin@example.com');
    expect(res.body.data.relatedPosts).toHaveLength(1);
    expect(res.body.data.relatedPosts[0].title).toBe('Related Post');
  });

  it('returns 404 when updating nonexistent blog', async () => {
    const admin = await adminAgent();

    const res = await admin.put('/api/blogs/000000000000000000000000').send({
      title: 'New Title',
    });

    expect(res.status).toBe(404);
  });

  it('allows admin to delete blog post', async () => {
    const admin = await adminAgent();
    const create = await createBlogPost(admin);
    const id = create.body.data._id;

    const del = await admin.delete(`/api/blogs/${id}`);
    expect(del.status).toBe(200);

    const check = await request(app).get('/api/blogs');
    expect(check.body.data).toHaveLength(0);
  });

  it('returns 404 when deleting nonexistent blog', async () => {
    const admin = await adminAgent();

    const res = await admin.delete('/api/blogs/000000000000000000000000');
    expect(res.status).toBe(404);
  });
});

describe('Blog CMS - Access Control', () => {
  it('blocks non-admin from creating blog post', async () => {
    const student = await studentAgent();

    const res = await student.post('/api/blogs').send({
      title: 'Unauthorized Post',
      excerpt: 'This should fail',
      content: 'Content here',
      contentType: 'html',
      coverImageUrl: 'https://example.com/image.jpg',
      category: 'Tutorial',
    });

    expect(res.status).toBe(403);
  });

  it('blocks non-admin from accessing admin all endpoint', async () => {
    const student = await studentAgent();

    const res = await student.get('/api/blogs/admin/all');
    expect(res.status).toBe(403);
  });

  it('blocks non-admin from updating blog post', async () => {
    const admin = await adminAgent();
    const create = await createBlogPost(admin);
    const id = create.body.data._id;

    const student = await studentAgent();
    const res = await student.put(`/api/blogs/${id}`).send({
      title: 'Hacked Title',
    });

    expect(res.status).toBe(403);
  });

  it('blocks non-admin from deleting blog post', async () => {
    const admin = await adminAgent();
    const create = await createBlogPost(admin);
    const id = create.body.data._id;

    const student = await studentAgent();
    const res = await student.delete(`/api/blogs/${id}`);

    expect(res.status).toBe(403);
  });

  it('allows unauthenticated users to view published blogs', async () => {
    const admin = await adminAgent();
    await createBlogPost(admin);

    const res = await request(app).get('/api/blogs');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 401 for unauthenticated access to admin endpoint', async () => {
    const res = await request(app).get('/api/blogs/admin/all');
    expect(res.status).toBe(401);
  });
});

describe('Blog CMS - Edge Cases', () => {
  it('handles empty blog list gracefully', async () => {
    const res = await request(app).get('/api/blogs');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
    expect(res.body.meta.totalPages).toBe(0);
  });

  it('handles search with no results', async () => {
    const admin = await adminAgent();
    await createBlogPost(admin, { title: 'Post 1' });

    const res = await request(app).get('/api/blogs?search=nonexistent');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('handles pagination edge case: page > total pages', async () => {
    const admin = await adminAgent();
    await createBlogPost(admin, { title: 'Only Post' });

    const res = await request(app).get('/api/blogs?page=5&limit=9');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.page).toBe(5);
  });

  it('handles special characters in search query', async () => {
    const admin = await adminAgent();
    await createBlogPost(admin, { title: 'C++ Programming Guide' });

    const res = await request(app).get('/api/blogs?search=C%2B%2B');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('preserves metadata when updating blog without changing content fields', async () => {
    const admin = await adminAgent();
    const create = await createBlogPost(admin, {
      metaTitle: 'Original Meta Title',
      metaDescription: 'Original meta description',
    });
    const id = create.body.data._id;

    const update = await admin.put(`/api/blogs/${id}`).send({
      excerpt: 'Updated excerpt',
    });

    expect(update.status).toBe(200);
    expect(update.body.data.metaTitle).toBe('Original Meta Title');
    expect(update.body.data.metaDescription).toBe('Original meta description');
  });

  it('allows metadata fields to be updated', async () => {
    const admin = await adminAgent();
    const create = await createBlogPost(admin);
    const id = create.body.data._id;

    const update = await admin.put(`/api/blogs/${id}`).send({
      metaTitle: 'New SEO Title',
      metaDescription: 'New SEO description for search engines',
    });

    expect(update.status).toBe(200);
    expect(update.body.data.metaTitle).toBe('New SEO Title');
    expect(update.body.data.metaDescription).toBe('New SEO description for search engines');
  });

  it('allows tags to be updated', async () => {
    const admin = await adminAgent();
    const create = await createBlogPost(admin, { tags: ['old-tag'] });
    const id = create.body.data._id;

    const update = await admin.put(`/api/blogs/${id}`).send({
      tags: ['new-tag', 'another-tag'],
    });

    expect(update.status).toBe(200);
    expect(update.body.data.tags).toEqual(['new-tag', 'another-tag']);
  });
});
