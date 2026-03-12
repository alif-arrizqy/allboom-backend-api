import prisma from '../config/database';
import { SubmissionStatus } from '@prisma/client';
import { generateCertificateToken } from '../utils/tokenGenerator';
import { ErrorMessages } from '../constants/error-messages';
import storageService from './storage.service';
import env from '../config/env';
import PDFDocument from 'pdfkit';

export class CertificateService {
  async createCertificate(submissionId: string, requesterId: string) {
    // Ensure submission exists and is graded
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        student: { select: { id: true, name: true } },
        revisions: { orderBy: { version: 'asc' } },
        assignment: { select: { id: true, title: true, mediaTypeId: true, artworkSize: true } },
        mediaType: { select: { id: true, name: true } },
      },
    });

    if (!submission) throw new Error(ErrorMessages.RESOURCE.SUBMISSION_NOT_FOUND);
    if (submission.student.id !== requesterId) throw new Error('Unauthorized');
    if (submission.status !== SubmissionStatus.GRADED) throw new Error('Certificate can only be generated for graded submissions');

    // Check if certificate exists
    const existing = await prisma.certificate.findUnique({ where: { submissionId } });
    if (existing) {
      // Pastikan deskripsi di sertifikat sinkron dengan deskripsi karya siswa
      const desiredDescription = submission.description || undefined;

      // Update description di record certificate jika berbeda
      let updatedCert = existing;
      if (existing.description !== desiredDescription) {
        updatedCert = await prisma.certificate.update({
          where: { id: existing.id },
          data: { description: desiredDescription },
        });
      }

      // Regenerasi PDF agar isi sertifikat (file) juga ikut benar
      const latestRevisionExisting = submission.revisions.length > 0
        ? submission.revisions[submission.revisions.length - 1]
        : null;
      const existingImageUrl = latestRevisionExisting ? latestRevisionExisting.imageUrl : submission.imageUrl;

      let existingArtworkBuffer: Buffer | null = null;
      if (existingImageUrl) {
        try {
          existingArtworkBuffer = await storageService.downloadFile(
            env.SUPABASE_STORAGE_BUCKET_SUBMISSIONS,
            existingImageUrl,
          );
        } catch {
          existingArtworkBuffer = null;
        }
      }

      const existingPdfBuffer = await this.generateCertificatePdfBuffer({
        studentName: submission.student.name,
        artworkTitle: submission.title,
        mediaTypeName: submission.mediaType?.name || submission.assignment?.mediaTypeId || '',
        artworkSize: submission.assignment?.artworkSize || '',
        yearCreated: new Date().getFullYear(),
        token: updatedCert.token,
        description: desiredDescription || '',
        artworkBuffer: existingArtworkBuffer,
      });

      const existingObjectName = `certificates/${submissionId}-${updatedCert.token}.pdf`;
      const updatedFileUrl = await storageService.uploadFile(
        env.SUPABASE_STORAGE_BUCKET_CERTIFICATES,
        existingObjectName,
        existingPdfBuffer,
        'application/pdf',
      );

      // Kembalikan certificate dengan imageUrl & fileUrl terkini
      const latestRevisionForReturn = latestRevisionExisting;
      const returnImageUrl = latestRevisionForReturn ? latestRevisionForReturn.imageUrl : submission.imageUrl;

      return { ...updatedCert, imageUrl: returnImageUrl, fileUrl: updatedFileUrl };
    }

    // Determine image: use latest revision image if exists and has been graded (we'll pick last revision or submission.imageUrl)
    const latestRevision = submission.revisions.length > 0 ? submission.revisions[submission.revisions.length - 1] : null;
    const imageUrl = latestRevision ? latestRevision.imageUrl : submission.imageUrl;

    // Prepare token (attempt few times if collision)
    let token: string | null = null;
    for (let i = 0; i < 5; i++) {
      const t = generateCertificateToken();
      const existsToken = await prisma.certificate.findUnique({ where: { token: t } });
      if (!existsToken) {
        token = t;
        break;
      }
    }
    if (!token) throw new Error('Failed to generate unique token');

    // Generate certificate file (PDF) and upload
    // Try to download artwork image buffer (submission latest revision or submission.imageUrl)
    let artworkBuffer: Buffer | null = null;
    if (imageUrl) {
      try {
        artworkBuffer = await storageService.downloadFile(env.SUPABASE_STORAGE_BUCKET_SUBMISSIONS, imageUrl);
      } catch (err) {
        // If download by parsing fails, ignore and proceed without artwork
        artworkBuffer = null;
      }
    }

    // Create PDF
    // Deskripsi pada sertifikat diambil dari deskripsi karya yang ditulis oleh siswa (submission.description),
    // bukan dari feedback atau deskripsi guru.
    const pdfBuffer = await this.generateCertificatePdfBuffer({
      studentName: submission.student.name,
      artworkTitle: submission.title,
      mediaTypeName: submission.mediaType?.name || submission.assignment?.mediaTypeId || '',
      artworkSize: submission.assignment?.artworkSize || '',
      yearCreated: new Date().getFullYear(),
      token,
      description: submission.description || '',
      artworkBuffer,
    });

    const objectName = `certificates/${submissionId}-${token}.pdf`;
    const fileUrl = await storageService.uploadFile(env.SUPABASE_STORAGE_BUCKET_CERTIFICATES, objectName, pdfBuffer, 'application/pdf');

    const cert = await prisma.certificate.create({
      data: {
        submissionId,
        studentId: submission.student.id,
        studentName: submission.student.name,
        artworkTitle: submission.title,
        mediaTypeId: submission.mediaTypeId || submission.assignment.mediaTypeId,
        artworkSize: submission.assignment.artworkSize || '',
        yearCreated: new Date().getFullYear(),
        // Simpan hanya deskripsi karya siswa pada sertifikat
        description: submission.description || undefined,
        token,
        fileUrl,
      },
    });

    return { ...cert, imageUrl, fileUrl };
  }

  async generateCertificatePdfBuffer(opts: {
    studentName: string;
    artworkTitle: string;
    mediaTypeName?: string;
    artworkSize?: string;
    yearCreated?: number;
    token: string;
    description?: string;
    artworkBuffer?: Buffer | null;
  }): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Title
        doc.fontSize(20).text('SERTIFIKAT PAMERIS', { align: 'center' });
        doc.moveDown(1);

        // Artwork image (centered)
        if (opts.artworkBuffer) {
          try {
            const maxWidth = 400;
            const maxHeight = 300;
            doc.image(opts.artworkBuffer, (doc.page.width - maxWidth) / 2, doc.y, {
              fit: [maxWidth, maxHeight],
              align: 'center',
              valign: 'center',
            });
            doc.moveDown(1);
          } catch (err) {
            // ignore image render errors
          }
        }

        doc.fontSize(12);
        doc.text(`NAMA SENIMAN : ${opts.studentName}`);
        doc.text(`JUDUL KARYA  : ${opts.artworkTitle}`);
        doc.text(`MEDIA        : ${opts.mediaTypeName || ''}`);
        doc.text(`UKURAN KARYA : ${opts.artworkSize || ''} CM`);
        doc.text(`TAHUN DIBUAT  : ${opts.yearCreated || ''}`);
        doc.text(`ID           : ${opts.token}`);
        if (opts.description) {
          doc.moveDown(0.5);
          doc.text(`DESKRIPSI    : ${opts.description}`);
        }

        doc.moveDown(1);
        doc.text('Terbit oleh Allboom', { align: 'right' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  async getCertificateByToken(token: string) {
    const cert = await prisma.certificate.findUnique({
      where: { token },
      include: { mediaType: { select: { id: true, name: true } }, student: { select: { id: true, name: true } }, submission: { include: { revisions: { orderBy: { version: 'asc' } }, }, },
      },
    });
    if (!cert) throw new Error(ErrorMessages.RESOURCE.NOT_FOUND);
    const latestRevision = (cert as any).submission?.revisions?.length
      ? (cert as any).submission.revisions[(cert as any).submission.revisions.length - 1]
      : null;
    const imageUrl = latestRevision ? latestRevision.imageUrl : (cert as any).submission?.imageUrl;
    return { ...cert, imageUrl };
  }
}

export default new CertificateService();
