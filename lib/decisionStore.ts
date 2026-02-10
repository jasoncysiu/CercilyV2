import { DecisionData, ProjectWithDecision } from './types';

const PROJECTS_KEY = 'cercily_projects';

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function saveProjects(projects: ProjectWithDecision[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function loadProjects(): ProjectWithDecision[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(PROJECTS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function getDecisionProjects(): ProjectWithDecision[] {
  return loadProjects().filter(p => p.isDecision);
}

export function getPendingReviews(): ProjectWithDecision[] {
  const now = new Date().toISOString();
  return getDecisionProjects().filter(
    d => d.decisionData && !d.decisionData.reviewedAt && d.decisionData.reviewDate <= now
  );
}

export function getActiveDecisions(): ProjectWithDecision[] {
  const now = new Date().toISOString();
  return getDecisionProjects().filter(
    d => d.decisionData && !d.decisionData.reviewedAt && d.decisionData.reviewDate > now
  );
}
