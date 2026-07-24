import PDFDocument from 'pdfkit';
import cloudinary from '../config/cloudinary';
import env from '../config/env';

interface ReceiptData {
  receiptNumber: string;
  studentName: string;
  admissionId?: string;
  courseName: string;
  amount: number;
  paymentMethod: string;
  transactionId?: string;
  paymentDate: Date;
  totalPaid: number;
  pendingAmount: number;
}

const formatRupees = (amount: number) =>
  `Rs. ${amount.toLocaleString('en-IN')}`;

const buildPdfBuffer = (data: ReceiptData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc
      .fillColor('#6C3CE1')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('WebiGeeks Training & Development', { align: 'center' });
    doc
      .fillColor('#475569')
      .fontSize(10)
      .font('Helvetica')
      .text('Payment Receipt', { align: 'center' });
    doc.moveDown(1.5);

    doc.strokeColor('#E2E8F0').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text(`Receipt #: ${data.receiptNumber}`);
    doc.fillColor('#475569').fontSize(10).font('Helvetica').text(`Date: ${data.paymentDate.toLocaleDateString('en-IN')}`);
    doc.moveDown(1);

    const row = (label: string, value: string) => {
      doc.fillColor('#475569').fontSize(11).font('Helvetica').text(label, { continued: true, width: 200 });
      doc.fillColor('#0F172A').font('Helvetica-Bold').text(value);
    };

    row('Student Name:', data.studentName);
    if (data.admissionId) row('Admission ID:', data.admissionId);
    row('Course:', data.courseName);
    row('Payment Method:', data.paymentMethod.toUpperCase());
    if (data.transactionId) row('Transaction ID:', data.transactionId);
    doc.moveDown(1);

    doc.strokeColor('#E2E8F0').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#0F172A').font('Helvetica-Bold').text(`Amount Paid: ${formatRupees(data.amount)}`);
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#475569').font('Helvetica').text(`Total Paid Till Date: ${formatRupees(data.totalPaid)}`);
    doc.text(`Remaining Balance: ${formatRupees(data.pendingAmount)}`);
    doc.moveDown(2);

    doc
      .fontSize(9)
      .fillColor('#94A3B8')
      .text(
        `This is a system-generated receipt from WebiGeeks Training & Development. Contact ${env.CONTACT_EMAIL} for queries.`,
        { align: 'center' }
      );

    doc.end();
  });
};

/**
 * Generates a payment receipt PDF and uploads it to Cloudinary, returning
 * the hosted URL. Returns null (rather than throwing) on failure so a
 * payment can still be recorded even if receipt generation/upload fails.
 */
export const generateAndUploadReceipt = async (data: ReceiptData): Promise<string | null> => {
  try {
    const buffer = await buildPdfBuffer(data);

    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'webigeeks/receipts', resource_type: 'raw', public_id: data.receiptNumber, format: 'pdf' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    return result.secure_url;
  } catch (error) {
    console.error('Receipt PDF generation/upload failed:', error);
    return null;
  }
};
