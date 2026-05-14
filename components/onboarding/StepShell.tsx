"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function StepShell({ title, description, children }: Props) {
  return (
    <Card className="w-full max-w-xl border-border/60 bg-card/60 backdrop-blur">
      <CardHeader className="space-y-2 pb-4">
        <CardTitle className="text-2xl font-semibold tracking-tight">{title}</CardTitle>
        {description ? <CardDescription className="text-base">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-6 pb-8">{children}</CardContent>
    </Card>
  );
}
