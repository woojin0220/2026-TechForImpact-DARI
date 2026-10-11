import { Capacitor, registerPlugin } from '@capacitor/core'
import type { ModelStats } from '../bench/types'

export interface OnDeviceLlmStatus {
  platform: string
  available: boolean
  modelReady: boolean
  modelName?: string
  modelPath?: string
  backend?: string
  busy?: boolean
  reason?: string
  /** Hardware identifiers for benchmark records (model, OS, total RAM). */
  device?: Record<string, unknown>
}
export interface OnDeviceGenerateOptions {
  system: string
  prompt: string
  maxTokens?: number
  temperature?: number
  /** Benchmark options: JSON-schema constrained decoding, engine context window and backend.
   * A different context or backend reloads the engine. */
  responseSchema?: Record<string, unknown>
  maxNumTokens?: number
  backend?: 'gpu' | 'cpu'
}
interface OnDeviceLlmPlugin {
  getStatus(): Promise<OnDeviceLlmStatus>
  importModel(): Promise<OnDeviceLlmStatus>
  generate(options: OnDeviceGenerateOptions): Promise<{ text: string; stats?: ModelStats }>
  cancel(): Promise<void>
  /** Benchmark only (iOS): saves results to Documents/bench and keeps the screen on during a run. */
  saveBenchFile?(options: { name: string; text: string }): Promise<{ path: string }>
  setKeepAwake?(options: { on: boolean }): Promise<void>
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
  saveBenchFile: async (options) => { requireNative(); return plugin.saveBenchFile!(options) },
  setKeepAwake: async (options) => { if (Capacitor.getPlatform() === 'ios') await plugin.setKeepAwake!(options) },
}
export const getOnDeviceLlmStatus = onDeviceLlm.getStatus
export const importOnDeviceModel = onDeviceLlm.importModel
export const generateOnDevice = onDeviceLlm.generate
