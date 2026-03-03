import { FastifyRequest, FastifyReply } from 'fastify';
import assignmentService from '../services/assignment.service';
import storageService from '../services/storage.service';
import { ResponseFormatter } from '../utils/response';
import { parsePagination } from '../utils/pagination';
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  queryAssignmentsSchema,
  bulkStatusSchema,
  bulkDeleteSchema,
} from '../validators/assignment.validator';
import { idParamSchema } from '../validators/common.validator';
import { handleError } from '../utils/error-handler';
import { validateDocumentType, validateDocumentSize, generateFileName } from '../utils/file';
import env from '../config/env';

export class AssignmentController {
  async getAssignments(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = queryAssignmentsSchema.parse(request.query);
      const pagination = parsePagination({ page: query.page, limit: query.limit });

      const filters = {
        status: query.status,
        mediaTypeId: query.mediaTypeId,
        classId: query.classId,
        search: query.search,
        userId: request.user?.id,
        userRole: request.user?.role,
      };

      const { assignments, total } = await assignmentService.findAssignments(filters, pagination);

      return ResponseFormatter.paginated(
        reply,
        assignments,
        {
          page: pagination.page,
          limit: pagination.limit,
          total,
        },
        'Assignments retrieved successfully'
      );
    } catch (error: any) {
      return handleError(reply, error, 'Get assignments error', {
        query: request.query,
        userId: request.user?.id,
      });
    }
  }

  async getAssignmentById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = idParamSchema.parse(request.params);
      const assignment = await assignmentService.findAssignmentById(id);

      return ResponseFormatter.success(reply, { assignment }, 'Assignment retrieved successfully');
    } catch (error: any) {
      return handleError(reply, error, 'Get assignment by ID error', {
        params: request.params,
        userId: request.user?.id,
      });
    }
  }

  async createAssignment(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!request.user) {
        return ResponseFormatter.error(reply, 'Unauthorized', 401);
      }

      const validated = createAssignmentSchema.parse(request.body);
      const assignment = await assignmentService.createAssignment({
        ...validated,
        deadline: new Date(validated.deadline),
        createdById: request.user.id,
        materiUrl: validated.materiUrl || undefined,
        materiType: validated.materiType,
      });

      return ResponseFormatter.success(reply, { assignment }, 'Assignment created successfully', 201);
    } catch (error: any) {
      return handleError(reply, error, 'Create assignment error', {
        body: request.body,
        userId: request.user?.id,
      });
    }
  }

  async updateAssignment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = idParamSchema.parse(request.params);
      const validated = updateAssignmentSchema.parse(request.body);

      const updateData: any = { ...validated };
      if (validated.deadline) {
        updateData.deadline = new Date(validated.deadline);
      }
      // Convert empty string materiUrl to null for clearing
      if (updateData.materiUrl === '') {
        updateData.materiUrl = null;
        updateData.materiType = null;
      }

      const assignment = await assignmentService.updateAssignment(id, updateData);

      return ResponseFormatter.success(reply, { assignment }, 'Assignment updated successfully');
    } catch (error: any) {
      return handleError(reply, error, 'Update assignment error', {
        params: request.params,
        body: request.body,
        userId: request.user?.id,
      });
    }
  }

  async deleteAssignment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = idParamSchema.parse(request.params);
      await assignmentService.deleteAssignment(id);

      return ResponseFormatter.success(reply, null, 'Assignment deleted successfully');
    } catch (error: any) {
      return handleError(reply, error, 'Delete assignment error', {
        params: request.params,
        userId: request.user?.id,
      });
    }
  }

  async bulkUpdateStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const validated = bulkStatusSchema.parse(request.body);
      await assignmentService.bulkUpdateStatus(validated.assignmentIds, validated.status);

      return ResponseFormatter.success(reply, null, 'Assignments status updated successfully');
    } catch (error: any) {
      return handleError(reply, error, 'Bulk update status error', {
        body: request.body,
        userId: request.user?.id,
      });
    }
  }

  async bulkDelete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const validated = bulkDeleteSchema.parse(request.body);
      await assignmentService.bulkDelete(validated.assignmentIds);

      return ResponseFormatter.success(reply, null, 'Assignments deleted successfully');
    } catch (error: any) {
      return handleError(reply, error, 'Bulk delete assignments error', {
        body: request.body,
        userId: request.user?.id,
      });
    }
  }

  async uploadMateri(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!request.user) {
        return ResponseFormatter.error(reply, 'Unauthorized', 401);
      }

      let data;
      try {
        data = await request.file();
      } catch (error: any) {
        return ResponseFormatter.error(reply, `Error parsing file upload: ${error.message || 'Unknown error'}`, 400);
      }

      if (!data) {
        return ResponseFormatter.error(reply, 'File materi harus diupload', 400);
      }

      // Validate file type (PDF, DOC, DOCX, PPT, PPTX)
      const typeValidation = validateDocumentType(data.mimetype);
      if (!typeValidation.valid) {
        return ResponseFormatter.error(reply, typeValidation.error || 'Tipe file tidak valid', 400);
      }

      // Read buffer to validate size
      const fileBuffer = await data.toBuffer();
      const sizeValidation = validateDocumentSize(fileBuffer.length);
      if (!sizeValidation.valid) {
        return ResponseFormatter.error(reply, sizeValidation.error || 'Ukuran file terlalu besar', 400);
      }

      // Generate unique file name
      const fileName = generateFileName(data.filename, 'materi');
      const objectName = `materi/${fileName}`;

      // Upload to Supabase storage
      const materiUrl = await storageService.uploadFile(
        env.SUPABASE_STORAGE_BUCKET_MATERIALS,
        objectName,
        fileBuffer,
        data.mimetype
      );

      return ResponseFormatter.success(reply, { materiUrl, fileName: data.filename }, 'Materi berhasil diupload');
    } catch (error: any) {
      return handleError(reply, error, 'Upload materi error', {
        userId: request.user?.id,
      });
    }
  }
}

export default new AssignmentController();

