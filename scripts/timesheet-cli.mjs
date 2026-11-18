#!/usr/bin/env node
// Usage: npm run timesheet -- login | projects | add --date D --project Q [--start T --end T] (--description-file F | --description S)
// Runs the app's real services through Vite's SSR loader (handles import.meta.env + TS, no extra deps).
import { createServer } from 'vite'
import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import readline from 'node:readline'

const root = new URL('..', import.meta.url).pathname
const dir = join(homedir(), '.config', 'timecheese')
const file = join(dir, 'session.json')

const vite = await createServer({
  root, configFile: false, appType: 'custom', logLevel: 'silent',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true },
})
const load = (p) => vite.ssrLoadModule(p)
const fail = (msg) => { console.error(msg); process.exitCode = 1 }

function ask(q, hidden) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (hidden) rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s) }
    rl.question(q, (a) => { rl.close(); if (hidden) console.log(); resolve(a) })
  })
}

function save(session) {
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  writeFileSync(file, JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }), { mode: 0o600 })
  chmodSync(file, 0o600)
}

try {
  const { parseArgs, resolveProject } = await load('/src/lib/timesheet-cli.ts')
  const { supabase } = await load('/src/lib/supabase.ts')
  const { cmd, flags } = parseArgs(process.argv.slice(2))

  if (cmd === 'login') {
    const email = await ask('Email: ')
    const password = await ask('Password: ', true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    save(data.session)
    console.log(`Logged in as ${data.user.email}`)
  } else if (cmd === 'projects' || cmd === 'add') {
    if (!existsSync(file)) throw new Error('Not logged in. Run: npm run timesheet login')
    const { access_token, refresh_token } = JSON.parse(readFileSync(file, 'utf8'))
    const { data: s, error: se } = await supabase.auth.setSession({ access_token, refresh_token })
    if (se || !s.session) throw new Error(`Session expired or invalid. Run: npm run timesheet login (${se?.message ?? 'no session'})`)
    save(s.session) // refresh tokens rotate; keep the newest

    const { fetchActiveProjects } = await load('/src/services/projects.ts')
    const { data: projects, error: pe } = await fetchActiveProjects()
    if (pe) throw new Error(pe.message)

    if (cmd === 'projects') {
      for (const p of projects) console.log(`${p.project_no}\t${p.project_name}`)
    } else {
      const { date, project, start, end, description, 'description-file': descFile } = flags
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw new Error('--date YYYY-MM-DD required')
      if (!project) throw new Error('--project required')
      if (!description === !descFile) throw new Error('Give exactly one of --description / --description-file')
      if (!start !== !end) throw new Error('--start and --end go together')
      const text = (description ?? readFileSync(descFile, 'utf8')).trim()
      if (!text) throw new Error('Empty description')
      const proj = resolveProject(projects, project)

      const { fetchDaySlots, createTimesheet } = await load('/src/services/timesheets.ts')
      if (start) {
        const { validateTimeslot } = await load('/src/lib/timeslot.ts')
        if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) throw new Error('Times must be HH:MM')
        const { data: day, error: de } = await fetchDaySlots(date)
        if (de) throw new Error(de.message)
        const others = (day ?? []).filter((r) => r.start_time && r.end_time)
        const err = validateTimeslot(start, end, others)
        if (err) throw new Error(err)
      }
      const { data, error } = await createTimesheet({
        date_memo: date, description: text, project_id: proj.id, is_complete: false,
        start_time: start ?? null, end_time: end ?? null,
      })
      if (error) throw new Error(error.message)
      console.log(`Inserted ${data.id} [${proj.project_no}] ${date} ${start ?? ''}${end ? '-' + end : ''}`)
      console.log(`Summary: ${data.ai_summary ?? '(none)'}`)
    }
  } else {
    throw new Error('Commands: login | projects | add')
  }
} catch (e) {
  fail(e.message)
} finally {
  await vite.close()
}
// supabase-js may hold a token-refresh timer open; this is a one-shot CLI.
process.exit()
