import { useState } from 'react';
import { auth } from '../lib/firebase';
import { useProjects, deleteProject, shareProject, Project } from '../hooks/useProjects';
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
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch { return ''; }
}

function platformSummary(platforms: SelectedPlatforms): string {
  return [...platforms.video, ...platforms.music, ...platforms.editing].join(', ') || '—';
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export default function ProjectsPanel({ open, onClose, onLoad }: Props) {
  const uid = auth.currentUser!.uid;
  const { projects, loading } = useProjects(uid);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setDeletingId(projectId);
    try {
      await deleteProject(uid, projectId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleShare = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setSharingId(project.id);
    try {
      const shareId = await shareProject(project);
      const url = `${window.location.origin}/share/${shareId}`;
      await navigator.clipboard.writeText(url);
      showToast('Link copied!');
    } catch {
      showToast('Failed to create share link.');
    } finally {
      setSharingId(null);
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
            <div className="projects-loading"><div className="spinner" /></div>
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
                  onClick={() => { onLoad(project.output, project.platforms); onClose(); }}
                >
                  <div className="project-item-main">
                    <p className="project-title">{project.title}</p>
                    <p className="project-date">{formatDate(project)}</p>
                    <p className="project-platforms">{platformSummary(project.platforms)}</p>
                  </div>
                  <div className="project-item-actions">
                    <button
                      className="project-share-btn"
                      onClick={(e) => handleShare(e, project)}
                      disabled={sharingId === project.id}
                      aria-label="Share project"
                      title="Copy share link"
                    >
                      {sharingId === project.id ? '…' : <ShareIcon />}
                    </button>
                    <button
                      className="project-delete-btn"
                      onClick={(e) => handleDelete(e, project.id)}
                      disabled={deletingId === project.id}
                      aria-label="Delete project"
                    >
                      {deletingId === project.id ? '…' : '✕'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {toast && (
          <div className="projects-toast">{toast}</div>
        )}
      </div>
    </>
  );
}
