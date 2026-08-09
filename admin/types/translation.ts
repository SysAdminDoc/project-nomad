export type TranslationLanguage = {
  code: string
  name: string
  targets?: string[]
}

export type TranslationRequest = {
  text: string
  source: string
  target: string
  format?: 'text' | 'html'
}

export type TranslationResponse = {
  translatedText: string
  detectedLanguage?: string
}
