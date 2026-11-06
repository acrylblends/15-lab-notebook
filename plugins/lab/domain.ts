/** Lab Notebook's types and pure rules: notebooks, experiments, measurements, observations and unit conversion. */
export interface Notebook { readonly id: string; readonly title: string; readonly code: string; readonly project: string }
export interface Experiment { readonly id: string; readonly notebookId: string; readonly title: string; readonly objective: string; readonly method: string; readonly protocolVersion: string; readonly instrument: string; readonly location: string; readonly startedAt: string; readonly status: 'in_progress' | 'complete' }
export interface Measurement { readonly id: string; readonly experimentId: string; readonly sampleId: string; readonly parameter: string; readonly value: number; readonly unit: string; readonly measuredAt: string }
export interface Observation { readonly id: string; readonly experimentId: string; readonly author: string; readonly body: string; readonly createdAt: string }
export interface LabState { readonly version: 1; notebooks: Notebook[]; experiments: Experiment[]; measurements: Measurement[]; observations: Observation[] }
export type LabErrorCode = 'invalid' | 'not-found'
export class LabError extends Error { readonly code: LabErrorCode; constructor(code: LabErrorCode, message: string) { super(message); this.code = code; this.name = 'LabError' } }
const pad = (n: number): string => String(n).padStart(2, '0')
export const dayOf = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
export const stampOf = (date: Date): string => `${dayOf(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
export function whenText(stamp: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(stamp).getTime()) / 60_000)
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  if (hours < 48) return 'Yesterday'
  return new Date(stamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
const FACTORS: Readonly<Record<string, number>> = { MPa: 1, bar: 0.1, psi: 0.00689476, g: 1, mg: 0.001, kg: 1000, mL: 1, L: 1000 }
/** A measurement converted within its dimension (pressure, mass or volume). @throws for an unknown or incompatible unit. */
export function convert(value: number, from: string, to: string): number {
  if (!Number.isFinite(value)) throw new LabError('invalid', 'The value must be a number.')
  const fromFactor = FACTORS[from]
  const toFactor = FACTORS[to]
  if (fromFactor === undefined || toFactor === undefined) throw new LabError('invalid', 'Choose a known unit (MPa, bar, psi, g, mg, kg, mL, L).')
  const dimension = (unit: string): string => (['MPa', 'bar', 'psi'].includes(unit) ? 'pressure' : ['g', 'mg', 'kg'].includes(unit) ? 'mass' : 'volume')
  if (dimension(from) !== dimension(to)) throw new LabError('invalid', 'Those units measure different things.')
  return (value * fromFactor) / toFactor
}
export function cleanText(value: unknown, field: string, max = 2000): string {
  if (typeof value !== 'string' || value.trim() === '') throw new LabError('invalid', `${field} is required.`)
  return value.trim().slice(0, max)
}
export function cleanValue(value: unknown): number {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new LabError('invalid', 'The measured value must be a number.')
  return number
}
export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}
/** The mean of a parameter per sample group (the part before the dash in `A-01`), in group order. */
export function meansByGroup(measurements: readonly Measurement[], parameter: string): { group: string; mean: number; count: number }[] {
  const groups = new Map<string, number[]>()
  for (const measurement of measurements) {
    if (measurement.parameter !== parameter) continue
    const group = measurement.sampleId.split('-')[0] ?? measurement.sampleId
    const values = groups.get(group)
    if (values === undefined) groups.set(group, [measurement.value])
    else values.push(measurement.value)
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([group, values]) => ({ group, mean: mean(values), count: values.length }))
}
