import { SystemService } from '#services/system_service'
import env from '#start/env'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { buildGuestKioskConfig, buildGuestKioskTools } from '../utils/guest_kiosk.js'

@inject()
export default class KioskController {
  constructor(private systemService: SystemService) {}

  async index({ inertia }: HttpContext) {
    const config = buildGuestKioskConfig(env.get('NOMAD_GUEST_MODE'), env.get('NOMAD_GUEST_TOOLS'))
    const services = await this.systemService.getServices({ installedOnly: true })

    return inertia.render('kiosk', {
      kiosk: {
        tools: buildGuestKioskTools(config.tools, services),
      },
    })
  }
}
