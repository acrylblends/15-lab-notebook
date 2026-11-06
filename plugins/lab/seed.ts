/** The notebook a new install starts with: three notebooks, four experiments, 18 measurements and three observations. */
import type { Experiment, LabState, Measurement, Notebook, Observation } from './domain.ts'
import { stampOf } from './domain.ts'
export function seed(now: Date, newId: (kind: string) => string): LabState {
  const at = (hoursAgo: number): string => stampOf(new Date(now.getTime() - hoursAgo * 3_600_000))
  const notebooks: Notebook[] = [
    { id: newId('notebook'), title: 'Materials Research', code: 'M-042', project: 'Materials / Batch 04' },
    { id: newId('notebook'), title: 'Water Quality Study', code: 'W-018', project: 'Water / Site 3' },
    { id: newId('notebook'), title: 'Sensor Calibration', code: 'S-006', project: 'Instruments' },
  ]
  const materials = notebooks[0] as Notebook
  const experiments: Experiment[] = [
    { id: newId('experiment'), notebookId: materials.id, title: 'Polymer tensile test', objective: 'Compare tensile strength across three PLA composite formulations with different short-fibre ratios. Maintain consistent specimen geometry and test speed to isolate the influence of fibre loading.', method: 'Specimens were conditioned at 23 °C for 24 hours. Testing performed with a 5 kN load cell at 5 mm/min. Five specimens per formulation; values below represent the current series average.', protocolVersion: 'v1.3', instrument: 'Instron 5967', location: 'Materials Lab · Bench 03', startedAt: at(96), status: 'in_progress' },
    { id: newId('experiment'), notebookId: materials.id, title: 'Thermal cycling', objective: 'Measure dimensional stability under repeated thermal cycles.', method: 'Ten cycles between -20 °C and 80 °C, measured after each cycle.', protocolVersion: 'v2.0', instrument: 'Thermal chamber TC-40', location: 'Materials Lab · Bench 01', startedAt: at(120), status: 'in_progress' },
    { id: newId('experiment'), notebookId: materials.id, title: 'UV exposure', objective: 'Track colour change under accelerated UV exposure.', method: 'ASTM G154 cycle 1; colour measured weekly.', protocolVersion: 'v1.1', instrument: 'QUV chamber', location: 'Materials Lab · Bench 05', startedAt: at(240), status: 'in_progress' },
    { id: newId('experiment'), notebookId: (notebooks[1] as Notebook).id, title: 'Turbidity series', objective: 'Compare turbidity at three sites.', method: 'Three samples per site, measured with a portable turbidimeter.', protocolVersion: 'v1.0', instrument: 'Hach 2100Q', location: 'Water Lab', startedAt: at(300), status: 'in_progress' },
  ]
  const first = experiments[0] as Experiment
  const values: Readonly<Record<string, readonly number[]>> = { A: [41.8, 42.4, 43.1, 42.6, 43.1], B: [51.2, 52.4, 51.8, 50.9, 52.7], C: [58.1, 58.4, 57.9, 59.2, 58.4] }
  const measurements: Measurement[] = []
  for (const [group, list] of Object.entries(values)) for (const [index, value] of list.entries()) measurements.push({ id: newId('measurement'), experimentId: first.id, sampleId: `${group}-0${String(index + 1)}`, parameter: 'Tensile strength', value, unit: 'MPa', measuredAt: at(48 + index) })
  for (const [index, value] of ([18.2, 18.6, 17.9] as const).entries()) measurements.push({ id: newId('measurement'), experimentId: experiments[1]?.id ?? '', sampleId: `A-0${String(index + 1)}`, parameter: 'Dimensional change', value, unit: 'µm', measuredAt: at(60 + index) })
  const observations: Observation[] = [
    { id: newId('observation'), experimentId: first.id, author: 'M. Chen', body: 'Formulation C shows the highest mean tensile strength. One specimen showed a visible fibre pull-out pattern; retain for microscopy review.', createdAt: at(5) },
    { id: newId('observation'), experimentId: first.id, author: 'M. Chen', body: 'Grip alignment checked before series B. No slippage observed during the final three runs.', createdAt: at(20) },
    { id: newId('observation'), experimentId: experiments[1]?.id ?? '', author: 'M. Chen', body: 'First cycle baseline recorded; no visible deformation.', createdAt: at(40) },
  ]
  return { version: 1, notebooks, experiments, measurements, observations }
}
