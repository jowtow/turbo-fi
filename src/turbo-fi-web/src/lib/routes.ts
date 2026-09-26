import type { Workspace } from '../types/finance'

export const workspacePaths: Record<Workspace, string> = {
  dashboard: '/dashboard',
  categorize: '/categorize',
  plan: '/plan',
  settings: '/settings',
}

export function workspaceAtPath(pathname: string): Workspace | undefined {
  return (Object.keys(workspacePaths) as Workspace[]).find(
    (workspace) => workspacePaths[workspace] === pathname,
  )
}
