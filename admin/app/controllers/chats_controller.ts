import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { ChatService } from '#services/chat_service'
import { createSessionSchema, updateSessionSchema, addMessageSchema } from '#validators/chat'
import KVStore from '#models/kv_store'
import { SystemService } from '#services/system_service'
import { SERVICE_NAMES } from '../../constants/service_names.js'
import { ensureChatOwnerKey } from '../utils/chat_privacy.js'

@inject()
export default class ChatsController {
  constructor(
    private chatService: ChatService,
    private systemService: SystemService
  ) {}

  async inertia({ inertia, response }: HttpContext) {
    const aiAssistantInstalled = await this.systemService.checkServiceInstalled(
      SERVICE_NAMES.OLLAMA
    )
    if (!aiAssistantInstalled) {
      return response.status(404).json({ error: 'AI Assistant service not installed' })
    }

    const chatSuggestionsEnabled = await KVStore.getValue('chat.suggestionsEnabled')
    return inertia.render('chat', {
      settings: {
        chatSuggestionsEnabled: chatSuggestionsEnabled ?? false,
      },
    })
  }

  async index({ request, response }: HttpContext) {
    const ownerKey = ensureChatOwnerKey(request, response)
    return await this.chatService.getAllSessions(ownerKey)
  }

  async show({ params, request, response }: HttpContext) {
    const sessionId = Number.parseInt(params.id)
    const ownerKey = ensureChatOwnerKey(request, response)
    const session = await this.chatService.getSession(sessionId, ownerKey)

    if (!session) {
      return response.status(404).json({ error: 'Session not found' })
    }

    return session
  }

  async store({ request, response }: HttpContext) {
    try {
      const data = await request.validateUsing(createSessionSchema)
      const ownerKey = ensureChatOwnerKey(request, response)
      const session = await this.chatService.createSession(data.title, data.model, ownerKey)
      return response.status(201).json(session)
    } catch (error) {
      return response.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create session',
      })
    }
  }

  async suggestions({ response }: HttpContext) {
    try {
      const suggestions = await this.chatService.getChatSuggestions()
      return response.status(200).json({ suggestions })
    } catch (error) {
      return response.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get suggestions',
      })
    }
  }

  async update({ params, request, response }: HttpContext) {
    try {
      const sessionId = Number.parseInt(params.id)
      const data = await request.validateUsing(updateSessionSchema)
      const ownerKey = ensureChatOwnerKey(request, response)
      const session = await this.chatService.updateSession(sessionId, ownerKey, data)
      if (!session) {
        return response.status(404).json({ error: 'Session not found' })
      }
      return session
    } catch (error) {
      return response.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to update session',
      })
    }
  }

  async destroy({ params, request, response }: HttpContext) {
    try {
      const sessionId = Number.parseInt(params.id)
      const ownerKey = ensureChatOwnerKey(request, response)
      const result = await this.chatService.deleteSession(sessionId, ownerKey)
      if (!result.success) {
        return response.status(404).json({ error: 'Session not found' })
      }
      return response.status(204)
    } catch (error) {
      return response.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete session',
      })
    }
  }

  async addMessage({ params, request, response }: HttpContext) {
    try {
      const sessionId = Number.parseInt(params.id)
      const data = await request.validateUsing(addMessageSchema)
      const ownerKey = ensureChatOwnerKey(request, response)
      const message = await this.chatService.addMessage(
        sessionId,
        ownerKey,
        data.role,
        data.content
      )
      if (!message) {
        return response.status(404).json({ error: 'Session not found' })
      }
      return response.status(201).json(message)
    } catch (error) {
      return response.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to add message',
      })
    }
  }

  async destroyAll({ request, response }: HttpContext) {
    try {
      const ownerKey = ensureChatOwnerKey(request, response)
      const result = await this.chatService.deleteAllSessions(ownerKey)
      return response.status(200).json(result)
    } catch (error) {
      return response.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete all sessions',
      })
    }
  }
}
