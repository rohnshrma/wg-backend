import request from 'supertest';
import app from '../src/app';
import User from '../src/models/User';
import Student from '../src/models/Student';
import Course from '../src/models/Course';
import Payment from '../src/models/Payment';
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

const validProfilePayload = {
  fullName: 'Test Student',
  dateOfBirth: '2000-01-01',
  gender: 'male',
  fatherName: 'Father',
  motherName: 'Mother',
  parentContactNumber: '9999999999',
  studentContactNumber: '8888888888',
  email: 'student@example.com',
  address: { street: '1 Main St', city: 'City', state: 'State', pincode: '123456' },
  qualification: 'B.Tech',
  courseFees: 50000,
  joiningDate: '2026-01-01',
  paymentMode: 'emi',
};

describe('Student profile — mass-assignment protection', () => {
  it('lets a student create and self-edit their own profile within the allowed fields', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ email: 'student@example.com', password: 'Password123' });

    const create = await agent.put('/api/students/profile').send(validProfilePayload);
    expect(create.status).toBe(200);
    expect(create.body.data.status).toBe('pending');
    expect(create.body.data.isProfileLocked).toBe(false);
    expect(create.body.data.totalPaid).toBe(0);

    const studentId = create.body.data._id;

    const selfEdit = await agent
      .put(`/api/students/${studentId}`)
      .send({ fullName: 'Updated Name' });
    expect(selfEdit.status).toBe(200);
    expect(selfEdit.body.data.fullName).toBe('Updated Name');
  });

  it('blocks a student from self-approving or crediting themselves via the generic update route', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ email: 'attacker@example.com', password: 'Password123' });

    const create = await agent.put('/api/students/profile').send(validProfilePayload);
    const studentId = create.body.data._id;

    const exploit = await agent.put(`/api/students/${studentId}`).send({
      status: 'approved',
      isProfileLocked: true,
      totalPaid: 999999,
      admissionId: 'HACKED-001',
      approvedBy: studentId,
    });

    expect(exploit.status).toBe(200);
    expect(exploit.body.data.status).toBe('pending');
    expect(exploit.body.data.isProfileLocked).toBe(false);
    expect(exploit.body.data.totalPaid).toBe(0);
    expect(exploit.body.data.admissionId).toBeUndefined();

    const persisted = await Student.findById(studentId);
    expect(persisted?.status).toBe('pending');
    expect(persisted?.totalPaid).toBe(0);
  });

  it('blocks a student from editing another student\'s profile', async () => {
    const victim = request.agent(app);
    await victim.post('/api/auth/register').send({ email: 'victim@example.com', password: 'Password123' });
    const victimProfile = await victim.put('/api/students/profile').send(validProfilePayload);
    const victimId = victimProfile.body.data._id;

    const attacker = request.agent(app);
    await attacker.post('/api/auth/register').send({ email: 'other-attacker@example.com', password: 'Password123' });

    const res = await attacker.put(`/api/students/${victimId}`).send({ fullName: 'Pwned' });
    expect(res.status).toBe(403);

    const persisted = await Student.findById(victimId);
    expect(persisted?.fullName).toBe('Test Student');
  });

  it('lets an admin update any field on a student record', async () => {
    await User.create({ email: 'admin@example.com', password: 'Password123', role: 'admin' });
    const student = await Student.create({
      userId: (await User.create({ email: 'managed-student@example.com', password: 'Password123', role: 'student' }))._id,
      ...validProfilePayload,
      dateOfBirth: new Date(validProfilePayload.dateOfBirth),
      joiningDate: new Date(validProfilePayload.joiningDate),
    });

    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'admin@example.com', password: 'Password123' });

    const res = await agent.put(`/api/students/${student._id}`).send({ status: 'approved', totalPaid: 25000 });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.totalPaid).toBe(25000);
  });
});

describe('Pause / resume student account', () => {
  const setupAdminAndStudent = async () => {
    await User.create({ email: 'admin2@example.com', password: 'Password123', role: 'admin' });
    const studentUser = await User.create({
      email: 'paused-student@example.com',
      password: 'Password123',
      role: 'student',
    });
    const course = await Course.create({
      title: 'Full Stack Development',
      shortDescription: 'Learn full stack development',
      fullDescription: 'Learn full stack development in depth',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      duration: '6 months',
      fees: 50000,
    });
    const student = await Student.create({
      userId: studentUser._id,
      ...validProfilePayload,
      courseId: course._id,
      email: 'paused-student@example.com',
      dateOfBirth: new Date(validProfilePayload.dateOfBirth),
      joiningDate: new Date(validProfilePayload.joiningDate),
    });

    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ email: 'admin2@example.com', password: 'Password123' });

    return { admin, student, studentUser, course };
  };

  const pauseForFees = (admin: ReturnType<typeof request.agent>, studentId: string) =>
    admin.patch(`/api/students/${studentId}/pause`).send({
      category: 'fee_payment',
      reason: 'Installment 1 of ₹11,000 — ₹5,000 still outstanding',
      emailSubject: 'Paused',
      emailMessage: 'Please pay to resume.',
    });

  it('lets a paused student log in, and surfaces the pause reason in the response', async () => {
    const { admin, student } = await setupAdminAndStudent();

    const pauseRes = await admin.patch(`/api/students/${student._id}/pause`).send({
      category: 'fee_payment',
      reason: 'Fee payment overdue by 45 days',
      emailSubject: 'Important: Your account access has been paused',
      emailMessage: 'Your account has been paused due to overdue fees. Please contact support.',
    });
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.data.student.isPaused).toBe(true);
    expect(pauseRes.body.data.student.pauseCategory).toBe('fee_payment');
    expect(pauseRes.body.data.student.pauseReason).toBe('Fee payment overdue by 45 days');

    const persistedStudent = await Student.findById(student._id);
    expect(persistedStudent?.isPaused).toBe(true);
    const persistedUser = await User.findOne({ email: 'paused-student@example.com' });
    expect(persistedUser?.isActive).toBe(true);

    const loginAttempt = await request(app)
      .post('/api/auth/login')
      .send({ email: 'paused-student@example.com', password: 'Password123' });
    expect(loginAttempt.status).toBe(200);
    expect(loginAttempt.body.data.user.isPaused).toBe(true);
    expect(loginAttempt.body.data.user.pauseCategory).toBe('fee_payment');
    expect(loginAttempt.body.data.user.pauseReason).toBe('Fee payment overdue by 45 days');
    expect(loginAttempt.body.data.user.pauseReason.toLowerCase()).not.toContain('admin');

    // /auth/me also carries the pause status, so the popup still shows on a
    // page refresh (not just the moment right after login).
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', loginAttempt.headers['set-cookie']);
    expect(meRes.body.data.user.isPaused).toBe(true);
    expect(meRes.body.data.user.pauseReason).toBe('Fee payment overdue by 45 days');

    const secondPause = await admin.patch(`/api/students/${student._id}/pause`).send({
      category: 'fee_payment',
      reason: 'Already paused attempt',
      emailSubject: 'x',
      emailMessage: 'x',
    });
    expect(secondPause.status).toBe(400);
  }, 20000);

  it('clears the pause popup on resume (non fee-payment category needs no payment proof)', async () => {
    const { admin, student } = await setupAdminAndStudent();

    await admin.patch(`/api/students/${student._id}/pause`).send({
      category: 'policy_violation',
      reason: 'Policy violation',
      emailSubject: 'Paused',
      emailMessage: 'Your account has been paused.',
    });

    const resumeRes = await admin.patch(`/api/students/${student._id}/resume`);
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.data.student.isPaused).toBe(false);

    const loginAttempt = await request(app)
      .post('/api/auth/login')
      .send({ email: 'paused-student@example.com', password: 'Password123' });
    expect(loginAttempt.status).toBe(200);
    expect(loginAttempt.body.data.user.isPaused).toBe(false);

    const resumeAgain = await admin.patch(`/api/students/${student._id}/resume`);
    expect(resumeAgain.status).toBe(400);
  }, 20000);

  it('records the amount as a real payment on resume, and it reflects in totals + payment history', async () => {
    const { admin, student } = await setupAdminAndStudent();
    await pauseForFees(admin, String(student._id));

    const resumeRes = await admin.patch(`/api/students/${student._id}/resume`).send({
      amount: 5000,
      paymentMethod: 'upi',
      transactionId: 'UPI-TXN-12345',
    });
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.data.student.isPaused).toBe(false);
    expect(resumeRes.body.data.payment).toBeTruthy();

    // Reflects on the student record (drives the profile + dashboard figures)
    const persisted = await Student.findById(student._id);
    expect(persisted?.totalPaid).toBe(5000);
    expect(persisted?.pendingAmount).toBe(45000);
    expect(persisted?.resumeAmount).toBe(5000);
    expect(persisted?.resumePaymentMethod).toBe('upi');
    expect(persisted?.resumeTransactionId).toBe('UPI-TXN-12345');
    expect(persisted?.resumePaymentId).toBeTruthy();

    // Reflects as a real row with a receipt number (drives the payments tab)
    const payments = await Payment.find({ studentId: student._id });
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(5000);
    expect(payments[0].paymentMethod).toBe('upi');
    expect(payments[0].transactionId).toBe('UPI-TXN-12345');
    expect(payments[0].receiptNumber).toBeTruthy();

    // And is served by the endpoint the student's payments tab calls
    const history = await admin.get(`/api/payments/student/${student._id}`);
    expect(history.status).toBe(200);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0].amount).toBe(5000);
  }, 30000);

  it('can resume without double-counting when the payment was already recorded', async () => {
    const { admin, student } = await setupAdminAndStudent();
    await pauseForFees(admin, String(student._id));

    const res = await admin
      .patch(`/api/students/${student._id}/resume`)
      .send({ recordPayment: false });
    expect(res.status).toBe(200);
    expect(res.body.data.student.isPaused).toBe(false);
    expect(res.body.data.payment).toBeFalsy();

    const persisted = await Student.findById(student._id);
    expect(persisted?.totalPaid).toBe(0);
    expect(await Payment.countDocuments({ studentId: student._id })).toBe(0);
  }, 20000);

  it('rejects a fee_payment resume with no amount, or an amount above the balance', async () => {
    const { admin, student } = await setupAdminAndStudent();
    await pauseForFees(admin, String(student._id));

    const noAmount = await admin
      .patch(`/api/students/${student._id}/resume`)
      .send({ paymentMethod: 'upi', transactionId: 'X-1' });
    expect(noAmount.status).toBe(400);

    const tooMuch = await admin
      .patch(`/api/students/${student._id}/resume`)
      .send({ amount: 999999, paymentMethod: 'upi', transactionId: 'X-1' });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.message).toContain('exceeds');

    // Nothing was recorded and the account is still paused
    expect(await Payment.countDocuments({ studentId: student._id })).toBe(0);
    const persisted = await Student.findById(student._id);
    expect(persisted?.isPaused).toBe(true);
    expect(persisted?.totalPaid).toBe(0);
  }, 20000);

  it('rejects a pause request missing a reason or category', async () => {
    const { admin, student } = await setupAdminAndStudent();

    const res = await admin.patch(`/api/students/${student._id}/pause`).send({
      emailSubject: 'x',
      emailMessage: 'x',
    });
    expect(res.status).toBe(422);
  });

  it('blocks a non-admin from pausing a student account', async () => {
    const { student } = await setupAdminAndStudent();

    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ email: 'rando@example.com', password: 'Password123' });

    const res = await agent.patch(`/api/students/${student._id}/pause`).send({
      reason: 'test',
      emailSubject: 'x',
      emailMessage: 'x',
    });
    expect(res.status).toBe(403);
  });
});
