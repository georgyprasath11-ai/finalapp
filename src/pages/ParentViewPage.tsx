import { FormEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/store/app-store";

export default function ParentViewPage() {
  const navigate = useNavigate();
  const {
    activeProfile,
    isViewerMode,
    parentViewer,
    verifyParentAccessCode,
    exitViewerMode,
  } = useAppStore();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const lastSubmitAtRef = useRef(0);

  const hasGeneratedCode = Boolean(parentViewer?.otpHash);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const now = Date.now();
    if (now - lastSubmitAtRef.current < 350 || isSubmitting) {
      return;
    }
    lastSubmitAtRef.current = now;

    setError("");
    setStatusMessage("");
    setIsSubmitting(true);

    const result = await verifyParentAccessCode(code);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Invalid parent access code.");
      return;
    }

    setStatusMessage("Verified. Redirecting to dashboard in read-only mode...");
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      {isViewerMode ? (
        <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4" />
              Viewer Mode Active
            </CardTitle>
            <CardDescription>
              You are currently signed in as a read-only parent viewer.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
            <Button variant="outline" onClick={exitViewerMode}>
              Exit Viewer Mode
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl border-border/70 bg-card/85 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" />
            Parent Viewer Access
          </CardTitle>
          <CardDescription>
            Enter the one-time parent code generated from the student Settings page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!activeProfile ? (
            <p className="rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-muted-foreground">
              Select a student profile first to verify a parent code.
            </p>
          ) : null}

          {activeProfile && !hasGeneratedCode ? (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              No parent access code is currently available for this profile.
            </p>
          ) : null}

          <form className="space-y-3" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="parent-access-code">Parent access code</Label>
              <Input
                id="parent-access-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="ABCD-EFGH-IJKL-MNOP"
                autoComplete="one-time-code"
                inputMode="text"
                aria-label="Parent access code"
                disabled={!activeProfile || isSubmitting}
              />
            </div>

            <Button type="submit" disabled={!activeProfile || isSubmitting || code.trim().length === 0}>
              {isSubmitting ? "Verifying..." : "Access Dashboard"}
            </Button>
          </form>

          {error ? (
            <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
              {error}
            </p>
          ) : null}

          {statusMessage ? (
            <p className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200" role="status" aria-live="polite">
              {statusMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
