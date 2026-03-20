import { FormEvent, useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAppStore } from "@/store/app-store";
import { UserProfile } from "@/types/models";
import { useAuth } from "@/contexts/AuthContext";
import { authRateLimiter } from "@/lib/rate-limiter";
import { emailSchema, otpTokenSchema, profileNameSchema } from "@/lib/validators";
import { toast } from "sonner";

interface ProfileGateProps {
  children: React.ReactNode;
}

export function ProfileGate({ children }: ProfileGateProps) {
  const { activeProfile, profiles, createProfile, switchProfile } = useAppStore();
  const { user, isLoading, signInWithOtp, verifyOtp } = useAuth();

  const [authStep, setAuthStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [otpToken, setOtpToken] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [resendCooldown]);

  const canSendCode = resendCooldown === 0 && !isSending;

  const handleSendCode = async () => {
    setEmailError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? "Enter a valid email address");
      return;
    }

    const limiter = authRateLimiter.attempt("otp-send");
    if (!limiter.allowed) {
      const waitSeconds = Math.ceil(limiter.retryAfterMs / 1000);
      setEmailError(`Too many attempts. Please wait ${waitSeconds}s.`);
      return;
    }

    setIsSending(true);
    const result = await signInWithOtp(parsed.data);
    setIsSending(false);

    if (result.error) {
      setEmailError(result.error);
      return;
    }

    toast.success("Check your email \u2014 a 6-digit code is on its way");
    setAuthStep("otp");
    setResendCooldown(60);
  };

  const handleVerifyOtp = async () => {
    setOtpError(null);
    const parsed = otpTokenSchema.safeParse(otpToken);
    if (!parsed.success) {
      setOtpError(parsed.error.issues[0]?.message ?? "Enter a valid code");
      return;
    }

    setIsVerifying(true);
    const result = await verifyOtp(email, parsed.data);
    setIsVerifying(false);

    if (result.error) {
      setOtpError(result.error);
      setOtpToken("");
      return;
    }
  };

  if (isLoading) {
    return null;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background px-4">
        <Card className="w-full max-w-md rounded-2xl border-border/70 shadow-large">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle className="font-display text-2xl">Sign in to your workspace</CardTitle>
            </div>
            <CardDescription>
              Enter your email \u2014 we'll send a code. No password needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {authStep === "email" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoFocus
                  />
                  {emailError ? (
                    <p className="text-xs text-rose-400">{emailError}</p>
                  ) : null}
                </div>
                <Button className="w-full" onClick={handleSendCode} disabled={!canSendCode}>
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : resendCooldown > 0 ? (
                    `Resend in ${resendCooldown}s...`
                  ) : (
                    "Send code"
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Verification code</Label>
                  <InputOTP
                    maxLength={6}
                    pattern={REGEXP_ONLY_DIGITS}
                    value={otpToken}
                    onChange={setOtpToken}
                  >
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, index) => (
                        <InputOTPSlot key={index} index={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  {otpError ? (
                    <p className="text-xs text-rose-400">{otpError}</p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <Button className="w-full" onClick={handleVerifyOtp} disabled={isVerifying}>
                    {isVerifying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setAuthStep("email");
                      setOtpToken("");
                      setOtpError(null);
                    }}
                  >
                    ← Back
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeProfile) {
    return <>{children}</>;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = profileNameSchema.safeParse(name);
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? "Name is required");
      return;
    }
    setNameError(null);
    createProfile(parsed.data);
    setName("");
  };

  const createParentProfileName = (existingProfiles: UserProfile[]): string => {
    const existingNames = new Set(existingProfiles.map((profile) => profile.name.trim().toLowerCase()));
    let candidate = "Parent";
    let suffix = 2;

    while (existingNames.has(candidate.toLowerCase())) {
      candidate = `Parent ${suffix}`;
      suffix += 1;
    }

    return candidate;
  };

  const handleCreateParentProfile = () => {
    createProfile(createParentProfileName(profiles));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background px-4">
      <Card className="w-full max-w-md rounded-2xl border-border/70 shadow-large">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Create Your Profile</CardTitle>
          <CardDescription>
            Data is isolated per profile on this device. No demo data is preloaded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Your name"
                autoFocus
              />
              {nameError ? (
                <p className="text-xs text-rose-400">{nameError}</p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" disabled={!name.trim()}>
              Enter Workspace
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={handleCreateParentProfile}>
              Create Parent Profile
            </Button>
          </form>
          {profiles.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Or continue as</p>
              <div className="flex flex-wrap gap-2">
                {profiles.map((profile) => (
                  <Button key={profile.id} variant="outline" size="sm" onClick={() => switchProfile(profile.id)}>
                    {profile.name}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
