/** The lab shell: the notebook rail (notebooks, new notebook, experiments) and the record column. */
import type { Context } from '@deepseek-ai/cordis'
import { Acryl } from '../acryl-router/src/index.ts'
import type { Lab } from '../lab/index.ts'
import { createShell, escapeHtml, type NavItem, type Shell } from './core.ts'
import { STYLES } from './styles.ts'
export * from './core.ts'
export const APP_TITLE = 'Field Lab'
export interface ShellConfig { readonly prefix?: string }
export const name = 'lab-shell'
export const inject = ['lab', 'router']
declare module '@deepseek-ai/cordis' { interface Context { shell: Shell } }
function rail(lab: Lab, _nav: readonly NavItem[], active: string | undefined, href: (path: string) => string): string {
  const notebooks = lab.notebooks().map((notebook) => `<a class="exp${active === `notebook:${notebook.id}` ? ' active' : ''}" href="${href(`/notebooks/${encodeURIComponent(notebook.id)}`)}" style="text-decoration:none">◉ ${escapeHtml(notebook.title)} <small>Notebook ${escapeHtml(notebook.code)} · ${String(lab.experiments(notebook.id).length)} experiments</small></a>`).join('')
  const first = lab.notebooks()[0]
  const experiments = first === undefined ? '' : lab.experiments(first.id).map((experiment, index) => `<a class="exp${active === `experiment:${experiment.id}` ? ' active' : ''}" href="${href(`/experiments/${encodeURIComponent(experiment.id)}`)}" style="text-decoration:none">0${String(index + 1)} · ${escapeHtml(experiment.title)} <small>Updated ${escapeHtml(experiment.startedAt.slice(0, 10))} · ${escapeHtml(experiment.protocolVersion)}</small></a>`).join('')
  return `<aside class="side"><div class="labbrand">FIELD <i>／</i> LAB</div><h4>MY NOTEBOOKS</h4>${notebooks}<form method="post" action="${href('/notebooks')}" style="margin:8px 0"><input name="title" placeholder="New notebook title" required style="width:100%;border:1px solid #dce7e9;border-radius:4px;padding:7px;font-size:8px;background:white"><button style="margin-top:5px;border:1px solid #dce7e9;background:#eef4f4;border-radius:4px;padding:6px 8px;font-size:8px;color:#4f6a70">＋ New notebook</button></form><h4>EXPERIMENTS</h4>${experiments}<div class="sidefoot">PROJECT: MATERIALS / BATCH 04<br>ACCESS: PRIVATE RESEARCH GROUP<br>LAST SYNC: ${escapeHtml(lab.now.toISOString().slice(11, 16))}</div></aside>`
}
export function apply(ctx: Context, config: ShellConfig = {}): void {
  const lab: Lab = ctx.lab
  const prefix = config.prefix ?? ''
  const shell = createShell(prefix, { appTitle: APP_TITLE, css: STYLES, bodyClass: 'lab', rail: (nav, active, href) => rail(lab, nav, active, href) })
  ctx.provide('shell', shell)
  ctx.router.route(prefix === '' ? '/' : prefix, new Acryl().get('/health', (c) => c.json({ ok: true })))
}
