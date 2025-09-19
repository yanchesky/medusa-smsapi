import { AbstractNotificationProviderService } from '@medusajs/framework/utils'
import { MedusaError } from '@medusajs/framework/utils'
import { Logger } from '@medusajs/framework/types'
import {
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from '@medusajs/framework/types'

export interface SMSAPIOptions {
  access_token: string
  from: string
  encoding: string
  api_url?: string
  channels: string[]
  test?: boolean
  flash?: boolean
  max_parts?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  nounicode?: boolean
  normalize?: boolean
  fast?: boolean
}

interface SMSAPISuccessResponse {
  count: number
  list: Array<{
    id: string
    points: number
    number: string
    status: string
  }>
}

interface SMSAPIErrorResponse {
  invalid_numbers: Array<{
    number: string
    submitted_number: string
    message: string
  }>
  error: number
  message: string
}

type InjectedDependencies = {
  logger?: Logger
}

export class SMSAPINotificationProviderService extends AbstractNotificationProviderService {
  static identifier = 'smsapi'

  protected options_: Omit<SMSAPIOptions, 'channels'>
  protected logger_?: Logger

  constructor(
    { logger }: InjectedDependencies,
    {
      encoding = 'UTF-8',
      test = false,
      api_url = 'https://smsapi.io/api',
      ...rest
    }: SMSAPIOptions
  ) {
    super()

    this.options_ = {
      encoding,
      test,
      api_url,
      ...rest,
    }
    this.logger_ = logger
  }

  static validateOptions(options: SMSAPIOptions): void {
    if (!options.access_token) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'SMSAPI access_token is required'
      )
    }

    if (!options.from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'SMSAPI from field is required'
      )
    }
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    if (!notification.to) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'SMS recipient (to) is required'
      )
    }

    const message = notification.content?.text
    if (!message) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'SMS message is required (provide in content.text or data.message)'
      )
    }

    const requestBody = new URLSearchParams({
      to: notification.to,
      from: notification.from || this.options_.from,
      message: message,
      format: 'json',
      encoding: this.options_.encoding,
    })

    if (this.options_.test) {
      requestBody.append('test', '1')
      this.logger_?.info(
        `[SMSAPI Test Mode] SMS would be sent: to=${notification.to}, from=${notification.from || this.options_.from}, message=${message}, encoding=${this.options_.encoding}`
      )
    }

    if(this.options_.fast) {
      requestBody.append('fast', '1')
    }
    if(this.options_.flash) {
      requestBody.append('flash', '1')
    }
    if(this.options_.max_parts) {
      requestBody.append('max_parts', this.options_.max_parts.toString())
    }
    if(this.options_.nounicode) {
      requestBody.append('nounicode', '1')
    }
    if(this.options_.normalize) {
      requestBody.append('normalize', '1')
    }

    const response = await fetch(`${this.options_.api_url}/sms.do`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options_.access_token}`,
        Accept: 'application/json',
      },
      body: requestBody,
    }).catch(error => {
      this.logger_?.error('[SMSAPI] Fetch failed:', new Error(error.message))
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    })

    if (!response.ok) {
      const errorMsg = `SMSAPI request failed with status ${response.status}: ${response.statusText}`
      this.logger_?.error(`[SMSAPI] Send failed: ${errorMsg}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, errorMsg)
    }

    const data: SMSAPISuccessResponse | SMSAPIErrorResponse =
      await response.json()

    if ('error' in data && data.error) {
      const errorMsg = `SMSAPI returned error: ${data.message}`
      this.logger_?.error(`[SMSAPI] Send failed: ${errorMsg}`)
      throw new MedusaError(MedusaError.Types.INVALID_DATA, errorMsg)
    }

    if (!('list' in data)) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        'SMSAPI returned unexpected response'
      )
    }

    if (this.options_.test) {
      this.logger_?.info(
        `[SMSAPI] SMS sent successfully: messageId=${data.list[0].id}, to=${notification.to}, status=${data.list[0].status}`
      )
    }

    return {
      id: data.list[0].id,
    }
  }
}

export default SMSAPINotificationProviderService
