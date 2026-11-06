import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { createApp, readManifest } from '../src/app.ts'
import { pinnedInstance } from '../plugins/instance/index.ts'
import { convert, Lab, LabError, meansByGroup } from '../plugins/lab/index.ts'
import type { LabState } from '../plugins/lab/domain.ts'
import { memoryStore } from '../plugins/lab/store.ts'
import { seed } from '../plugins/lab/seed.ts'
import { NOW, noticeOf, projectRoot, withApp } from './support.ts'
const scratch = join(projectRoot, '.acrylblends', 'test')
mkdirSync(scratch, { recursive: true })
const newId = (kind: string): string => `${kind}-${Math.random().toString(36).slice(2, 8)}`

test('units convert within their dimension and incompatible units are refused', () => {
  assert.equal(convert(58.4, 'MPa', 'MPa'), 58.4)
  assert.ok(Math.abs(convert(1, 'bar', 'psi') - 14.5038) < 0.01)
  assert.throws(() => convert(1, 'MPa', 'g'), /different things/)
  assert.throws(() => convert(1, 'MPa', 'furlong'), /known unit/)
  assert.throws(() => convert(Number.NaN, 'MPa', 'psi'), /number/)
})

test('the seed has three notebooks, four experiments and fifteen tensile measurements', () => {
  const state = seed(NOW, newId)
  assert.equal(state.notebooks.length, 3)
  assert.equal(state.experiments.length, 4)
  assert.equal(state.measurements.filter((measurement) => measurement.parameter === 'Tensile strength').length, 15)
  const groups = meansByGroup(state.measurements, 'Tensile strength')
  assert.deepEqual(groups.map((group) => group.group), ['A', 'B', 'C'])
  assert.ok(Math.abs((groups[2]?.mean ?? 0) - 58.4) < 0.2)
  assert.equal(state.observations.length, 3)
})

async function open(): Promise<Lab> {
  let ids = 0
  return Lab.open({ store: memoryStore(), clock: () => NOW, newId: (kind) => `${kind}-${++ids}` })
}

test('observations and measurements append and persist', async () => {
  const store = memoryStore<LabState>()
  let ids = 0
  const lab = await Lab.open({ store, clock: () => NOW, newId: (kind) => `${kind}-${++ids}` })
  const experiment = lab.experiments()[0]
  assert.ok(experiment !== undefined)
  const observation = await lab.addObservation(experiment.id, 'A new observation.')
  assert.equal(lab.observations(experiment.id)[0]?.id, observation.id)
  const measurement = await lab.addMeasurement(experiment.id, { sampleId: 'D-01', parameter: 'Tensile strength', value: '60.1', unit: 'MPa' })
  assert.equal(measurement.value, 60.1)
  await assert.rejects(lab.addMeasurement(experiment.id, { sampleId: '', parameter: 'x', value: 1, unit: 'MPa' }), (error: unknown) => error instanceof LabError && /Sample ID/.test(error.message))
  await assert.rejects(lab.addObservation('missing', 'x'), /experiment/)
  assert.equal(store.saved, 2)
})

test('a notebook and an experiment can be created', async () => {
  const lab = await open()
  const notebook = await lab.createNotebook('Polymer ageing')
  assert.equal(notebook.title, 'Polymer ageing')
  const experiment = await lab.createExperiment({ notebookId: notebook.id, title: 'Ageing test', objective: 'Measure ageing.', method: 'Accelerated ageing.' })
  assert.equal(experiment.notebookId, notebook.id)
  await assert.rejects(lab.createExperiment({ notebookId: 'missing', title: 'x', objective: 'x', method: 'x' }), /notebook/)
})

test('the record page shows the paper, the results, the observations and the converter', () =>
  withApp(async (app) => {
    const experiment = app.root.lab.experiments()[0]
    assert.ok(experiment !== undefined)
    const page = await app.page(`/experiments/${experiment.id}`)
    assert.equal(page.status, 200)
    assert.match(page.html, /Polymer tensile test/)
    assert.match(page.html, /OBJECTIVE/)
    assert.match(page.html, /MEAN TENSILE STRENGTH/)
    assert.match(page.html, /Grip alignment/)
    assert.match(page.html, /Unit converter/)
    const converted = await app.page(`/experiments/${experiment.id}?value=58.4&from=MPa&to=psi`)
    assert.match(converted.html, /8,470\.2 psi/)
  }))

test('an observation and a measurement can be appended from the pages', () =>
  withApp(async (app) => {
    const experiment = app.root.lab.experiments()[0]
    assert.ok(experiment !== undefined)
    const observation = await app.post(`/experiments/${experiment.id}/observations`, { body: 'A new observation.' })
    assert.equal(noticeOf(observation).kind, 'ok')
    assert.match((await app.page(`/experiments/${experiment.id}`)).html, /A new observation\./)
    const measurement = await app.post(`/experiments/${experiment.id}/measurements`, { sampleId: 'D-01', parameter: 'Tensile strength', value: '60.1', unit: 'MPa' })
    assert.equal(noticeOf(measurement).kind, 'ok')
    assert.equal(app.root.lab.measurements(experiment.id).length, 16)
  }))

test('the data table and the CSV export carry the measurements', () =>
  withApp(async (app) => {
    const experiment = app.root.lab.experiments()[0]
    assert.ok(experiment !== undefined)
    const table = await app.page(`/experiments/${experiment.id}/data`)
    assert.match(table.html, /SAMPLE/)
    assert.match(table.html, /A-01/)
    const response = await app.root.router.request(`/experiments/${experiment.id}/export.csv`)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') ?? '', /text\/csv/)
    assert.match((await response.text()).split('\n')[0] ?? '', /sample_id,parameter,value,unit,measured_at/)
  }))

test('new experiment and notebook forms work, health, 404, manifest, prefix and switch-off', async () => {
  await withApp(async (app) => {
    const notebook = app.root.lab.notebooks()[0]
    assert.ok(notebook !== undefined)
    const form = await app.page(`/experiments/new?notebook=${notebook.id}`)
    assert.match(form.html, /New experiment/)
    const created = await app.post('/experiments/new', { notebookId: notebook.id, title: 'New test', objective: 'Objective', method: 'Method' })
    assert.equal(noticeOf(created).kind, 'ok')
    const nb = await app.post('/notebooks', { title: 'Another notebook' })
    assert.equal(noticeOf(nb).kind, 'ok')
    assert.equal((await app.page('/health')).status, 200)
    assert.equal((await app.page('/nope')).status, 404)
    assert.deepEqual(readManifest().plugins.map((row) => row.id), ['router', 'home', 'lab', 'lab-shell', 'notebook', 'extensions', 'server', 'acryl-door'])
  })
  await withApp(async (app) => {
    const response = await app.root.router.request('/app', { headers: { accept: 'text/html' } })
    assert.equal(response.status, 200)
    assert.match(await response.text(), /Polymer tensile test/)
  }, { prefix: '/app' })
  const manifest = readManifest()
  const without = { ...manifest, plugins: manifest.plugins.map((row) => (row.id === 'notebook' ? { ...row, disabled: true } : row)) }
  const home = await mkdtemp(join(scratch, 'app-test-off-'))
  let ids = 0
  const app = await createApp(pinnedInstance(home, { root: projectRoot }), { listen: false, manifest: without, overrides: { lab: { clock: () => NOW, newId: (kind: string) => `${kind}-${++ids}` } } })
  try {
    assert.equal((await app.root.router.request('/health')).status, 200)
    assert.equal((await app.root.router.request('/')).status, 404)
  } finally { await app.stop(); await rm(home, { recursive: true, force: true }) }
})
