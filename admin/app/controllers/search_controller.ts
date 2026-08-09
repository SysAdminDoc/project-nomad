import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { FederatedSearchService } from '#services/search_service'
import { searchQuerySchema } from '#validators/search'

@inject()
export default class SearchController {
  constructor(private searchService: FederatedSearchService) {}

  async index({ request, response }: HttpContext) {
    const query = request.qs()
    const data = await searchQuerySchema.validate({
      query: query.q,
      limit: query.limit === undefined ? undefined : Number(query.limit),
    })

    return response.ok(await this.searchService.search(data.query, data.limit))
  }
}
