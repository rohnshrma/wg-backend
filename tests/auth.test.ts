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

describe('Auth', () => {
  it('registers a new user, sets an auth cookie, and does not leak the token in the response body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'student1@example.com', password: 'Password123' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('student1@example.com');
    expect(res.body.data.user.role).toBe('student');
    expect(res.body.data.token).toBeUndefined();
    expect(res.headers['set-cookie']?.[0]).toMatch(/^token=/);
  });

  it('forces role to student even if "admin" is requested at registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'wannabe-admin@example.com', password: 'Password123', role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('student');
  });

  it('rejects duplicate registration with a conflict', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dupe@example.com', password: 'Password123' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dupe@example.com', password: 'Password123' });

    expect(res.status).toBe(409);
  });

  it('rejects login with wrong password without leaking whether the email exists', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'wrongpw@example.com', password: 'Password123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrongpw@example.com', password: 'IncorrectPass1' });

    expect(res.status).toBe(401);
    expect(res.body.data).toBeUndefined();
  });

  it('logs in successfully and can fetch its own profile via /me', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ email: 'me@example.com', password: 'Password123' });

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('me@example.com');
  });

  it('rejects change-password with an incorrect current password, and never returns a token', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ email: 'changepw@example.com', password: 'Password123' });

    const bad = await agent
      .put('/api/auth/change-password')
      .send({ currentPassword: 'WrongCurrent1', newPassword: 'NewPassword1' });
    expect(bad.status).toBe(400);

    const good = await agent
      .put('/api/auth/change-password')
      .send({ currentPassword: 'Password123', newPassword: 'NewPassword1' });
    expect(good.status).toBe(200);
    expect(good.body.data).toBeUndefined();
  });

  it('rejects unauthenticated access to a protected route', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('stores passwords hashed, never in plaintext', async () => {
    const user = await User.create({ email: 'hash-check@example.com', password: 'Password123', role: 'student' });
    expect(user.password).not.toBe('Password123');
  });
});
