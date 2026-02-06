import { FastifyRequest, FastifyReply } from 'fastify';
import mediaTypeService from '../services/mediaType.service';
import { ResponseFormatter } from '../utils/response';
import { parsePagination } from '../utils/pagination';
import { idParamSchema } from '../validators/common.validator';
import { createMediaTypeSchema, updateMediaTypeSchema, queryMediaTypesSchema } from '../validators/mediaType.validator';
import { handleError } from '../utils/error-handler';

export class MediaTypeController {
  async getMediaTypes(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = queryMediaTypesSchema.parse(request.query);
      const pagination = parsePagination({ page: query.page, limit: query.limit });

      const filters = { search: query.search, isActive: query.isActive };

      const { mediaTypes, total } = await mediaTypeService.findMediaTypes(filters, pagination);

      return ResponseFormatter.paginated(reply, mediaTypes, { page: pagination.page, limit: pagination.limit, total }, 'Media types retrieved successfully');
    } catch (error: any) {
      return handleError(reply, error, 'Get media types error', { query: request.query, userId: request.user?.id });
    }
  }

  async getMediaTypeById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = idParamSchema.parse(request.params);
      const mediaType = await mediaTypeService.findMediaTypeById(id);
      return ResponseFormatter.success(reply, { mediaType }, 'Media type retrieved successfully');
    } catch (error: any) {
      return handleError(reply, error, 'Get media type by ID error', { params: request.params, userId: request.user?.id });
    }
  }

  async createMediaType(request: FastifyRequest, reply: FastifyReply) {
    try {
      const validated = createMediaTypeSchema.parse(request.body);
      const mediaType = await mediaTypeService.createMediaType(validated);
      return ResponseFormatter.success(reply, { mediaType }, 'Media type created', 201);
    } catch (error: any) {
      return handleError(reply, error, 'Create media type error', { body: request.body, userId: request.user?.id });
    }
  }

  async updateMediaType(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = idParamSchema.parse(request.params);
      const validated = updateMediaTypeSchema.parse(request.body);
      const mediaType = await mediaTypeService.updateMediaType(id, validated);
      return ResponseFormatter.success(reply, { mediaType }, 'Media type updated');
    } catch (error: any) {
      return handleError(reply, error, 'Update media type error', { params: request.params, body: request.body, userId: request.user?.id });
    }
  }

  async deleteMediaType(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = idParamSchema.parse(request.params);
      const force = (request.query as any)?.force === 'true';
      await mediaTypeService.deleteMediaType(id, force);
      return ResponseFormatter.success(reply, null, 'Media type deleted');
    } catch (error: any) {
      return handleError(reply, error, 'Delete media type error', { params: request.params, userId: request.user?.id });
    }
  }
}

export default new MediaTypeController();
