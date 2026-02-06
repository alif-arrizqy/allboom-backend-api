import prisma from '../config/database';
import { SubmissionStatus, UserRole } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { ErrorMessages } from '../constants/error-messages';
import { format } from 'date-fns';

export interface ExportGradesFilters {
  classIds?: string[];
  assignmentIds?: string[];
  studentIds?: string[];
  statuses?: SubmissionStatus[];
  startDate?: string;
  endDate?: string;
}

export class ExportService {
  async getGradesData(filters: ExportGradesFilters, userId: string, userRole: UserRole) {
    const where: any = {
      status: 'GRADED',
      grade: { not: null },
    };

    if (userRole === 'STUDENT') {
      where.studentId = userId;
    } else if (userRole === 'TEACHER') {
      const teacherClasses = await prisma.teacherClass.findMany({
        where: {
          teacherId: userId,
        },
        select: {
          classId: true,
        },
      });
      const teacherClassIds = teacherClasses.map((tc) => tc.classId);

      if (teacherClassIds.length === 0) {
        throw new Error('No data found for the specified filters');
      }

      if (filters.classIds && filters.classIds.length > 0) {
        const validClassIds = filters.classIds.filter((classId) => teacherClassIds.includes(classId));
        if (validClassIds.length === 0) {
          throw new Error('No data found for the specified filters');
        }
        
        const studentsInClasses = await prisma.user.findMany({
          where: {
            classId: { in: validClassIds },
            role: 'STUDENT',
          },
          select: { id: true },
        });
        const studentIds = studentsInClasses.map((s) => s.id);
        
        if (filters.studentIds && filters.studentIds.length > 0) {
          const validStudentIds = filters.studentIds.filter((sid) => studentIds.includes(sid));
          if (validStudentIds.length === 0) {
            throw new Error('No data found for the specified filters');
          }
          where.studentId = { in: validStudentIds };
        } else {
          where.studentId = { in: studentIds };
        }
      } else {
        const studentsInClasses = await prisma.user.findMany({
          where: {
            classId: { in: teacherClassIds },
            role: 'STUDENT',
          },
          select: { id: true },
        });
        const studentIds = studentsInClasses.map((s) => s.id);
        
        if (filters.studentIds && filters.studentIds.length > 0) {
          const validStudentIds = filters.studentIds.filter((sid) => studentIds.includes(sid));
          if (validStudentIds.length === 0) {
            throw new Error('No data found for the specified filters');
          }
          where.studentId = { in: validStudentIds };
        } else {
          where.studentId = { in: studentIds };
        }
      }

    } else if (filters.studentIds && filters.studentIds.length > 0) {
      where.studentId = { in: filters.studentIds };
    }

    if (filters.assignmentIds && filters.assignmentIds.length > 0) {
      if (userRole === 'TEACHER') {
        const teacherAssignments = await prisma.assignment.findMany({
          where: {
            id: { in: filters.assignmentIds },
            createdById: userId,
          },
          select: { id: true },
        });
        const validAssignmentIds = teacherAssignments.map((a) => a.id);
        if (validAssignmentIds.length > 0) {
          where.assignmentId = { in: validAssignmentIds };
        } else {
          throw new Error('No data found for the specified filters');
        }
        } else {
          where.assignmentId = { in: filters.assignmentIds };
        }
      } else if (userRole === 'TEACHER') {
        where.assignment = {
        createdById: userId,
      };
    }

    if (filters.startDate || filters.endDate) {
      where.submittedAt = {};
      if (filters.startDate) {
        where.submittedAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.submittedAt.lte = new Date(filters.endDate);
      }
    }

    const submissions = await prisma.submission.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            nis: true,
            className: true,
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        assignment: {
          select: {
            id: true,
            title: true,
            mediaType: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            deadline: true,
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { student: { name: 'asc' } },
        { submittedAt: 'desc' },
      ],
    });

    if (submissions.length === 0) {
      throw new Error('No data found for the specified filters');
    }

    return submissions;
  }

  async exportGradesToExcel(filters: ExportGradesFilters, userId: string, userRole: UserRole): Promise<Buffer> {
    const submissions = await this.getGradesData(filters, userId, userRole);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Allboom App';
    workbook.created = new Date();

    // Sheet 1: Summary
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];

    const totalStudents = new Set(submissions.map((s) => s.student.id)).size;
    const totalAssignments = new Set(submissions.map((s) => s.assignment.id)).size;
    const averageScore = submissions.length > 0
      ? submissions.reduce((sum, s) => sum + (s.grade || 0), 0) / submissions.length
      : 0;
    const highestScore = submissions.length > 0
      ? Math.max(...submissions.map((s) => s.grade || 0))
      : 0;
    const lowestScore = submissions.length > 0
      ? Math.min(...submissions.map((s) => s.grade || 0))
      : 0;

    summarySheet.addRows([
      { metric: 'Total Students', value: totalStudents },
      { metric: 'Total Assignments', value: totalAssignments },
      { metric: 'Total Submissions', value: submissions.length },
      { metric: 'Graded Submissions', value: submissions.length },
      { metric: 'Average Score', value: averageScore.toFixed(2) },
      { metric: 'Highest Score', value: highestScore },
      { metric: 'Lowest Score', value: lowestScore },
      { metric: 'Export Date', value: format(new Date(), 'yyyy-MM-dd HH:mm:ss') },
    ]);

    // Style summary sheet
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    summarySheet.getRow(1).font = { ...summarySheet.getRow(1).font, color: { argb: 'FFFFFFFF' } };

    const byStudentSheet = workbook.addWorksheet('Grades by Student');
    byStudentSheet.columns = [
      { header: 'NIS', key: 'nis', width: 15 },
      { header: 'Nama', key: 'name', width: 30 },
      { header: 'Kelas', key: 'className', width: 20 },
      { header: 'Assignment', key: 'assignment', width: 40 },
      { header: 'Media Type', key: 'mediaType', width: 20 },
      { header: 'Grade', key: 'grade', width: 10 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Feedback', key: 'feedback', width: 50 },
      { header: 'Submitted Date', key: 'submittedDate', width: 20 },
      { header: 'Graded Date', key: 'gradedDate', width: 20 },
    ];

    submissions.forEach((submission) => {
      byStudentSheet.addRow({
        nis: submission.student.nis || '-',
        name: submission.student.name,
        className: submission.student.className || submission.student.class?.name || '-',
        assignment: submission.assignment.title,
        mediaType: submission.assignment.mediaType.name,
        grade: submission.grade || '-',
        status: submission.status,
        feedback: submission.feedback || '-',
        submittedDate: submission.submittedAt ? format(new Date(submission.submittedAt), 'yyyy-MM-dd HH:mm') : '-',
        gradedDate: submission.gradedAt ? format(new Date(submission.gradedAt), 'yyyy-MM-dd HH:mm') : '-',
      });
    });

    // Style by student sheet
    byStudentSheet.getRow(1).font = { bold: true };
    byStudentSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    byStudentSheet.getRow(1).font = { ...byStudentSheet.getRow(1).font, color: { argb: 'FFFFFFFF' } };

    const byAssignmentSheet = workbook.addWorksheet('Grades by Assignment');
    byAssignmentSheet.columns = [
      { header: 'Assignment', key: 'assignment', width: 40 },
      { header: 'Media Type', key: 'mediaType', width: 20 },
      { header: 'NIS', key: 'nis', width: 15 },
      { header: 'Nama', key: 'name', width: 30 },
      { header: 'Kelas', key: 'className', width: 20 },
      { header: 'Grade', key: 'grade', width: 10 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Feedback', key: 'feedback', width: 50 },
      { header: 'Submitted Date', key: 'submittedDate', width: 20 },
    ];

    const sortedByAssignment = [...submissions].sort((a, b) => a.assignment.title.localeCompare(b.assignment.title));
    sortedByAssignment.forEach((submission) => {
      byAssignmentSheet.addRow({
        assignment: submission.assignment.title,
        mediaType: submission.assignment.mediaType.name,
        nis: submission.student.nis || '-',
        name: submission.student.name,
        className: submission.student.className || submission.student.class?.name || '-',
        grade: submission.grade || '-',
        status: submission.status,
        feedback: submission.feedback || '-',
        submittedDate: submission.submittedAt ? format(new Date(submission.submittedAt), 'yyyy-MM-dd HH:mm') : '-',
      });
    });

    // Style by assignment sheet
    byAssignmentSheet.getRow(1).font = { bold: true };
    byAssignmentSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    byAssignmentSheet.getRow(1).font = { ...byAssignmentSheet.getRow(1).font, color: { argb: 'FFFFFFFF' } };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportGradesToPdf(
    filters: ExportGradesFilters,
    userId: string,
    userRole: UserRole,
    reportFormat: 'summary' | 'detailed' = 'detailed'
  ): Promise<Buffer> {
    const submissions = await this.getGradesData(filters, userId, userRole);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('Allboom - Grades Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Export Date: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, { align: 'center' });
      doc.moveDown(2);

      const totalStudents = new Set(submissions.map((s) => s.student.id)).size;
      const totalAssignments = new Set(submissions.map((s) => s.assignment.id)).size;
      const averageScore = submissions.length > 0
        ? submissions.reduce((sum, s) => sum + (s.grade || 0), 0) / submissions.length
        : 0;

      doc.fontSize(16).text('Summary Statistics', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`Total Students: ${totalStudents}`);
      doc.text(`Total Assignments: ${totalAssignments}`);
      doc.text(`Total Submissions: ${submissions.length}`);
      doc.text(`Graded Submissions: ${submissions.length}`); // All are GRADED
      doc.text(`Average Score: ${averageScore.toFixed(2)}`);
      doc.moveDown(2);

      if (reportFormat === 'detailed') {
        doc.fontSize(16).text('Detailed Grades', { underline: true });
        doc.moveDown(0.5);

        let yPosition = doc.y;
        const startX = 50;
        const pageWidth = 550;
        const colWidths = {
          student: 120,
          assignment: 150,
          grade: 60,
          status: 80,
          date: 100,
        };

        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Student', startX, yPosition);
        doc.text('Assignment', startX + colWidths.student, yPosition);
        doc.text('Grade', startX + colWidths.student + colWidths.assignment, yPosition);
        doc.text('Status', startX + colWidths.student + colWidths.assignment + colWidths.grade, yPosition);
        doc.text('Date', startX + colWidths.student + colWidths.assignment + colWidths.grade + colWidths.status, yPosition);

        yPosition += 20;
        doc.moveTo(startX, yPosition).lineTo(startX + pageWidth, yPosition).stroke();

        doc.font('Helvetica').fontSize(9);
        submissions.forEach((submission) => {
          if (yPosition > 750) {
            doc.addPage();
            yPosition = 50;
          }

          const studentName = submission.student.name.length > 15
            ? submission.student.name.substring(0, 15) + '...'
            : submission.student.name;
          const assignmentTitle = submission.assignment.title.length > 20
            ? submission.assignment.title.substring(0, 20) + '...'
            : submission.assignment.title;

          doc.text(studentName, startX, yPosition);
          doc.text(assignmentTitle, startX + colWidths.student, yPosition);
          doc.text(submission.grade?.toString() || '-', startX + colWidths.student + colWidths.assignment, yPosition);
          doc.text(submission.status, startX + colWidths.student + colWidths.assignment + colWidths.grade, yPosition);
          doc.text(
            submission.submittedAt ? format(new Date(submission.submittedAt), 'MM/dd/yyyy') : '-',
            startX + colWidths.student + colWidths.assignment + colWidths.grade + colWidths.status,
            yPosition
          );

          yPosition += 15;
        });
      }

      doc.end();
    });
  }

  async exportReportCard(studentId: string, userId: string, userRole: UserRole, reportFormat: 'summary' | 'detailed' = 'detailed'): Promise<Buffer> {
    if (userRole === 'STUDENT' && studentId !== userId) {
      throw new Error('Forbidden: You can only export your own report card');
    }

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        submissions: {
          where: {
            status: 'GRADED',
          },
          include: {
            assignment: {
              select: {
                id: true,
                title: true,
                mediaType: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                  },
                },
                deadline: true,
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!student) {
      throw new Error(ErrorMessages.RESOURCE.USER_NOT_FOUND);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(24).text('Report Card', { align: 'center' });
      doc.moveDown();
      doc.fontSize(18).text(student.name, { align: 'center' });
      if (student.nis) {
        doc.fontSize(14).text(`NIS: ${student.nis}`, { align: 'center' });
      }
      if (student.className || student.class?.name) {
        doc.fontSize(14).text(`Class: ${student.className || student.class?.name}`, { align: 'center' });
      }
      doc.moveDown(2);
      doc.fontSize(12).text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, { align: 'center' });
      doc.addPage();

      const totalAssignments = student.submissions.length;
      const completedAssignments = student.submissions.filter((s) => s.status === 'GRADED').length;
      const averageScore = totalAssignments > 0
        ? student.submissions.reduce((sum, s) => sum + (s.grade || 0), 0) / totalAssignments
        : 0;
      const highestScore = totalAssignments > 0
        ? Math.max(...student.submissions.map((s) => s.grade || 0))
        : 0;

      doc.fontSize(16).text('Summary Statistics', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`Total Assignments: ${totalAssignments}`);
      doc.text(`Completed Assignments: ${completedAssignments}`);
      doc.text(`Average Score: ${averageScore.toFixed(2)}`);
      doc.text(`Highest Score: ${highestScore}`);
      doc.moveDown(2);

      if (reportFormat === 'detailed' && student.submissions.length > 0) {
        doc.fontSize(16).text('Assignments', { underline: true });
        doc.moveDown(0.5);

        let yPosition = doc.y;
        student.submissions.forEach((submission) => {
          if (yPosition > 750) {
            doc.addPage();
            yPosition = 50;
          }

          doc.fontSize(12).font('Helvetica-Bold').text(submission.assignment.title);
          doc.moveDown(0.3);
          doc.font('Helvetica').fontSize(10);
          doc.text(`Media Type: ${submission.assignment.mediaType.name}`);
          doc.text(`Grade: ${submission.grade || 'N/A'}`);
          if (submission.feedback) {
            doc.text(`Feedback: ${submission.feedback}`);
          }
          doc.text(`Submitted: ${submission.submittedAt ? format(new Date(submission.submittedAt), 'yyyy-MM-dd') : 'N/A'}`);
          doc.moveDown(1);
          yPosition = doc.y;
        });
      }

      doc.end();
    });
  }
}

export default new ExportService();

