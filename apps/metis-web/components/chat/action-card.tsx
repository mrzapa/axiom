"use client";

import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isNyxInstallAction,
  type ActionRequiredAction,
  type ChatActionStatus,
  type NyxInstallActionResult,
} from "@/lib/chat-types";

interface ActionCardProps {
  runId: string;
  action: ActionRequiredAction;
  status: ChatActionStatus;
  result?: NyxInstallActionResult | null;
  onApprove?: () => void;
  onDeny?: () => void;
}

function getActionTitle(action: ActionRequiredAction): string {
  if (isNyxInstallAction(action)) {
    return action.label || "Approve Nyx install proposal";
  }
  return action.kind.replace(/_/g, " ");
}

function getNyxResultHeadline(result: NyxInstallActionResult): string {
  if (
    result.execution_status === "failed" ||
    result.status === "error"
  ) {
    return result.failure_code
      ? `Installer failed (${result.failure_code})`
      : "Installer failed";
  }
  if (
    result.execution_status === "declined" ||
    result.status === "declined" ||
    result.approved === false
  ) {
    return "Proposal declined";
  }
  return "Installer completed";
}

export function ActionCard({
  runId,
  action,
  status,
  result,
  onApprove,
  onDeny,
}: ActionCardProps) {
  void runId;
  const isPending = status === "pending";
  const isSubmitting = status === "submitting";
  const isFailed = status === "failed";
  const isNyxAction = isNyxInstallAction(action);
  const componentNames = isNyxAction
    ? action.proposal.component_names.length > 0
      ? action.proposal.component_names
      : action.payload.component_names
    : [];
  const outputExcerpt = result?.installer?.stderr_excerpt || result?.installer?.stdout_excerpt;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-sm",
        status === "approved" && "border-emerald-500/30 bg-emerald-500/5",
        status === "denied" && "border-destructive/30 bg-destructive/5",
        isFailed && "border-destructive/40 bg-destructive/10",
        (isPending || isSubmitting) && "border-amber-500/30 bg-amber-500/5",
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">
            {getActionTitle(action)}
          </p>
          <p className="mt-0.5 text-muted-foreground">{action.summary}</p>
          {isNyxAction && componentNames.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {componentNames.map((componentName) => (
                <span
                  key={componentName}
                  className="rounded-full border border-white/10 bg-black/10 px-2 py-0.5 text-[11px] text-foreground/90"
                >
                  {componentName}
                </span>
              ))}
            </div>
          )}
        </div>
        {status === "approved" && (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
        )}
        {status === "denied" && (
          <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        )}
        {isFailed && (
          <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        )}
      </div>

      {isNyxAction && result && (
        <div className="mt-3 rounded-md border border-white/10 bg-black/10 p-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground/90">
            {getNyxResultHeadline(result)}
          </p>
          <p className="mt-1">
            {result.component_count} component{result.component_count === 1 ? "" : "s"}
            {result.installer
              ? ` • exit ${result.installer.returncode}`
              : ""}
          </p>
          {outputExcerpt && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-white/10 bg-black/20 p-2 text-[11px] leading-5 text-muted-foreground">
              {outputExcerpt}
            </pre>
          )}
        </div>
      )}

      {(isPending || isSubmitting) && (
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant="default"
            className="h-7 bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
            disabled={isSubmitting}
            onClick={onApprove}
          >
            {isSubmitting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              "Approve"
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-destructive/50 px-3 text-xs text-destructive hover:bg-destructive/10"
            disabled={isSubmitting}
            onClick={onDeny}
          >
            Deny
          </Button>
        </div>
      )}
    </div>
  );
}
