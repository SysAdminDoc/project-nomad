import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import {
  buildGuestKioskConfig,
  isGuestKioskRouteAllowed,
  isGuestKioskStaticPathAllowed,
} from '../utils/guest_kiosk.js'

export default class GuestKioskMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    const config = buildGuestKioskConfig(env.get('NOMAD_GUEST_MODE'), env.get('NOMAD_GUEST_TOOLS'))
    if (!config.enabled) return next()

    const pathname = request.url().split('?')[0] || '/'
    if (isGuestKioskStaticPathAllowed(pathname, config.tools)) return next()

    if (pathname === '/' || pathname === '/home') {
      return response.redirect('/kiosk')
    }

    if (isGuestKioskRouteAllowed(pathname, request.method(), config.tools)) return next()

    if (pathname.startsWith('/api/')) {
      return response.status(403).send({
        error: 'This endpoint is disabled while guest kiosk mode is active.',
        kiosk: true,
      })
    }

    return response.redirect('/kiosk')
  }
}
