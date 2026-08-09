import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { TranslationService } from '#services/translation_service'
import { translationRequestValidator } from '#validators/translation'

@inject()
export default class TranslationController {
  constructor(private translationService: TranslationService) {}

  async languages({ response }: HttpContext) {
    try {
      return await this.translationService.getLanguages()
    } catch (error) {
      return response.status(503).send({
        message: error instanceof Error ? error.message : 'Offline translation service unavailable',
      })
    }
  }

  async translate({ request, response }: HttpContext) {
    const payload = await request.validateUsing(translationRequestValidator)

    try {
      return await this.translationService.translate(payload)
    } catch (error) {
      return response.status(503).send({
        message: error instanceof Error ? error.message : 'Offline translation service unavailable',
      })
    }
  }
}
