import { FastifyRequest, FastifyReply } from 'fastify';
import submissionService from '../services/submission.service';
import { ResponseFormatter } from '../utils/response';
import { parsePagination } from '../utils/pagination';
import storageService from '../services/storage.service';
import imageService from '../services/image.service';
import env from '../config/env';
import {
  updateSubmissionSchema,
  querySubmissionsSchema,
  returnForRevisionSchema,
} from '../validators/submission.validator';
import { gradeSubmissionSchema } from '../validators/assignment.validator';
import { idParamSchema } from '../validators/common.validator';
import { generateFileName, validateFileType, validateFileSize } from '../utils/file';
import { handleError } from '../utils/error-handler';

export class SubmissionController {
  async getSubmissions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = querySubmissionsSchema.parse(request.query);
      const pagination = parsePagination({ page: query.page, limit: query.limit });

      const filters = {
        assignmentId: query.assignmentId,
        studentId: query.studentId || (request.user?.role === 'STUDENT' ? request.user.id : undefined),
        status: query.status,
        search: query.search,
      };

      const { submissions, total } = await submissionService.findSubmissions(filters, pagination);

      return ResponseFormatter.paginated(
        reply,
        submissions,
        {
          page: pagination.page,
          limit: pagination.limit,
          total,
        },
        'Submissions retrieved successfully'
      );
    } catch (error: any) {
      return handleError(reply, error, 'Get submissions error', {
        query: request.query,
        userId: request.user?.id,
      });
    }
  }

  async getSubmissionById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = idParamSchema.parse(request.params);
      const submission = await submissionService.findSubmissionById(id);

      return ResponseFormatter.success(reply, { submission }, 'Submission retrieved successfully');
    } catch (error: any) {
      return handleError(reply, error, 'Get submission by ID error', {
        params: request.params,
        userId: request.user?.id,
      });
    }
  }

  async createSubmission(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!request.user) {
        return ResponseFormatter.error(reply, 'Unauthorized', 401);
      }

      // Check user role - students should be able to create submissions
      if (request.user.role !== 'STUDENT' && request.user.role !== 'TEACHER') {
        return ResponseFormatter.error(reply, 'Only students and teachers can create submissions', 403);
      }

      // Try to get file from multipart request
      let data;
      try {
        data = await request.file();
      } catch (error: any) {
        console.error('Error parsing file upload:', error);
        // If multipart is not registered or error occurs, provide helpful error
        return ResponseFormatter.error(reply, `Error parsing file upload: ${error.message || 'Unknown error'}. Please ensure Content-Type is multipart/form-data`, 400);
      }

      if (!data) {
        return ResponseFormatter.error(reply, 'Image file is required. Please upload a file using multipart/form-data with field name "image"', 400);
      }

      if (!data.filename) {
        return ResponseFormatter.error(reply, 'File name is required', 400);
      }

      // Validate file type
      const fileTypeValidation = validateFileType(data.mimetype);
      if (!fileTypeValidation.valid) {
        return ResponseFormatter.error(reply, fileTypeValidation.error || 'Invalid file type', 400);
      }

      // Validate file size
      const buffer = await data.toBuffer();
      const fileSizeValidation = validateFileSize(buffer.length);
      if (!fileSizeValidation.valid) {
        return ResponseFormatter.error(reply, fileSizeValidation.error || 'File too large', 400);
      }

      // Validate and process image
      const imageValidation = await imageService.validateImage(buffer);
      if (!imageValidation.valid) {
        return ResponseFormatter.error(reply, imageValidation.error || 'Invalid image', 400);
      }

      // Process image (generate thumbnails)
      const processed = await imageService.processImage(buffer, true);

      // Parse form fields
      const body = data.fields as any;
      const assignmentId = body.assignmentId?.value || body.assignmentId;
      const title = body.title?.value || body.title;
      const description = body.description?.value || body.description;
      const mediaTypeId = body.mediaTypeId?.value || body.mediaTypeId;
      const artworkSize = body.artworkSize?.value || body.artworkSize;
      const yearCreatedRaw = body.yearCreated?.value || body.yearCreated;
      const yearCreated = yearCreatedRaw ? parseInt(yearCreatedRaw, 10) : undefined;

      if (!assignmentId || !title) {
        return ResponseFormatter.error(reply, 'Assignment ID and title are required. Please include assignmentId and title in the form data', 400);
      }

      // Upload images to Supabase Storage
      const fileName = generateFileName(data.filename, 'submission');
      const imageUrl = await storageService.uploadFile(
        env.SUPABASE_STORAGE_BUCKET_SUBMISSIONS,
        fileName,
        processed.full,
        'image/jpeg'
      );

      let imageThumbnail: string | undefined;
      let imageMedium: string | undefined;

      if (processed.thumbnail) {
        const thumbName = `thumb-${fileName}`;
        imageThumbnail = await storageService.uploadFile(
          env.SUPABASE_STORAGE_BUCKET_SUBMISSIONS,
          thumbName,
          processed.thumbnail,
          'image/jpeg'
        );
      }

      if (processed.medium) {
        const mediumName = `medium-${fileName}`;
        imageMedium = await storageService.uploadFile(
          env.SUPABASE_STORAGE_BUCKET_SUBMISSIONS,
          mediumName,
          processed.medium,
          'image/jpeg'
        );
      }

      // Create or update submission
      const result = await submissionService.createSubmission({
        assignmentId,
        studentId: request.user.id,
        title,
        description,
        imageUrl,
        imageThumbnail,
        imageMedium,
        mediaTypeId,
        artworkSize,
        yearCreated,
      });

      // Extract flags and clean up submission object
      const { _isUpdate, _wasRevision, ...submission } = result as any;

      // Determine appropriate message and status code
      if (_isUpdate) {
        const message = _wasRevision 
          ? 'Revision uploaded successfully' 
          : 'Submission updated successfully';
        return ResponseFormatter.success(reply, { submission }, message, 200);
      }

      return ResponseFormatter.success(reply, { submission }, 'Submission created successfully', 201);
    } catch (error: any) {
      return handleError(reply, error, 'Create submission error', {
        userId: request.user?.id,
      });
    }
  }

  async updateSubmission(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!request.user) {
        return ResponseFormatter.error(reply, 'Unauthorized', 401);
      }

      const { id } = idParamSchema.parse(request.params);

      // Check if request has file (multipart/form-data)
      const data = await request.file();
      
      let updateData: {
        title?: string;
        description?: string;
        imageUrl?: string;
        imageThumbnail?: string;
        imageMedium?: string;
        mediaTypeId?: string;
        artworkSize?: string;
        yearCreated?: number;
      } = {};

      if (data) {
        // Handle file upload (multipart/form-data)
        // Validate file type
        const fileTypeValidation = validateFileType(data.mimetype);
        if (!fileTypeValidation.valid) {
          return ResponseFormatter.error(reply, fileTypeValidation.error || 'Invalid file type', 400);
        }

        // Validate file size
        const buffer = await data.toBuffer();
        const fileSizeValidation = validateFileSize(buffer.length);
        if (!fileSizeValidation.valid) {
          return ResponseFormatter.error(reply, fileSizeValidation.error || 'File too large', 400);
        }

        // Validate and process image
        const imageValidation = await imageService.validateImage(buffer);
        if (!imageValidation.valid) {
          return ResponseFormatter.error(reply, imageValidation.error || 'Invalid image', 400);
        }

        // Process image (generate thumbnails)
        const processed = await imageService.processImage(buffer, true);

        // Parse form fields
        const body = data.fields as any;
        const title = body.title?.value;
        const description = body.description?.value;
        const mediaTypeId = body.mediaTypeId?.value || body.mediaTypeId;
        const artworkSize = body.artworkSize?.value || body.artworkSize;
        const yearCreatedRaw = body.yearCreated?.value || body.yearCreated;
        const yearCreated = yearCreatedRaw ? parseInt(yearCreatedRaw, 10) : undefined;

        // Upload images to Supabase Storage
        const fileName = generateFileName(data.filename, 'submission');
        const imageUrl = await storageService.uploadFile(
          env.SUPABASE_STORAGE_BUCKET_SUBMISSIONS,
          fileName,
          processed.full,
          'image/jpeg'
        );

        let imageThumbnail: string | undefined;
        let imageMedium: string | undefined;

        if (processed.thumbnail) {
          const thumbName = `thumb-${fileName}`;
          imageThumbnail = await storageService.uploadFile(
            env.SUPABASE_STORAGE_BUCKET_SUBMISSIONS,
            thumbName,
            processed.thumbnail,
            'image/jpeg'
          );
        }

        if (processed.medium) {
          const mediumName = `medium-${fileName}`;
          imageMedium = await storageService.uploadFile(
            env.SUPABASE_STORAGE_BUCKET_SUBMISSIONS,
            mediumName,
            processed.medium,
            'image/jpeg'
          );
        }

        updateData = {
          title,
          description,
          imageUrl,
          imageThumbnail,
          imageMedium,
          mediaTypeId,
          artworkSize,
          yearCreated,
        };
      } else {
        // Handle JSON body (no file upload)
        const validated = updateSubmissionSchema.parse(request.body);
        updateData = validated;
      }

      const submission = await submissionService.updateSubmission(id, updateData);

      return ResponseFormatter.success(reply, { submission }, 'Submission updated successfully');
    } catch (error: any) {
      return handleError(reply, error, 'Update submission error', {
        params: request.params,
        userId: request.user?.id,
      });
    }
  }

  async gradeSubmission(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = idParamSchema.parse(request.params);
      const validated = gradeSubmissionSchema.parse(request.body);

      const submission = await submissionService.gradeSubmission(id, validated.grade, validated.feedback);

      return ResponseFormatter.success(reply, { submission }, 'Submission graded successfully');
    } catch (error: any) {
      return handleError(reply, error, 'Grade submission error', {
        params: request.params,
        body: request.body,
        userId: request.user?.id,
      });
    }
  }

  async returnForRevision(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = idParamSchema.parse(request.params);
      const validated = returnForRevisionSchema.parse(request.body);

      // TODO: Handle image upload for revision
      // For now, using the same image URL
      const submission = await submissionService.returnForRevision(id, validated.revisionNote, '');

      return ResponseFormatter.success(reply, { submission }, 'Submission returned for revision');
    } catch (error: any) {
      return handleError(reply, error, 'Return submission for revision error', {
        params: request.params,
        body: request.body,
        userId: request.user?.id,
      });
    }
  }

  async deleteSubmission(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = idParamSchema.parse(request.params);
      await submissionService.deleteSubmission(id);

      return ResponseFormatter.success(reply, null, 'Submission deleted successfully');
    } catch (error: any) {
      return handleError(reply, error, 'Delete submission error', {
        params: request.params,
        userId: request.user?.id,
      });
    }
  }
}

export default new SubmissionController();

