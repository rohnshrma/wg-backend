import User from '../src/models/User';
import Student from '../src/models/Student';
import Installment from '../src/models/Installment';
import { NotificationService } from '../src/services/notificationService';
import { runInstallmentReminders } from '../src/jobs/installmentReminders';
import { connectTestDB, clearTestDB, disconnectTestDB } from './setup/db';

beforeAll(async () => {
  await connectTestDB();
});

afterEach(async () => {
  await clearTestDB();
  jest.restoreAllMocks();
});

afterAll(async () => {
  await disconnectTestDB();
});

async function createStudent() {
  const user = await User.create({ email: 'student@example.com', password: 'Password123', role: 'student' });
  return Student.create({
    userId: user._id,
    fullName: 'Rahul Sharma',
    dateOfBirth: '2000-01-01',
    gender: 'male',
    fatherName: 'Father Name',
    motherName: 'Mother Name',
    parentContactNumber: '9999999999',
    studentContactNumber: '8888888888',
    email: 'student@example.com',
    address: { street: '1 Main St', city: 'City', state: 'State', pincode: '123456' },
    qualification: 'B.Tech',
    courseFees: 30000,
    joiningDate: '2026-01-01',
    paymentMode: 'emi',
    status: 'approved',
  });
}

// "Now" is computed once per test from the real clock and installment due
// dates are built relative to it, rather than depending on wall-clock timing
// or sleeping — the job's own window math is what's under test, not time
// itself.
describe('installment reminders — AutoPay-aware branch', () => {
  it('sends the AutoPay-specific reminder (not the manual "please pay" copy) for a mandate-driven installment due soon', async () => {
    const student = await createStudent();
    const dueInTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    await Installment.create({
      studentId: student._id,
      installmentNumber: 1,
      amount: 10000,
      dueDate: dueInTwoDays,
      status: 'pending',
      collectionMethod: 'autopay',
    });

    const autoDebitSpy = jest.spyOn(NotificationService, 'autoDebitReminder').mockResolvedValue(undefined);
    const manualSpy = jest.spyOn(NotificationService, 'installmentReminder').mockResolvedValue(undefined);

    await runInstallmentReminders();

    expect(autoDebitSpy).toHaveBeenCalledTimes(1);
    expect(manualSpy).not.toHaveBeenCalled();

    const updated = await Installment.findOne({ studentId: student._id });
    expect(updated?.reminderSent).toBe(true);
  });

  it('sends the manual reminder for a non-mandate installment due soon', async () => {
    const student = await createStudent();
    const dueInTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    await Installment.create({
      studentId: student._id,
      installmentNumber: 1,
      amount: 10000,
      dueDate: dueInTwoDays,
      status: 'pending',
      collectionMethod: 'manual',
    });

    const autoDebitSpy = jest.spyOn(NotificationService, 'autoDebitReminder').mockResolvedValue(undefined);
    const manualSpy = jest.spyOn(NotificationService, 'installmentReminder').mockResolvedValue(undefined);

    await runInstallmentReminders();

    expect(manualSpy).toHaveBeenCalledTimes(1);
    expect(autoDebitSpy).not.toHaveBeenCalled();
  });

  it('does not re-send a reminder sent within the last 24h, and flips a past-due installment to overdue', async () => {
    const student = await createStudent();
    const dueYesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const installment = await Installment.create({
      studentId: student._id,
      installmentNumber: 1,
      amount: 10000,
      dueDate: dueYesterday,
      status: 'pending',
      collectionMethod: 'autopay',
      reminderSent: true,
      reminderSentAt: new Date(), // sent moments ago
    });

    const autoDebitSpy = jest.spyOn(NotificationService, 'autoDebitReminder').mockResolvedValue(undefined);

    await runInstallmentReminders();

    expect(autoDebitSpy).not.toHaveBeenCalled();

    const updated = await Installment.findById(installment._id);
    expect(updated?.status).toBe('overdue');
  });

  it('does not touch an already-paid installment', async () => {
    const student = await createStudent();
    const dueInTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    await Installment.create({
      studentId: student._id,
      installmentNumber: 1,
      amount: 10000,
      dueDate: dueInTwoDays,
      status: 'paid',
      paidDate: new Date(),
      collectionMethod: 'autopay',
    });

    const autoDebitSpy = jest.spyOn(NotificationService, 'autoDebitReminder').mockResolvedValue(undefined);

    await runInstallmentReminders();

    expect(autoDebitSpy).not.toHaveBeenCalled();
  });
});
