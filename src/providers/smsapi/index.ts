import { ModuleProvider, Modules } from '@medusajs/framework/utils'

import SMSAPINotificationProviderService from './service'

export default ModuleProvider(Modules.NOTIFICATION, {
  services: [SMSAPINotificationProviderService],
})
