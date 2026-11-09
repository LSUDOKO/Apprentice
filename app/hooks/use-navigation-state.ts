import {
  appBasePath,
  appPathFromLocalRoute,
} from "@agent-native/core/client/api-path";
import { useAgentRouteState } from "@agent-native/core/client/navigation";

import {
  chatThreadPath,
  HOME_PATH,
  isChatPathname,
  NEW_CHAT_PATH,
  threadIdFromPath,
} from "@/lib/chat-paths";
import { TAB_ID } from "@/lib/tab-id";

export interface NavigationState {
  view?: string;
  path?: string;
  publicPath?: string;
  threadId?: string;
  issueId?: string;
  playbookId?: string;
  tab?: string;
  runId?: string;
  decisionId?: string;
  compare?: string[];
  filter?: string;
}

export function useNavigationState() {
  useAgentRouteState<NavigationState>({
    browserTabId: TAB_ID,
    requestSource: TAB_ID,
    getNavigationState: ({ pathname, searchParams }) => navigationStateForPath(pathname, searchParams),
    getCommandPath: commandPathForNavigation,
  });
}

export function commandPathForNavigation(command: NavigationState): string {
  const fallbackPath = pathForCommand(command);
  const path = typeof command?.path === "string" ? command.path : "";
  if (!path) return fallbackPath;

  const basePath = appBasePath();
  if (!basePath) return path;

  const suffixIndex = path.search(/[?#]/);
  const pathname = suffixIndex === -1 ? path : path.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? "" : path.slice(suffixIndex);
  const publicPath =
    typeof command?.publicPath === "string" ? command.publicPath : "";
  const publicPathSuffixIndex = publicPath.search(/[?#]/);
  const declaredPublicPath =
    publicPathSuffixIndex === -1
      ? publicPath
      : publicPath.slice(0, publicPathSuffixIndex);
  const publicViewPath = appPathFromLocalRoute(pathForView(command?.view));
  if (
    matchesPathPrefix(pathname, basePath) &&
    (matchesPathPrefix(pathname, publicViewPath) ||
      (declaredPublicPath && declaredPublicPath === pathname))
  ) {
    return `${pathname.slice(basePath.length) || "/"}${suffix}`;
  }
  return path;
}

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function decoded(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function navigationStateForPath(pathname: string, searchParams?: URLSearchParams): NavigationState {
  const threadId = threadIdFromPath(pathname);
  const issueId = decoded(pathname.match(/^\/issues\/([^/]+)/)?.[1]);
  const playbookId = decoded(pathname.match(/^\/playbooks\/([^/]+)/)?.[1]);
  const get = (k: string) => searchParams?.get(k) ?? undefined;
  const a = get("a");
  const b = get("b");
  const tab = playbookId ? (get("tab") ?? "recipe") : undefined;
  const runId = pathname.startsWith("/review") ? get("run") : undefined;
  const decisionId = pathname.startsWith("/review") ? get("decision") : undefined;
  const filter = pathname.startsWith("/issues") ? get("filter") : undefined;
  return {
    view: viewForPath(pathname),
    path: pathname,
    publicPath: appPathFromLocalRoute(pathname),
    ...(threadId ? { threadId } : {}),
    ...(issueId ? { issueId } : {}),
    ...(playbookId ? { playbookId } : {}),
    ...(tab ? { tab } : {}),
    ...(runId ? { runId } : {}),
    ...(decisionId ? { decisionId } : {}),
    ...(filter ? { filter } : {}),
    ...(pathname.startsWith("/compare") && a && b ? { compare: [a, b] } : {}),
  };
}

function viewForPath(pathname: string): string {
  if (pathname.startsWith("/issues")) return pathname === "/issues" ? "queue" : "issue";
  if (pathname.startsWith("/playbooks")) return pathname === "/playbooks" ? "playbooks" : "playbook";
  if (pathname.startsWith("/review")) return "review";
  if (pathname.startsWith("/exceptions")) return "exceptions";
  if (pathname.startsWith("/insights")) return "insights";
  if (pathname.startsWith("/lessons")) return "lessons";
  if (pathname.startsWith("/compare")) return "compare";
  if (pathname.startsWith("/preferences")) return "apprentice-settings";
  if (isChatPathname(pathname)) return "chat";
  if (pathname === HOME_PATH) return "home";
  if (pathname.startsWith("/database")) return "database";
  if (pathname.startsWith("/extensions")) return "extensions";
  if (pathname.startsWith("/observability")) return "observability";
  if (pathname.startsWith("/settings/agent") || pathname.startsWith("/agent")) {
    return "agent";
  }
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/team")) return "settings";
  return "chat";
}

function pathForView(view?: string): string {
  switch (view) {
    case "queue":
    case "issue":
      return "/issues";
    case "playbooks":
    case "playbook":
      return "/playbooks";
    case "review":
      return "/review";
    case "exceptions":
      return "/exceptions";
    case "insights":
      return "/insights";
    case "lessons":
      return "/lessons";
    case "apprentice-settings":
      return "/preferences";
    case "chat":
    case "ask":
      return NEW_CHAT_PATH;
    case "home":
      return HOME_PATH;
    case "database":
      return "/database";
    case "extensions":
      return "/extensions";
    case "observability":
      return "/observability";
    case "agent":
      return "/settings/agent";
    case "settings":
      return "/settings";
    case "team":
      return "/settings/organization";
    default:
      return "/issues";
  }
}

export function pathForCommand(command: any): string {
  const path = pathForView(command?.view);
  if (command?.view !== "chat" && command?.view !== "ask") return path;
  const threadId =
    typeof command?.threadId === "string" ? command.threadId.trim() : "";
  return threadId ? chatThreadPath(threadId) : path;
}
