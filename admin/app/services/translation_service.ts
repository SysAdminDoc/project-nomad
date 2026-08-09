import axios from 'axios'
import { inject } from '@adonisjs/core'
import { SERVICE_NAMES } from '../../constants/service_names.js'
import type {
  TranslationLanguage,
  TranslationRequest,
  TranslationResponse,
} from '../../types/translation.js'
import { DockerService } from './docker_service.js'

type LibreTranslateLanguage = {
  code?: unknown
  name?: unknown
  targets?: unknown
}

@inject()
export class TranslationService {
  constructor(private dockerService: DockerService) {}

  async getLanguages(): Promise<TranslationLanguage[]> {
    const response = await axios.get<LibreTranslateLanguage[]>(
      `${await this.getBaseUrl()}/languages`,
      { timeout: 5000 }
    )

    if (!Array.isArray(response.data)) return []

    return response.data.flatMap((language) => {
      if (typeof language.code !== 'string' || typeof language.name !== 'string') return []

      const targets = Array.isArray(language.targets)
        ? language.targets.filter((target): target is string => typeof target === 'string')
        : undefined

      return [{ code: language.code, name: language.name, ...(targets ? { targets } : {}) }]
    })
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const response = await axios.post<{ translatedText?: unknown; detectedLanguage?: unknown }>(
      `${await this.getBaseUrl()}/translate`,
      {
        q: request.text,
        source: request.source,
        target: request.target,
        format: request.format ?? 'text',
      },
      { timeout: 30000 }
    )

    if (typeof response.data?.translatedText !== 'string') {
      throw new Error('Translation service returned an invalid response')
    }

    return {
      translatedText: response.data.translatedText,
      ...(typeof response.data.detectedLanguage === 'string'
        ? { detectedLanguage: response.data.detectedLanguage }
        : {}),
    }
  }

  private async getBaseUrl(): Promise<string> {
    if (process.env.NODE_ENV === 'production') {
      return `http://${SERVICE_NAMES.TRANSLATION}:5000`
    }

    const url = await this.dockerService.getServiceURL(SERVICE_NAMES.TRANSLATION)
    if (!url) {
      throw new Error('Offline translation service is not installed')
    }

    return url.replace(/\/$/, '')
  }
}
