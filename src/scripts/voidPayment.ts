/**
 * Reverse a payment that was recorded by mistake — exactly undoing what
 * recordPaymentAndNotify + applyPaymentToInstallments did:
 *   - deletes the Payment row
 *   - subtracts its amount from the student's totalPaid (pendingAmount recomputed)
 *   - reopens installments it settled (back to pending, or overdue if past due)
 *
 * Dry run unless --apply is passed. Writes a JSON backup of everything it
 * touches to ./.void-backups before changing anything.
 *
 * Usage:
 *   MONGODB_URI=... npx ts-node src/scripts/voidPayment.ts <receiptNumber> <admissionId> "<student name>" [--apply]
 */
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Payment from '../models/Payment';
import Student from '../models/Student';
import Installment from '../models/Installment';

const [receiptNumber, admissionId, studentName] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const apply = process.argv.includes('--apply');

const main = async () => {
  if (!receiptNumber || !admissionId || !studentName) {
    throw new Error('Usage: voidPayment.ts <receiptNumber> <admissionId> "<student name>" [--apply]');
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(process.env.MONGODB_URI);

  const payment = await Payment.findOne({ receiptNumber });
  if (!payment) throw new Error(`No payment with receipt ${receiptNumber}`);

  const student = await Student.findById(payment.studentId);
  if (!student) throw new Error('Payment has no matching student');

  // Refuse unless every identifier lines up — never void the wrong row.
  if (student.admissionId !== admissionId) {
    throw new Error(`Admission ID mismatch: payment belongs to ${student.admissionId}`);
  }
  if (student.fullName.trim().toLowerCase() !== studentName.trim().toLowerCase()) {
    throw new Error(`Name mismatch: payment belongs to "${student.fullName}"`);
  }

  const installments = await Installment.find({ paymentId: payment._id });
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  console.log('Payment:', {
    receiptNumber: payment.receiptNumber,
    amount: payment.amount,
    method: payment.paymentMethod,
    transactionId: payment.transactionId,
    paymentDate: payment.paymentDate,
    createdAt: (payment as any).createdAt,
  });
  console.log('Student:', {
    name: student.fullName,
    admissionId: student.admissionId,
    courseFees: student.courseFees,
    totalPaid: `${student.totalPaid} -> ${student.totalPaid - payment.amount}`,
    pendingAmount: `${student.pendingAmount} -> ${student.courseFees - (student.totalPaid - payment.amount)}`,
  });
  console.log(
    'Installments to reopen:',
    installments.map((i) => ({
      number: i.installmentNumber,
      amount: i.amount,
      dueDate: i.dueDate,
      backTo: i.dueDate < startOfToday ? 'overdue' : 'pending',
    }))
  );

  if (student.totalPaid - payment.amount < 0) {
    throw new Error('Reversal would make totalPaid negative — stopping');
  }

  if (!apply) {
    console.log('\nDry run — nothing changed. Re-run with --apply to void this payment.');
    return;
  }

  const backupDir = path.resolve('.void-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `${receiptNumber}-${Date.now()}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      {
        payment: payment.toObject(),
        student: { _id: student._id, totalPaid: student.totalPaid, pendingAmount: student.pendingAmount },
        installments: installments.map((i) => i.toObject()),
      },
      null,
      2
    )
  );
  console.log(`Backup written to ${backupFile}`);

  for (const installment of installments) {
    installment.status = installment.dueDate < startOfToday ? 'overdue' : 'pending';
    installment.paidDate = undefined;
    installment.paymentId = undefined;
    installment.receiptUrl = undefined;
    await installment.save();
  }

  student.totalPaid -= payment.amount;
  await student.save(); // pre-save hook recomputes pendingAmount

  await payment.deleteOne();

  console.log(
    `\nVoided ${receiptNumber}. ${student.fullName}: totalPaid ${student.totalPaid}, pending ${student.pendingAmount}, ${installments.length} installment(s) reopened.`
  );
};

main()
  .catch((error) => {
    console.error('Error:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
