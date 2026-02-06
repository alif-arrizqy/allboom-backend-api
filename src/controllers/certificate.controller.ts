import { FastifyRequest, FastifyReply } from 'fastify';
import certificateService from '../services/certificate.service';
import { ResponseFormatter } from '../utils/response';
import { z } from 'zod';
import { handleError } from '../utils/error-handler';

export class CertificateController {
  async createCertificate(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!request.user) return ResponseFormatter.error(reply, 'Unauthorized', 401);
      const body = request.body as any;
      const submissionId = body.submissionId;
      if (!submissionId) return ResponseFormatter.error(reply, 'submissionId is required', 400);

      const cert = await certificateService.createCertificate(submissionId, request.user.id);

      return ResponseFormatter.success(reply, { 
        certificate: {
          id: cert.id,
          token: cert.token,
          submissionId: cert.submissionId,
          studentId: cert.studentId,
          studentName: cert.studentName,
          artworkTitle: cert.artworkTitle,
          mediaTypeId: cert.mediaTypeId,
          artworkSize: cert.artworkSize,
          yearCreated: cert.yearCreated,
          description: cert.description,
          fileUrl: cert.fileUrl,
        }
      }, 'Certificate created');
    } catch (error: any) {
      return handleError(reply, error, 'Create certificate error', { body: request.body, userId: request.user?.id });
    }
  }

  async getCertificate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { token } = z.object({ token: z.string() }).parse(request.params as any);
      const cert = await certificateService.getCertificateByToken(token);

      const acceptHeader = (request.headers.accept || '').toLowerCase();
      if (acceptHeader.includes('application/json')) {
        return ResponseFormatter.success(reply, {
          id: cert.id,
          token: cert.token,
          studentName: cert.studentName,
          artworkTitle: cert.artworkTitle,
          mediaTypeName: cert.mediaType?.name || '',
          artworkSize: cert.artworkSize || '',
          yearCreated: cert.yearCreated || new Date().getFullYear(),
          description: cert.description || '',
          imageUrl: cert.imageUrl || '',
        }, 'Certificate data');
      }

      // Render simple HTML certificate (for print/standalone)
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Certificate ${cert.token}</title></head><body style="font-family:Arial,Helvetica,sans-serif; padding:24px;">
        <h1 style="text-align:center;">SERTIFIKAT PAMERIS</h1>
        <p><strong>NAMA SENIMAN:</strong> ${cert.studentName}</p>
        <p><strong>JUDUL KARYA:</strong> ${cert.artworkTitle}</p>
        <p><strong>MEDIA:</strong> ${cert.mediaType?.name || ''}</p>
        <p><strong>UKURAN KARYA:</strong> ${cert.artworkSize || ''} CM</p>
        <p><strong>TAHUN DIBUAT:</strong> ${cert.yearCreated || ''}</p>
        <p><strong>ID:</strong> ${cert.token}</p>
        <p><strong>DESKRIPSI:</strong> ${cert.description || ''}</p>
        ${cert.imageUrl ? `<div style="text-align:center;"><img src="${cert.imageUrl}" alt="Artwork" style="max-width:600px;max-height:600px;"/></div>` : ''}
        <div style="margin-top:24px;text-align:center;"><button onclick="window.print()">Print / Save PDF</button></div>
      </body></html>`;

      reply.header('Content-Type', 'text/html');
      return reply.send(html);
    } catch (error: any) {
      return handleError(reply, error, 'Get certificate error', { params: request.params });
    }
  }
}

export default new CertificateController();
