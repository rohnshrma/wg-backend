import Student from '../models/Student';
import Lead from '../models/Lead';
import Payment from '../models/Payment';
import Course from '../models/Course';

const fillMonths = <T extends Record<string, unknown>>(
  data: Array<{ _id: number } & Record<string, unknown>>,
  buildEntry: (month: number, found?: { _id: number } & Record<string, unknown>) => T
): T[] => {
  return Array.from({ length: 12 }, (_, i) => {
    const found = data.find((d) => d._id === i + 1);
    return buildEntry(i + 1, found);
  });
};

export const getOverview = async () => {
  const [totalStudents, totalLeads, pendingAdmissions, totalCourses] = await Promise.all([
    Student.countDocuments({ status: 'approved' }),
    Lead.countDocuments(),
    Student.countDocuments({ status: 'pending' }),
    Course.countDocuments({ isActive: true }),
  ]);

  const revenueResult = await Payment.aggregate([
    { $group: { _id: null, totalRevenue: { $sum: '$amount' } } },
  ]);
  const totalRevenue = revenueResult[0]?.totalRevenue || 0;

  const pendingFeesResult = await Student.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: null, totalPending: { $sum: '$pendingAmount' } } },
  ]);
  const pendingFees = pendingFeesResult[0]?.totalPending || 0;

  const courseWiseStudents = await Student.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: '$courseId', count: { $sum: 1 } } },
    { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'course' } },
    { $unwind: '$course' },
    { $project: { courseName: '$course.title', count: 1 } },
    { $sort: { count: -1 } },
  ]);

  return {
    totalStudents,
    totalLeads,
    pendingAdmissions,
    totalCourses,
    totalRevenue,
    pendingFees,
    courseWiseStudents,
  };
};

export const getMonthlyAdmissions = async (year: number) => {
  const data = await Student.aggregate([
    {
      $match: {
        status: 'approved',
        approvedAt: { $gte: new Date(`${year}-01-01`), $lt: new Date(`${year + 1}-01-01`) },
      },
    },
    { $group: { _id: { $month: '$approvedAt' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return fillMonths(data, (month, found) => ({ month, count: (found?.count as number) || 0 }));
};

export const getMonthlyRevenue = async (year: number) => {
  const data = await Payment.aggregate([
    {
      $match: {
        paymentDate: { $gte: new Date(`${year}-01-01`), $lt: new Date(`${year + 1}-01-01`) },
      },
    },
    { $group: { _id: { $month: '$paymentDate' }, total: { $sum: '$amount' } } },
    { $sort: { _id: 1 } },
  ]);

  return fillMonths(data, (month, found) => ({ month, total: (found?.total as number) || 0 }));
};

export const getRevenueByPaymentMethod = async (year: number) => {
  const byPaymentMethod = await Payment.aggregate([
    {
      $match: {
        paymentDate: { $gte: new Date(`${year}-01-01`), $lt: new Date(`${year + 1}-01-01`) },
      },
    },
    { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);

  return byPaymentMethod.map((row) => ({
    method: row._id as string,
    total: row.total as number,
    count: row.count as number,
  }));
};

export const getLeadAnalytics = async (year: number) => {
  const [total, converted, bySource] = await Promise.all([
    Lead.countDocuments(),
    Lead.countDocuments({ status: 'converted' }),
    Lead.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const convertedBySource = await Lead.aggregate([
    { $match: { status: 'converted' } },
    { $group: { _id: '$source', converted: { $sum: 1 } } },
  ]);

  const conversionBySource = bySource.map((row) => {
    const convertedCount =
      (convertedBySource.find((c) => c._id === row._id)?.converted as number) || 0;
    return {
      source: row._id as string,
      total: row.count as number,
      converted: convertedCount,
      conversionRate: row.count > 0 ? Number(((convertedCount / row.count) * 100).toFixed(1)) : 0,
    };
  });

  const monthlyTrend = await Lead.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(`${year}-01-01`), $lt: new Date(`${year + 1}-01-01`) },
      },
    },
    {
      $group: {
        _id: { month: { $month: '$createdAt' }, status: '$status' },
        count: { $sum: 1 },
      },
    },
  ]);

  const monthlyConversion = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const rows = monthlyTrend.filter((r) => r._id.month === month);
    const monthTotal = rows.reduce((sum, r) => sum + r.count, 0);
    const monthConverted = rows.find((r) => r._id.status === 'converted')?.count || 0;
    return { month, total: monthTotal, converted: monthConverted };
  });

  return {
    total,
    converted,
    conversionRate: total > 0 ? Number(((converted / total) * 100).toFixed(1)) : 0,
    bySource,
    conversionBySource,
    monthlyConversion,
  };
};

export const getCoursePopularity = async () => {
  return Lead.aggregate([
    { $group: { _id: '$courseInterested', inquiries: { $sum: 1 } } },
    { $sort: { inquiries: -1 } },
    { $limit: 10 },
  ]);
};

export const getStudentAnalytics = async (year: number) => {
  const [statusBreakdown, paymentModeBreakdown, genderBreakdown] = await Promise.all([
    Student.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Student.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$paymentMode', count: { $sum: 1 } } },
    ]),
    Student.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$gender', count: { $sum: 1 } } },
    ]),
  ]);

  const duesResult = await Student.aggregate([
    { $match: { status: 'approved', pendingAmount: { $gt: 0 } } },
    { $group: { _id: null, studentsWithDues: { $sum: 1 }, totalDue: { $sum: '$pendingAmount' } } },
  ]);

  const enrollmentTrend = await Student.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(`${year}-01-01`), $lt: new Date(`${year + 1}-01-01`) },
      },
    },
    { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return {
    statusBreakdown: statusBreakdown.map((row) => ({ status: row._id as string, count: row.count as number })),
    paymentModeBreakdown: paymentModeBreakdown.map((row) => ({ mode: row._id as string, count: row.count as number })),
    genderBreakdown: genderBreakdown.map((row) => ({ gender: row._id as string, count: row.count as number })),
    studentsWithDues: duesResult[0]?.studentsWithDues || 0,
    totalDue: duesResult[0]?.totalDue || 0,
    enrollmentTrend: fillMonths(enrollmentTrend, (month, found) => ({ month, count: (found?.count as number) || 0 })),
  };
};
