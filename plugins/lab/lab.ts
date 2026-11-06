/** The notebooks and their records, and the operations the pages run. */
import { cleanText, cleanValue, convert, type Experiment, type LabState, LabError, type Measurement, mean, meansByGroup, type Notebook, type Observation, stampOf } from './domain.ts'
import { seed } from './seed.ts'
import type { Store } from './store.ts'
export interface LabAdapters { readonly store: Store<LabState>; readonly clock: () => Date; readonly newId: (kind: string) => string }
export interface ExperimentInput { readonly notebookId: string; readonly title: string; readonly objective: string; readonly method: string }
export class Lab {
  private state: LabState
  private readonly adapters: LabAdapters
  private constructor(state: LabState, adapters: LabAdapters) { this.state = state; this.adapters = adapters }
  static async open(adapters: LabAdapters): Promise<Lab> { const saved = await adapters.store.load(); return new Lab(saved ?? seed(adapters.clock(), adapters.newId), adapters) }
  get now(): Date { return this.adapters.clock() }
  notebooks(): readonly Notebook[] { return this.state.notebooks }
  notebook(id: string): Notebook | undefined { return this.state.notebooks.find((notebook) => notebook.id === id) }
  experiments(notebookId?: string): readonly Experiment[] { return this.state.experiments.filter((experiment) => notebookId === undefined || experiment.notebookId === notebookId) }
  experiment(id: string): Experiment | undefined { return this.state.experiments.find((experiment) => experiment.id === id) }
  measurements(experimentId: string): readonly Measurement[] { return this.state.measurements.filter((measurement) => measurement.experimentId === experimentId) }
  observations(experimentId: string): readonly Observation[] { return this.state.observations.filter((observation) => observation.experimentId === experimentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }
  groups(experimentId: string, parameter: string): { group: string; mean: number; count: number }[] { return meansByGroup(this.measurements(experimentId), parameter) }
  meanOf(experimentId: string, parameter: string): number { return mean(this.measurements(experimentId).filter((measurement) => measurement.parameter === parameter).map((measurement) => measurement.value)) }
  convert(value: number, from: string, to: string): number { return convert(value, from, to) }
  async createNotebook(title: string): Promise<Notebook> {
    const clean = cleanText(title, 'Notebook title', 120)
    const notebook: Notebook = { id: this.adapters.newId('notebook'), title: clean, code: `N-${this.adapters.newId('code').replace(/[^0-9]/gu, '').slice(0, 3).padStart(3, '0')}`, project: 'Personal' }
    this.state.notebooks.push(notebook)
    await this.save()
    return notebook
  }
  async createExperiment(input: ExperimentInput): Promise<Experiment> {
    if (this.notebook(input.notebookId) === undefined) throw new LabError('not-found', 'That notebook no longer exists.')
    const experiment: Experiment = { id: this.adapters.newId('experiment'), notebookId: input.notebookId, title: cleanText(input.title, 'Title', 160), objective: cleanText(input.objective, 'Objective'), method: cleanText(input.method, 'Method'), protocolVersion: 'v1.0', instrument: 'Not recorded', location: 'Not recorded', startedAt: stampOf(this.adapters.clock()), status: 'in_progress' }
    this.state.experiments.push(experiment)
    await this.save()
    return experiment
  }
  async addObservation(experimentId: string, body: string, author = 'M. Chen'): Promise<Observation> {
    if (this.experiment(experimentId) === undefined) throw new LabError('not-found', 'That experiment no longer exists.')
    const observation: Observation = { id: this.adapters.newId('observation'), experimentId, author, body: cleanText(body, 'Observation'), createdAt: stampOf(this.adapters.clock()) }
    this.state.observations.push(observation)
    await this.save()
    return observation
  }
  async addMeasurement(experimentId: string, input: { sampleId: string; parameter: string; value: unknown; unit: string }): Promise<Measurement> {
    if (this.experiment(experimentId) === undefined) throw new LabError('not-found', 'That experiment no longer exists.')
    const measurement: Measurement = { id: this.adapters.newId('measurement'), experimentId, sampleId: cleanText(input.sampleId, 'Sample ID', 40), parameter: cleanText(input.parameter, 'Parameter', 80), value: cleanValue(input.value), unit: cleanText(input.unit, 'Unit', 20), measuredAt: stampOf(this.adapters.clock()) }
    this.state.measurements.push(measurement)
    await this.save()
    return measurement
  }
  private async save(): Promise<void> { this.state = { ...this.state, notebooks: [...this.state.notebooks], experiments: [...this.state.experiments], measurements: [...this.state.measurements], observations: [...this.state.observations] }; await this.adapters.store.save(this.state) }
}
