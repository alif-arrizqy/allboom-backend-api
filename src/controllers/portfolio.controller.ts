import { FastifyRequest, FastifyReply } from 'fastify';
import portfolioService from '../services/portfolio.service';
import { ResponseFormatter } from '../utils/response';
import { parsePagination } from '../utils/pagination';
import { idParamSchema } from '../validators/common.validator';
import { queryPortfolioSchema } from '../validators/portfolio.validator';
import { handleError } from '../utils/error-handler';

export class PortfolioController {
  async getPortfolioItems(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = queryPortfolioSchema.parse(request.query);
      const pagination = parsePagination({ page: query.page, limit: query.limit });

      const filters = {
        mediaTypeId: query.mediaTypeId,
        studentId: query.studentId,
        classId: query.classId,
        search: query.search,
        minGrade: query.minGrade,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      };

      const { items, total } = await portfolioService.findPortfolioItems(filters, pagination);

      return ResponseFormatter.paginated(
        reply,
        items,
        {
          page: pagination.page,
          limit: pagination.limit,
          total,
        },
        'Portfolio items retrieved successfully'
      );
    } catch (error: any) {
      return handleError(reply, error, 'Get portfolio items error', {
        query: request.query,
        userId: request.user?.id,
      });
    }
  }

  async getPortfolioItemById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = idParamSchema.parse(request.params);
      const item = await portfolioService.findPortfolioItemById(id);

      return ResponseFormatter.success(reply, { item }, 'Portfolio item retrieved successfully');
    } catch (error: any) {
      return handleError(reply, error, 'Get portfolio item by ID error', {
        params: request.params,
        userId: request.user?.id,
      });
    }
  }
}

export default new PortfolioController();

