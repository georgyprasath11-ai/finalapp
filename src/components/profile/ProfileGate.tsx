import { FormEvent, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";

interface ProfileGateProps {
  children: React.ReactNode;
}

export function ProfileGate({ children }: ProfileGateProps) {
  const { activeProfile, profiles, createProfile, switchProfile } = useAppStore();
  const [name, setName] = useState("");

  if (activeProfile) {
    return <>{children}</>;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createProfile(name);
    setName("");
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
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={!name.trim()}>
              Enter Workspace
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
