import { Capacitor, registerPlugin } from '@capacitor/core'

export interface OnDeviceLlmStatus {
  platform: string
  available: boolean
  modelReady: boolean
  modelName?: string
  modelPath?: string
  backend?: string
  busy?: boolean
  reason?: string
}
export interface OnDeviceGenerateOptions {
  system: string
  prompt: string
  maxTokens?: number
  temperature?: number
}
interface OnDeviceLlmPlugin {
  getStatus(): Promise<OnDeviceLlmStatus>
  importModel(): Promise<OnDeviceLlmStatus>
  generate(options: OnDeviceGenerateOptions): Promise<{ text: string }>
  cancel(): Promise<void>
}

const plugin = registerPlugin<OnDeviceLlmPlugin>('OnDeviceLlm')
const requireNative = () => {
  if (!Capacitor.isNativePlatform()) throw new Error('온디바이스 모델은 Android 또는 iOS 앱에서 실행할 수 있습니다.')
}

export const onDeviceLlm: OnDeviceLlmPlugin = {
  getStatus: async () => Capacitor.isNativePlatform() ? plugin.getStatus() : {
    platform: 'web', available: false, modelReady: false,
    reason: '브라우저 미리보기에서는 휴대폰의 온디바이스 모델을 실행할 수 없습니다.',
  },
  importModel: async () => { requireNative(); return plugin.importModel() },
  generate: async (options) => { requireNative(); return plugin.generate(options) },
  cancel: async () => { if (Capacitor.isNativePlatform()) await plugin.cancel() },
}
export const getOnDeviceLlmStatus = onDeviceLlm.getStatus
export const importOnDeviceModel = onDeviceLlm.importModel
export const generateOnDevice = onDeviceLlm.generate
