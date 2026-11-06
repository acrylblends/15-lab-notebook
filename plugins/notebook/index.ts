/**
 * The experiment record, the data table and the notebook/experiment forms.
 * Routes: GET /, GET /experiments/:id, GET /notebooks/:id, GET/POST /experiments/new, GET /experiments/:id/data,
 * POST /experiments/:id/observations, POST /experiments/:id/measurements, POST /notebooks, GET /experiments/:id/export.csv.
 */
import type { Context } from '@deepseek-ai/cordis'
import { Acryl } from '../acryl-router/src/index.ts'
import { LabError, whenText } from '../lab/index.ts'
const escape = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
export const name = 'notebook'
export const inject = ['lab', 'shell', 'router']
const STATUS: Readonly<Record<string, string>> = { in_progress: 'IN PROGRESS', complete: 'COMPLETE' }
export function apply(ctx: Context): void {
  const { lab, shell } = ctx
  const e = shell.e
  const prefix = shell.prefix
  const chart = (groups: readonly { group: string; mean: number }[]): string => {
    const max = Math.max(1, ...groups.map((group) => group.mean))
    return `<div class="chartbox"><div style="display:flex;justify-content:space-between;color:#7c939a;font-size:8px"><span>MEAN TENSILE STRENGTH</span><span>MPa</span></div><svg viewBox="0 0 580 150" preserveAspectRatio="none"><g stroke="#dce7e9"><path d="M30 20H580M30 55H580M30 90H580M30 125H580"/></g>${groups.map((group, index) => { const x = 100 + index * 155; const height = Math.round((group.mean / max) * 90); return `<g><rect x="${String(x)}" y="${String(125 - height)}" width="68" height="${String(height)}" rx="3" fill="#78aebb"/><text x="${String(x + 34)}" y="${String(118 - height)}" text-anchor="middle" font-size="10" fill="#527783">${group.mean.toFixed(1)}</text><text x="${String(x + 34)}" y="143" text-anchor="middle" font-size="10" fill="#527783">${escape(group.group)}</text></g>` }).join('')}</svg></div>`
  }
  const record = (id: string, url: string): string | undefined => {
    const experiment = lab.experiment(id)
    if (experiment === undefined) return undefined
    const notebook = lab.notebook(experiment.notebookId)
    const observations = lab.observations(id)
    const groups = lab.groups(id, 'Tensile strength')
    const value = Number(new URL(url, 'http://local').searchParams.get('value'))
    const from = new URL(url, 'http://local').searchParams.get('from')
    const to = new URL(url, 'http://local').searchParams.get('to')
    let converted = ''
    if (Number.isFinite(value) && from !== null && to !== null) {
      try { converted = `${value} ${from} = ${lab.convert(value, from, to).toLocaleString('en-GB', { maximumFractionDigits: 1 })} ${to}` } catch (error) { converted = (error as Error).message }
    }
    const main = `${shell.notice(url)}<div class="top"><div><small>NOTEBOOK ${escape(notebook?.code ?? '')} / EXPERIMENT ${escape(experiment.protocolVersion)}</small><h1>${escape(experiment.title)}</h1><p>${escape(experiment.objective.slice(0, 90))} · ${escape(experiment.method.slice(0, 60))}</p></div><div class="tools"><span class="tool" data-toast="Experiment history opened" style="font-size:9px;color:#6d7a80">History</span><a href="${shell.href(`/experiments/${encodeURIComponent(id)}/export.csv`)}" style="font-size:9px;color:#6d7a80;text-decoration:none">Export</a><a href="#observation-form" style="font-size:9px;color:#2d6d64;text-decoration:none">＋ Add observation</a></div></div><div class="cols"><article class="paper"><div class="paperhead"><small>LAB RECORD · ${escape(experiment.title)}</small><span class="stamp">${STATUS[experiment.status] ?? experiment.status}</span></div><h2>${escape(experiment.objective.split('.')[0] ?? experiment.title)}</h2><div class="meta">Author: M. Chen &nbsp; · &nbsp; Started ${escape(experiment.startedAt.slice(0, 10))} &nbsp; · &nbsp; Protocol ${escape(experiment.protocolVersion)}</div><div class="section"><h3>01 / OBJECTIVE</h3><p>${escape(experiment.objective)}</p></div><div class="section"><h3>02 / MATERIALS & METHOD</h3><p>${escape(experiment.method)}</p><div class="measure">${groups.map((group) => `<div><small>FORMULATION ${escape(group.group)}</small><b>${group.mean.toFixed(1)}</b><em>MPa · ${String(group.count)} specimens</em></div>`).join('')}${groups.length === 0 ? '<p class="empty">No measurements yet. Add one on the data page.</p>' : ''}</div></div><div class="section"><h3>03 / RESULTS</h3>${groups.length === 0 ? '<p class="empty">No measurements yet.</p>' : chart(groups)}</div><div class="section"><h3>04 / OBSERVATIONS</h3>${observations.length === 0 ? '<p class="empty">No observations yet.</p>' : observations.map((observation) => `<div class="obs"><time>${escape(observation.createdAt.slice(0, 10))} · ${escape(observation.author)}</time><p>${escape(observation.body)}</p></div>`).join('')}<form class="form" id="observation-form" method="post" action="${shell.href(`/experiments/${encodeURIComponent(id)}/observations`)}"><h2>Add an observation</h2><label>OBSERVATION<textarea name="body" required rows="3" placeholder="What did you see?"></textarea></label><div class="actions"><button class="primary">Append to the record</button></div></form><p style="font-size:8px;color:#83959c">Observations are append-only: the record keeps every entry with its author and time.</p></div><p style="font-size:9px;color:#7c939a;margin-top:12px"><a href="${shell.href(`/experiments/${encodeURIComponent(id)}/data`)}" style="color:#2d6d64">Open the data table ↗</a></p></article><aside class="aside"><section class="card"><h3>Unit converter</h3><form method="get" action="${shell.href(`/experiments/${encodeURIComponent(id)}`)}"><label>VALUE</label><input name="value" type="number" step="any" value="${Number.isFinite(value) ? String(value) : '58.4'}"><label>FROM</label><select name="from"><option${from === 'MPa' ? ' selected' : ''}>MPa</option><option${from === 'bar' ? ' selected' : ''}>bar</option><option${from === 'psi' ? ' selected' : ''}>psi</option></select><label>TO</label><select name="to"><option${to === 'psi' ? ' selected' : ''}>psi</option><option${to === 'MPa' ? ' selected' : ''}>MPa</option><option${to === 'bar' ? ' selected' : ''}>bar</option></select><button>Convert measurement</button></form><div class="result">${converted === '' ? 'Choose units to convert.' : escape(converted)}</div></section><section class="card"><h3>Experiment metadata</h3><label>INSTRUMENT</label><b style="font-size:10px">${escape(experiment.instrument)}</b><label>LOCATION</label><b style="font-size:10px">${escape(experiment.location)}</b><label>ATTACHMENTS</label><p style="font-size:9px;color:#789098">Demo record: no files attached.</p></section><section class="card"><h3>Reproducibility</h3><p style="font-size:9px;color:#83959c;line-height:1.5">Protocol, instrument, conditions and sample IDs are recorded with every observation.</p><span class="stamp">RECORD COMPLETE</span></section></aside></div>`
    return shell.page({ active: `experiment:${id}`, title: experiment.title, main })
  }
  const data = (id: string, url: string): string | undefined => {
    const experiment = lab.experiment(id)
    if (experiment === undefined) return undefined
    const rows = lab.measurements(id).map((measurement) => `<tr><td>${escape(measurement.sampleId)}</td><td>${escape(measurement.parameter)}</td><td>${measurement.value}</td><td>${escape(measurement.unit)}</td><td>${escape(whenText(measurement.measuredAt, lab.now))}</td></tr>`).join('')
    const main = `${shell.notice(url)}<div class="top"><div><small>LAB RECORD / DATA</small><h1>${escape(experiment.title)} · data table</h1><p>${String(lab.measurements(id).length)} measurements · append a row below</p></div><div class="tools"><a href="${shell.href(`/experiments/${encodeURIComponent(id)}`)}" style="font-size:9px;color:#2d6d64;text-decoration:none">Back to the record ↗</a></div></div><table class="data"><thead><tr><th>SAMPLE</th><th>PARAMETER</th><th>VALUE</th><th>UNIT</th><th>MEASURED</th></tr></thead><tbody>${rows === '' ? '<tr><td colspan="5">No measurements yet.</td></tr>' : rows}</tbody></table><form class="form" method="post" action="${shell.href(`/experiments/${encodeURIComponent(id)}/measurements`)}"><h2>Append a measurement</h2><div class="row" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label>SAMPLE ID<input name="sampleId" required maxlength="40" placeholder="A-06"></label><label>PARAMETER<input name="parameter" required value="Tensile strength"></label></div><div class="row" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label>VALUE<input name="value" required inputmode="decimal" placeholder="43.2"></label><label>UNIT<input name="unit" required value="MPa"></label></div><div class="actions"><button class="primary">Append measurement</button></div></form><p style="font-size:8px;color:#83959c;margin-top:9px"><a href="${shell.href(`/experiments/${encodeURIComponent(id)}/export.csv`)}" style="color:#2d6d64">Export this table as CSV ↗</a></p>`
    return shell.page({ active: `experiment:${id}`, title: `${experiment.title} data`, main })
  }
  const newExperiment = (notebookId: string | undefined): string => {
    const options = lab.notebooks().map((notebook) => `<option value="${e(notebook.id)}"${notebook.id === notebookId ? ' selected' : ''}>${escape(notebook.title)}</option>`).join('')
    return shell.page({ active: 'new', title: 'New experiment', main: `<div class="top"><div><small>LAB / NEW EXPERIMENT</small><h1>New experiment</h1><p>Record the objective and method before the first measurement.</p></div></div><form class="form" method="post" action="${shell.href('/experiments/new')}"><label>NOTEBOOK<select name="notebookId">${options}</select></label><label>TITLE<input name="title" required maxlength="160" placeholder="Polymer tensile test"></label><label>OBJECTIVE<textarea name="objective" required rows="3" placeholder="What question does this experiment answer?"></textarea></label><label>METHOD<textarea name="method" required rows="3" placeholder="Materials, conditions and procedure"></textarea></label><div class="actions"><button class="primary">Create experiment</button><a href="${shell.href('/')}">Cancel</a></div></form>` })
  }
  const app = new Acryl()
    .get('/', (c) => {
      const experiment = lab.experiments()[0]
      if (experiment === undefined) return c.html(newExperiment(undefined))
      return c.html(record(experiment.id, c.req.url) as string)
    })
    .get('/experiments/new', (c) => c.html(newExperiment(c.req.query('notebook'))))
    .get('/experiments/:id', (c) => {
      const main = record(c.req.param('id'), c.req.url)
      if (main === undefined) return c.redirect(shell.url('/', { kind: 'error', text: 'That experiment no longer exists.' }), 303)
      return c.html(main)
    })
    .get('/experiments/:id/data', (c) => {
      const main = data(c.req.param('id'), c.req.url)
      if (main === undefined) return c.redirect(shell.url('/', { kind: 'error', text: 'That experiment no longer exists.' }), 303)
      return c.html(main)
    })
    .get('/notebooks/:id', (c) => {
      const notebook = lab.notebook(c.req.param('id'))
      if (notebook === undefined) return c.redirect(shell.url('/', { kind: 'error', text: 'That notebook no longer exists.' }), 303)
      const first = lab.experiments(notebook.id)[0]
      if (first !== undefined) return c.redirect(shell.href(`/experiments/${encodeURIComponent(first.id)}`), 302)
      return c.html(newExperiment(notebook.id))
    })
    .post('/experiments/new', async (c) => {
      const form = await c.req.parseBody()
      try {
        const experiment = await lab.createExperiment({ notebookId: String(form.notebookId ?? ''), title: String(form.title ?? ''), objective: String(form.objective ?? ''), method: String(form.method ?? '') })
        return c.redirect(shell.url(`/experiments/${encodeURIComponent(experiment.id)}`, { kind: 'ok', text: 'Experiment created.' }), 303)
      } catch (error) {
        if (!(error instanceof LabError)) throw error
        return c.html(newExperiment(String(form.notebookId ?? '')))
      }
    })
    .post('/notebooks', async (c) => {
      const form = await c.req.parseBody()
      try {
        const notebook = await lab.createNotebook(String(form.title ?? ''))
        return c.redirect(shell.url(`/notebooks/${encodeURIComponent(notebook.id)}`, { kind: 'ok', text: 'Notebook created.' }), 303)
      } catch (error) {
        return c.redirect(shell.url('/', { kind: 'error', text: (error as Error).message }), 303)
      }
    })
    .post('/experiments/:id/observations', async (c) => {
      const form = await c.req.parseBody()
      try {
        await lab.addObservation(c.req.param('id'), String(form.body ?? ''))
        return c.redirect(shell.url(`/experiments/${encodeURIComponent(c.req.param('id'))}`, { kind: 'ok', text: 'Observation appended.' }), 303)
      } catch (error) {
        return c.redirect(shell.url(`/experiments/${encodeURIComponent(c.req.param('id'))}`, { kind: 'error', text: (error as Error).message }), 303)
      }
    })
    .post('/experiments/:id/measurements', async (c) => {
      const form = await c.req.parseBody()
      try {
        await lab.addMeasurement(c.req.param('id'), { sampleId: String(form.sampleId ?? ''), parameter: String(form.parameter ?? ''), value: form.value, unit: String(form.unit ?? '') })
        return c.redirect(shell.url(`/experiments/${encodeURIComponent(c.req.param('id'))}/data`, { kind: 'ok', text: 'Measurement appended.' }), 303)
      } catch (error) {
        return c.redirect(shell.url(`/experiments/${encodeURIComponent(c.req.param('id'))}/data`, { kind: 'error', text: (error as Error).message }), 303)
      }
    })
    .get('/experiments/:id/export.csv', (c) => {
      const experiment = lab.experiment(c.req.param('id'))
      if (experiment === undefined) return c.text('Not found', 404)
      const rows = lab.measurements(experiment.id)
      const csv = ['sample_id,parameter,value,unit,measured_at', ...rows.map((row) => `${row.sampleId},${row.parameter},${String(row.value)},${row.unit},${row.measuredAt}`)].join('\n')
      return c.body(csv, 200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${experiment.title.replace(/[^a-z0-9]+/giu, '-').toLowerCase()}.csv"` })
    })
  ctx.router.route(prefix === '' ? '/' : prefix, app)
}
