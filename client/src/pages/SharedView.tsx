import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSharedProject, SharedProject } from '../hooks/useProjects';
import ResultsTabs from '../components/ResultsTabs';

export default function SharedView() {
  const { shareId } = useParams<{ shareId: string }>();
  const [project, setProject] = useState<SharedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shareId) { setError('Invalid share link.'); setLoading(false); return; }
    getSharedProject(shareId)
      .then((p) => {
        if (p) setProject(p);
        else setError('This shared project was not found or has been removed.');
      })
      .catch(() => setError('Failed to load shared project. Please try again.'))
      .finally(() => setLoading(false));
  }, [shareId]);

  if (loading) {
    return (
      <div className="shared-center">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="shared-center">
        <div className="shared-error-card">
          <p className="shared-error-msg">{error || 'Project not found.'}</p>
          <Link to="/" className="shared-home-btn">Go to AI Video Recreator</Link>
        </div>
      </div>
    );
  }

  const formattedDate = (() => {
    try {
      return project.createdAt
        ? project.createdAt.toDate().toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
          })
        : '';
    } catch { return ''; }
  })();

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-brand">
            <span className="header-logo">MAISuite Flow</span>
            <span className="header-sep">|</span>
            <span className="header-title">AI Video Recreator</span>
          </div>
          <div className="header-right">
            <span className="shared-badge">Shared Project</span>
            <Link to="/" className="shared-cta-btn">Create your own ↗</Link>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="card shared-project-meta">
          <h1 className="shared-project-title">{project.title}</h1>
          {formattedDate && (
            <p className="shared-project-date">Generated on {formattedDate}</p>
          )}
          <div className="shared-platforms">
            {[...project.platforms.video, ...project.platforms.music, ...project.platforms.editing].map((p) => (
              <span key={p} className="shared-platform-tag">{p}</span>
            ))}
          </div>
        </div>

        <ResultsTabs result={project.output} selectedPlatforms={project.platforms} />

        <div className="shared-footer-cta">
          <p className="shared-footer-text">
            Want to analyze your own videos?
          </p>
          <Link to="/" className="analyze-btn shared-cta-large">
            Try AI Video Recreator Free ↗
          </Link>
        </div>
      </main>

      <footer className="footer">
        <p>
          Powered by <span className="footer-brand">Claude AI</span>
          {' · '}
          <span className="footer-suite">MAISuite Flow</span>
        </p>
      </footer>
    </div>
  );
}
