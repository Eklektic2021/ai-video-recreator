import { useState } from 'react';
import { auth } from '../lib/firebase';
import { useProjects, deleteProject, Project } from '../hooks/useProjects';
import type { AnalysisResult, SelectedPlatforms } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onLoad: (output: AnalysisResult, platforms: SelectedPlatforms) => void;
}

function formatDate(project: Project): string {
  if (!project.createdAt) return '';
  try {
    return project.createdAt.toDate().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function platformSummary(platforms: SelectedPlatforms): string {
  return [...platforms.video, ...platforms.music, ...platforms.editing].join(', ') || '—';
}

export default function ProjectsPanel({ open, onClose, onLoad }: Props) {
  const uid = auth.currentUser!.uid;
  const { projects, loading } = useProjects(uid);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setDeletingId(projectId);
    try {
      await deleteProject(uid, projectId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {open && <div className="projects-overlay" onClick={onClose} />}

      <div className={`projects-panel${open ? ' projects-panel--open' : ''}`}>
        <div className="projects-panel-header">
          <h2 className="projects-panel-title">My Projects</h2>
          <button className="projects-close-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="projects-panel-body">
          {loading && (
            <div className="projects-loading">
              <div className="spinner" />
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div className="projects-empty">
              <p>No saved projects yet.</p>
              <p>Your analyses will appear here after you run them.</p>
            </div>
          )}

          {!loading && projects.length > 0 && (
            <ul className="projects-list">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="project-item"
                  onClick={() => {
                    onLoad(project.output, project.platforms);
                    onClose();
                  }}
                >
                  <div className="project-item-main">
                    <p className="project-title">{project.title}</p>
                    <p className="project-date">{formatDate(project)}</p>
                    <p className="project-platforms">{platformSummary(project.platforms)}</p>
                  </div>
                  <button
                    className="project-delete-btn"
                    onClick={(e) => handleDelete(e, project.id)}
                    disabled={deletingId === project.id}
                    aria-label="Delete project"
                  >
                    {deletingId === project.id ? '…' : '✕'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
