import { useState, useEffect } from 'preact/hooks'
import { fetchProjects, deleteProject } from '../services/projects'
import { ProjectTable } from '../components/projects/ProjectTable'
import { ProjectModal } from '../components/projects/ProjectModal'
import { confirmDialog } from '../lib/confirm'
import type { Project } from '../types'

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  async function load() {
    if (projects.length === 0) setLoading(true)
    setError(null)
    const { data, error } = await fetchProjects()
    if (error) setError(error.message)
    else setProjects((data as Project[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function handleEdit(p: Project) {
    setEditingProject(p)
    setModalOpen(true)
  }

  async function handleDelete(id: string) {
    if (!(await confirmDialog('Delete this project?'))) return
    const { error } = await deleteProject(id)
    setError(error?.message ?? null)
    load() // reload either way — a "nothing deleted" row may simply be stale
  }

  function handleModalClose() {
    setModalOpen(false)
    setEditingProject(null)
    load()
  }

  return (
    <div>
      <header class="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="font-display font-bold text-2xl">Projects</h1>
          <p class="text-sm opacity-60 font-mono">{projects.length} project{projects.length === 1 ? '' : 's'}</p>
        </div>
        <button class="btn btn-primary" onClick={() => setModalOpen(true)}>
          New project
        </button>
      </header>
      {error && (
        <div class="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}
      {loading ? (
        <div class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md" />
        </div>
      ) : (
        <ProjectTable projects={projects} onEdit={handleEdit} onDelete={handleDelete} />
      )}
      {modalOpen && <ProjectModal project={editingProject} onClose={handleModalClose} />}
    </div>
  )
}
