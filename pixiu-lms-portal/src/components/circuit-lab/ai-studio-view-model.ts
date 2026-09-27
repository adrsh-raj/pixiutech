import type { ChangeEvent, Dispatch, MutableRefObject, SetStateAction } from "react"
import type { LayersModel } from "@tensorflow/tfjs"
import type {
  AiDatasetStats,
  AiLayerSpec,
  AiModelSummary,
  AiStudioStore,
  AiTrainingConfig,
  AiTrainingHistoryPoint,
  AiTrainingProfile,
} from "@/lib/ai-studio-engine"
import type { AiVisionState, ReadyAiMode } from "@/lib/ai/vision-types"

export type AiTrainingProgress = {
  epoch: number
  total: number
  accuracy: number
  loss: number
  valAccuracy: number | null
  valLoss: number | null
  stage: string
}

export type AiStudioViewModel = {
  aiState: AiVisionState
  onAiStateChange: (state: AiVisionState) => void
  isSimRunning: boolean
  onStartSim?: () => void
  onGoToSimulation?: () => void

  mode: ReadyAiMode | "trained"
  isSound: boolean
  activeTitle: string
  loading: boolean
  cameraActive: boolean
  soundActive: boolean
  inputActive: boolean
  status: string
  error: string | null
  fps: number
  store: AiStudioStore
  model: LayersModel | null
  classes: string[]
  datasetStats: AiDatasetStats
  canTrain: boolean
  currentExplanation: string

  studioVideoRef: MutableRefObject<HTMLVideoElement | null>
  overlayRef: MutableRefObject<HTMLCanvasElement | null>

  stopInput: () => void
  startSound: () => Promise<void>
  startCameraForMode: () => Promise<void>
  selectMode: (mode: ReadyAiMode | "trained") => void

  label: string
  setLabel: Dispatch<SetStateAction<string>>
  addSampleFromCamera: () => Promise<void>
  importSample: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  commitStore: (store: AiStudioStore) => void

  renamingClass: string | null
  renameValue: string
  setRenamingClass: Dispatch<SetStateAction<string | null>>
  setRenameValue: Dispatch<SetStateAction<string>>
  training: boolean
  removeAiClass: (store: AiStudioStore, name: string) => AiStudioStore
  renameAiClass: (store: AiStudioStore, currentName: string, nextName: string) => AiStudioStore
  removeAiSample: (store: AiStudioStore, id: string) => AiStudioStore

  trainingProfile: AiTrainingProfile
  setTrainingProfile: Dispatch<SetStateAction<AiTrainingProfile>>
  advancedTuning: boolean
  setAdvancedTuning: Dispatch<SetStateAction<boolean>>
  customEpochs: number
  setCustomEpochs: Dispatch<SetStateAction<number>>
  customLearningRate: number
  setCustomLearningRate: Dispatch<SetStateAction<number>>
  customBatchSize: number
  setCustomBatchSize: Dispatch<SetStateAction<number>>
  customPatience: number
  setCustomPatience: Dispatch<SetStateAction<number>>
  customMinDelta: number
  setCustomMinDelta: Dispatch<SetStateAction<number>>
  customLayers: AiLayerSpec[]
  addCustomLayer: () => void
  updateCustomLayer: (index: number, patch: Partial<AiLayerSpec>) => void
  removeCustomLayer: (index: number) => void
  moveCustomLayer: (index: number, direction: -1 | 1) => void
  selectedTrainingConfig: AiTrainingConfig
  estimatedTrainingLoad: ReturnType<typeof import("@/lib/ai-studio-engine").estimateTrainingLoad>
  progress: AiTrainingProgress
  trainingHistory: AiTrainingHistoryPoint[]
  train: () => Promise<void>
  resetStudio: () => Promise<void>
  getModelWeightPreview: (model: LayersModel) => string[][]
  getModelWeightShapes: (model: LayersModel) => string[]
  modelSummary?: AiModelSummary | null
}
