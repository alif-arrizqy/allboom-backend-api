import { FastifyRequest, FastifyReply } from 'fastify';
import exportService from '../services/export.service';
import { exportGradesSchema, exportGradesPdfSchema, exportReportCardSchema } from '../validators/export.validator';
import { idParamSchema } from '../validators/common.validator';
import { handleError } from '../utils/error-handler';
import { format } from 'date-fns';
import prisma from '../config/database';

export class ExportController {
  async exportGradesToExcel(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = exportGradesSchema.parse(request.body);
      const userId = request.user!.id;
      const userRole = request.user!.role;

      const buffer = await exportService.exportGradesToExcel(body, userId, userRole);

      const filename = `allboom-grades-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buffer);
    } catch (error: any) {
      if (error.message === 'No data found for the specified filters') {
        return reply.status(404).send({
          success: false,
          message: error.message,
        });
      }
      return handleError(reply, error, 'Export grades to Excel error', {
        userId: request.user?.id,
      });
    }
  }

  async exportGradesToPdf(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = exportGradesPdfSchema.parse(request.body);
      const userId = request.user!.id;
      const userRole = request.user!.role;
      const reportFormat = body.format || 'detailed';

      const buffer = await exportService.exportGradesToPdf(body, userId, userRole, reportFormat);

      const filename = `allboom-grades-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buffer);
    } catch (error: any) {
      if (error.message === 'No data found for the specified filters') {
        return reply.status(404).send({
          success: false,
          message: error.message,
        });
      }
      return handleError(reply, error, 'Export grades to PDF error', {
        userId: request.user?.id,
      });
    }
  }

  async exportReportCard(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = idParamSchema.parse(request.params);
      const query = exportReportCardSchema.parse(request.query);
      const userId = request.user!.id;
      const userRole = request.user!.role;
      const reportFormat = query.format || 'detailed';

      const buffer = await exportService.exportReportCard(params.id, userId, userRole, reportFormat);

      const student = await prisma.user.findUnique({
        where: { id: params.id },
        select: { name: true },
      });

      const studentName = student?.name.toLowerCase().replace(/\s+/g, '-') || 'student';
      const filename = `report-card-${studentName}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buffer);
    } catch (error: any) {
      if (error.message.includes('Forbidden')) {
        return reply.status(403).send({
          success: false,
          message: error.message,
        });
      }
      return handleError(reply, error, 'Export report card error', {
        userId: request.user?.id,
        studentId: (request.params as any)?.id,
      });
    }
  }
}

export default new ExportController();

