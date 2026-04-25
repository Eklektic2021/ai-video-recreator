import { useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AnalysisResult, SelectedPlatforms } from '../types';

export interface Project {
  id: string;
  title: string;
  createdAt: Timestamp | null;
  platforms: SelectedPlatforms;
  output: AnalysisResult;
}

export async function saveProject(
  uid: string,
  data: { title: string; platforms: SelectedPlatforms; output: AnalysisResult }
): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'projects'), {
    title: data.title.trim().slice(0, 50) || 'Untitled',
    createdAt: serverTimestamp(),
    platforms: data.platforms,
    output: data.output,
  });
  return ref.id;
}

export async function deleteProject(uid: string, projectId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'projects', projectId));
}

export function useProjects(uid: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'users', uid, 'projects'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project)));
      setLoading(false);
    });
    return unsubscribe;
  }, [uid]);

  return { projects, loading };
}
