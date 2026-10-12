export const WORKSPACE_LAYOUTS = ['classic', 'zoho', 'claude', 'ribbon'] as const;
export type WorkspaceLayout = typeof WORKSPACE_LAYOUTS[number];

export function isWorkspaceLayout(value: unknown): value is WorkspaceLayout {
     return typeof value === 'string' && WORKSPACE_LAYOUTS.some(layout => layout === value);
}
